import { describe, it, expect } from 'vitest';
import {
  askReason,
  confirmAction,
  notify,
  splitMessage,
  subscribeDialogs,
  type DialogRequest,
  type Toast,
} from './dialog-bus';

describe('dialog bus', () => {
  it('splits a browser-style message into a title and body', () => {
    expect(splitMessage('Post INV-1 to the ledger? This creates postings.')).toEqual({
      title: 'Post INV-1 to the ledger?',
      message: 'This creates postings.',
    });
    expect(splitMessage('Please select a customer')).toEqual({ title: 'Please select a customer' });
  });

  it('routes confirm requests to the host and resolves with the answer', async () => {
    const seen: DialogRequest[] = [];
    const off = subscribeDialogs({ dialog: (d) => seen.push(d), toast: () => {} });
    const pending = confirmAction('Void this invoice? It reverses the journal.');
    expect(seen).toHaveLength(1);
    const req = seen[0];
    expect(req.kind).toBe('confirm');
    expect(req.title).toBe('Void this invoice?');
    // destructive wording defaults to the danger style
    expect(req.kind === 'confirm' && req.tone).toBe('danger');
    if (req.kind === 'confirm') req.resolve(true);
    expect(await pending).toBe(true);
    off();
  });

  it('asks for a reason and returns null when cancelled', async () => {
    const seen: DialogRequest[] = [];
    const off = subscribeDialogs({ dialog: (d) => seen.push(d), toast: () => {} });
    const pending = askReason({ title: 'Why are you voiding this?' });
    const req = seen[0];
    expect(req.kind).toBe('reason');
    if (req.kind === 'reason') req.resolve(null);
    expect(await pending).toBeNull();
    off();
  });

  it('sends notifications to the host', () => {
    const toasts: Toast[] = [];
    const off = subscribeDialogs({ dialog: () => {}, toast: (t) => toasts.push(t) });
    notify('Saved', 'success');
    expect(toasts.map((t) => [t.message, t.tone])).toEqual([['Saved', 'success']]);
    off();
  });
});
