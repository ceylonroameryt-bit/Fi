'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Search, Sparkles } from 'lucide-react';
import { searchEntries, type SearchEntry } from '@/lib/navigation';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  index: SearchEntry[];
  /** Hand the typed text to the AI assistant. Omit to hide the "Ask Blynt" row. */
  onAsk?: (query: string) => void;
}

type Row = { kind: 'ask'; id: string; query: string } | { kind: 'entry'; id: string; entry: SearchEntry };

/**
 * ⌘K: one box to find any page or start any action.
 * Recognition over recall — people type what they want instead of remembering where it lives.
 */
export function CommandPalette({ open, onClose, index, onAsk }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      restoreFocusRef.current?.focus?.();
    }
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const results = searchEntries(index, query, query.trim() ? 12 : 8);
    const out: Row[] = [];
    if (onAsk && query.trim().length > 2) out.push({ kind: 'ask', id: 'ask', query: query.trim() });
    for (const entry of results)
      out.push({ kind: 'entry', id: `${entry.group}:${entry.href}:${entry.title}`, entry });
    return out;
  }, [index, query, onAsk]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const run = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    if (row.kind === 'ask') onAsk?.(row.query);
    else router.push(row.entry.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(rows[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Render group headings between rows.
  let lastGroup = '';
  const activeId = rows[active] ? `bl-cmd-${active}` : undefined;

  return (
    <div className="bl-palette-backdrop" onMouseDown={onClose}>
      <div
        className="bl-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="bl-palette-input">
          <Search size={20} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages or type what you want to do…"
            aria-label="Search pages and actions"
            role="combobox"
            aria-expanded="true"
            aria-controls="bl-cmd-list"
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="bl-kbd">Esc</span>
        </div>

        <div className="bl-palette-list" id="bl-cmd-list" role="listbox" ref={listRef}>
          {rows.length === 0 && (
            <div className="bl-palette-empty">
              Nothing matches “{query}”. Try a page name like <strong>invoices</strong> or{' '}
              <strong>VAT</strong>.
            </div>
          )}
          {rows.map((row, i) => {
            const group = row.kind === 'ask' ? 'Ask Blynt' : row.entry.group;
            const heading = group !== lastGroup ? group : null;
            lastGroup = group;
            return (
              <React.Fragment key={row.id}>
                {heading && <div className="bl-palette-group">{heading}</div>}
                <div
                  id={`bl-cmd-${i}`}
                  data-row={i}
                  role="option"
                  aria-selected={i === active}
                  className={`bl-palette-row ${row.kind === 'ask' ? 'is-ai' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(row)}
                >
                  <span className="bl-palette-icon" aria-hidden="true">
                    {row.kind === 'ask' ? (
                      <Sparkles size={16} />
                    ) : row.entry.group === 'Actions' ? (
                      <Plus size={16} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
                  {row.kind === 'ask' ? (
                    <span>
                      Ask Blynt: <strong>{row.query}</strong>
                    </span>
                  ) : (
                    <>
                      <span>{row.entry.title}</span>
                      {row.entry.context && <span className="bl-palette-ctx">{row.entry.context}</span>}
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="bl-palette-foot" aria-hidden="true">
          <span>
            <span className="bl-kbd">↑</span>
            <span className="bl-kbd">↓</span> move
          </span>
          <span>
            <span className="bl-kbd">↵</span> open
          </span>
          <span>
            <span className="bl-kbd">Esc</span> close
          </span>
        </div>
      </div>
    </div>
  );
}
