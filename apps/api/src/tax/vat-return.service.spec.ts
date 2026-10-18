import { Prisma } from '@prisma/client';
import { MoneyService } from '../accounting-engine/money.service';
import { VatReturnService } from './vat-return.service';

const D = (v: string) => new Prisma.Decimal(v);
let seq = 0;
const line = (taxDirection: string, treatment: string, net: string, vat: string) => ({
  id: `l${++seq}`,
  description: null,
  contactId: null,
  taxDirection,
  taxNetAmount: D(net),
  taxAmount: D(vat),
  taxCode: { code: treatment, treatment },
  account: { code: '4000', name: 'Sales' },
  journalEntry: { id: `j${seq}`, journalNumber: `JNL-${seq}`, postingDate: new Date('2026-05-01') },
});

describe('VatReturnService', () => {
  let prisma: any;
  let service: VatReturnService;

  beforeEach(() => {
    prisma = {
      organizationVatScheme: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([
          line('OUTPUT', 'STANDARD', '1000.00', '200.00'),
          line('OUTPUT', 'STANDARD', '-100.00', '-20.00'), // credit note
          line('OUTPUT', 'ZERO', '250.50', '0'),
          line('INPUT', 'STANDARD', '400.00', '80.00'),
          line('INPUT', 'REVERSE_CHARGE_SERVICES', '500.00', '100.00'),
          line('INPUT', 'OUTSIDE_SCOPE', '999.00', '0'),
        ]),
        // VAT control: output 200 - 20, input 80, reverse charge +100 -100  => credit movement 100
        aggregate: jest.fn().mockResolvedValue({ _sum: { debit: D('200.00'), credit: D('300.00') } }),
      },
    };
    service = new VatReturnService(prisma, new MoneyService());
  });

  it('calculates boxes 1–9 from tax-analysed ledger lines', async () => {
    const r = await service.getReturn('org-1', { from: '2026-04-01', to: '2026-06-30' });
    expect(r.boxes).toEqual({
      box1: '280.00', // 200 - 20 + 100 RC
      box2: '0.00',
      box3: '280.00',
      box4: '180.00', // 80 + 100 RC
      box5: '100.00',
      box6: '1650', // 1000 - 100 + 250.50 + 500 RC -> 1650.50, pence dropped
      box7: '900', // 400 + 500 RC
      box8: '0',
      box9: '0',
    });
    expect(r.reconciliation).toEqual({ vatControlMovement: '100.00', box5: '100.00', difference: '0.00', reconciled: true });
  });

  it('only reads posted/reversed journals of this organisation within the dates', async () => {
    await service.getReturn('org-1', { from: '2026-04-01', to: '2026-06-30' });
    const where = prisma.journalLine.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.journalEntry.organizationId).toBe('org-1');
    expect(where.journalEntry.status.in).toEqual(['POSTED', 'REVERSED']);
    expect(where.journalEntry.postingDate.gte.toISOString().slice(0, 10)).toBe('2026-04-01');
    expect(where.journalEntry.postingDate.lte.toISOString().slice(0, 10)).toBe('2026-06-30');
  });

  it('flags a VAT control account that does not reconcile to box 5', async () => {
    prisma.journalLine.aggregate.mockResolvedValue({ _sum: { debit: D('0'), credit: D('150.00') } });
    const r = await service.getReturn('org-1', { from: '2026-04-01', to: '2026-06-30' });
    expect(r.reconciliation.reconciled).toBe(false);
    expect(r.reconciliation.difference).toBe('50.00');
  });

  it('drills down into the lines behind a box', async () => {
    const lines = await service.getBoxLines('org-1', { from: '2026-04-01', to: '2026-06-30' }, 'box4');
    expect(lines.map((l) => [l.taxCode, l.amount])).toEqual([
      ['STANDARD', '80.00'],
      ['REVERSE_CHARGE_SERVICES', '100.00'],
    ]);
  });

  it('rejects derived boxes and bad ranges', async () => {
    await expect(service.getBoxLines('org-1', { from: '2026-04-01', to: '2026-06-30' }, 'box5')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await expect(service.getReturn('org-1', { from: '2026-07-01', to: '2026-06-30' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});
