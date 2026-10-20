'use client';

import React, { useEffect, useRef, useState } from 'react';
import { subscribeDialogs, type DialogRequest, type Toast } from '@/lib/dialog-bus';

const TOAST_MS = 6000;

/** Renders confirmAction / askReason dialogs and notify() toasts. Mount once (AppShell). */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reason, setReason] = useState('');
  const firstRef = useRef<HTMLButtonElement | HTMLTextAreaElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(
    () =>
      subscribeDialogs({
        dialog: (d) => setQueue((q) => [...q, d]),
        toast: (t) => {
          setToasts((ts) => [...ts.slice(-2), t]);
          setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), TOAST_MS);
        },
      }),
    [],
  );

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    setReason('');
    requestAnimationFrame(() => firstRef.current?.focus());
  }, [current]);

  const close = (answer: boolean) => {
    if (!current) return;
    if (current.kind === 'confirm') current.resolve(answer);
    else current.resolve(answer ? reason.trim() || null : null);
    setQueue((q) => q.slice(1));
    restoreRef.current?.focus?.();
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, reason]);

  return (
    <>
      {current && (
        <div className="bl-dialog-backdrop" onMouseDown={() => close(false)}>
          <form
            className="bl-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bl-host-title"
            aria-describedby={current.message ? 'bl-host-msg' : undefined}
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (current.kind === 'reason' && !reason.trim()) return;
              close(true);
            }}
          >
            <h2 id="bl-host-title" className="bl-dialog-title">
              {current.title}
            </h2>
            {current.message && (
              <p id="bl-host-msg" className="bl-dialog-body" style={{ margin: 0 }}>
                {current.message}
              </p>
            )}
            {current.kind === 'reason' && (
              <label className="bl-field">
                <span>{current.label}</span>
                <textarea
                  ref={(el) => {
                    firstRef.current = el;
                  }}
                  className="bl-input"
                  style={{ height: 80, padding: 10, resize: 'vertical' }}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  required
                />
              </label>
            )}
            <div className="bl-actions" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => close(false)}
                ref={
                  current.kind === 'confirm'
                    ? (el) => {
                        firstRef.current = el;
                      }
                    : undefined
                }
              >
                Cancel
              </button>
              <button
                type="submit"
                className={current.tone === 'danger' ? 'btn btn-danger-solid' : 'btn btn-primary'}
                disabled={current.kind === 'reason' && !reason.trim()}
              >
                {current.confirmLabel}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="bl-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bl-toast bl-toast--${t.tone}`}
            role={t.tone === 'danger' ? 'alert' : 'status'}
          >
            <span aria-hidden="true">{t.tone === 'success' ? '✓' : t.tone === 'danger' ? '!' : 'i'}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
