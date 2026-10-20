/**
 * App-wide replacement for window.alert / confirm / prompt.
 * Pages call confirmAction / askReason / notify; <DialogHost/> (mounted in AppShell)
 * renders accessible in-app dialogs and notifications. If no host is mounted
 * (e.g. a page outside the shell), it falls back to the browser dialogs so nothing breaks.
 */

export type Tone = 'primary' | 'danger';

export interface ConfirmRequest {
  kind: 'confirm';
  id: number;
  title: string;
  message?: string;
  confirmLabel: string;
  tone: Tone;
  resolve: (ok: boolean) => void;
}

export interface ReasonRequest {
  kind: 'reason';
  id: number;
  title: string;
  message?: string;
  label: string;
  confirmLabel: string;
  tone: Tone;
  resolve: (reason: string | null) => void;
}

export type DialogRequest = ConfirmRequest | ReasonRequest;

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'danger' | 'info';
}

type Listener = { dialog: (d: DialogRequest) => void; toast: (t: Toast) => void };

let nextId = 1;
const listeners = new Set<Listener>();

export function subscribeDialogs(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Splits "Post INV-1 to the ledger? This creates postings." into a title and a body. */
export function splitMessage(text: string): { title: string; message?: string } {
  const m = /^(.+?[?.!])\s+(.+)$/s.exec(text.trim());
  if (!m) return { title: text.trim() };
  return { title: m[1], message: m[2] };
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: Tone;
}

export function confirmAction(opts: string | ConfirmOptions): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === 'string' ? splitMessage(opts) : opts;
  if (listeners.size === 0) {
    return Promise.resolve(
      typeof window !== 'undefined'
        ? window.confirm([o.title, o.message].filter(Boolean).join('\n\n'))
        : false,
    );
  }
  return new Promise((resolve) => {
    const req: ConfirmRequest = {
      kind: 'confirm',
      id: nextId++,
      title: o.title,
      message: o.message,
      confirmLabel: o.confirmLabel ?? 'Continue',
      tone: o.tone ?? (/(void|delete|remove|archive|lock|reverse)/i.test(o.title) ? 'danger' : 'primary'),
      resolve,
    };
    listeners.forEach((l) => l.dialog(req));
  });
}

interface ReasonOptions {
  title: string;
  message?: string;
  label?: string;
  confirmLabel?: string;
  tone?: Tone;
}

/** Asks for a short reason (kept in the audit log). Resolves null if cancelled. */
export function askReason(opts: string | ReasonOptions): Promise<string | null> {
  const o: ReasonOptions = typeof opts === 'string' ? splitMessage(opts) : opts;
  if (listeners.size === 0) {
    return Promise.resolve(
      typeof window !== 'undefined' ? window.prompt([o.title, o.message].filter(Boolean).join('\n\n')) : null,
    );
  }
  return new Promise((resolve) => {
    const req: ReasonRequest = {
      kind: 'reason',
      id: nextId++,
      title: o.title,
      message: o.message,
      label: o.label ?? 'Reason (kept in the audit log)',
      confirmLabel: o.confirmLabel ?? 'Continue',
      tone: o.tone ?? 'danger',
      resolve,
    };
    listeners.forEach((l) => l.dialog(req));
  });
}

export function notify(message: string, tone: Toast['tone'] = 'danger'): void {
  if (listeners.size === 0) {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  const t: Toast = { id: nextId++, message, tone };
  listeners.forEach((l) => l.toast(t));
}
