import { StatementFileFormat } from '@prisma/client';
import { parseCsv, parseOfx, parseQif, parseStatementFile } from './parsers/statement-parser';

describe('StatementParser', () => {
  describe('parseOfx', () => {
    const ofxSample = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>GBP
        <BANKTRANLIST>
          <DTSTART>20261001000000
          <DTEND>20261018000000
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261012120000
            <TRNAMT>-150.00
            <FITID>TXN982341
            <NAME>BRITISH TELECOM
            <MEMO>Direct Debit
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261015120000
            <TRNAMT>2500.00
            <FITID>TXN982342
            <NAME>ACME CORP
            <MEMO>Invoice Settlement
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>12450.50
          <DTASOF>20261018000000
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

    it('parses OFX transactions and ledger balance correctly', () => {
      const parsed = parseOfx(ofxSample);
      expect(parsed.format).toBe(StatementFileFormat.OFX);
      expect(parsed.closingBalance).toBe(12450.50);
      expect(parsed.lines).toHaveLength(2);

      const [line1, line2] = parsed.lines;
      expect(line1.amount).toBe(-150.00);
      expect(line1.externalId).toBe('TXN982341');
      expect(line1.payee).toBe('BRITISH TELECOM');
      expect(line1.description).toBe('BRITISH TELECOM - Direct Debit');
      expect(line1.transactionDate.getUTCFullYear()).toBe(2026);
      expect(line1.transactionDate.getUTCMonth()).toBe(9); // 0-indexed: October
      expect(line1.transactionDate.getUTCDate()).toBe(12);

      expect(line2.amount).toBe(2500.00);
      expect(line2.externalId).toBe('TXN982342');
      expect(line2.payee).toBe('ACME CORP');
    });
  });

  describe('parseQif', () => {
    const qifSample = `
!Type:Bank
D12/10/2026
T-85.20
PCOFFEE ROASTERS
MOffice supplies
^
D15/10/2026
T1200.00
PCLIENT PAYMENT
MProject Milestone 1
^
`;

    it('parses QIF records correctly', () => {
      const parsed = parseQif(qifSample);
      expect(parsed.format).toBe(StatementFileFormat.QIF);
      expect(parsed.lines).toHaveLength(2);

      const [line1, line2] = parsed.lines;
      expect(line1.amount).toBe(-85.20);
      expect(line1.payee).toBe('COFFEE ROASTERS');
      expect(line1.description).toBe('COFFEE ROASTERS - Office supplies');

      expect(line2.amount).toBe(1200.00);
      expect(line2.payee).toBe('CLIENT PAYMENT');
    });
  });

  describe('parseCsv', () => {
    it('parses standard CSV with signed amount', () => {
      const csv = `Date,Description,Amount,Balance
2026-10-12,AWS EMEA Amazon Web Services,-124.50,5400.00
2026-10-14,Customer Wire In,1850.00,7250.00`;

      const parsed = parseCsv(csv);
      expect(parsed.format).toBe(StatementFileFormat.CSV);
      expect(parsed.lines).toHaveLength(2);

      expect(parsed.lines[0].amount).toBe(-124.50);
      expect(parsed.lines[0].balance).toBe(5400.00);
      expect(parsed.lines[0].description).toBe('AWS EMEA Amazon Web Services');

      expect(parsed.lines[1].amount).toBe(1850.00);
      expect(parsed.lines[1].balance).toBe(7250.00);
    });

    it('parses CSV with separate Paid In and Paid Out columns', () => {
      const csv = `Transaction Date,Narrative,Paid Out,Paid In,Balance
12/10/2026,Office Stationery,45.00,,1200.00
14/10/2026,Consulting Revenue,,3500.00,4700.00`;

      const parsed = parseCsv(csv);
      expect(parsed.lines).toHaveLength(2);
      expect(parsed.lines[0].amount).toBe(-45.00);
      expect(parsed.lines[1].amount).toBe(3500.00);
    });
  });

  describe('parseStatementFile dispatcher', () => {
    it('dispatches to OFX parser', () => {
      const res = parseStatementFile('<OFX><STMTTRN><TRNAMT>50.00<DTPOSTED>20261012<NAME>TEST</STMTTRN></OFX>', StatementFileFormat.OFX);
      expect(res.format).toBe(StatementFileFormat.OFX);
      expect(res.lines).toHaveLength(1);
    });
  });
});
