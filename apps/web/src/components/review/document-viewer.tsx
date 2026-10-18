'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { apiFetchBlob } from '@/lib/api';

export interface HighlightBox {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ViewerPage {
  pageNumber: number;
  width: number | null;
  height: number | null;
  text: string;
  words: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>;
}

interface Props {
  documentId: string;
  fileName: string;
  mimeType: string;
  pages: ViewerPage[];
  extractedText: string | null;
  /** Boxes of the field the reviewer is looking at. */
  highlight: HighlightBox[];
  /** Fallback for plain-text documents (no word positions): the text to mark. */
  highlightText: string | null;
}

const A4_RATIO = 842 / 595;

function Overlay({ boxes }: { boxes: HighlightBox[] }) {
  const first = useRef<HTMLDivElement>(null);
  useEffect(() => {
    first.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [boxes]);
  return (
    <>
      {boxes.map((b, i) => (
        <div
          key={i}
          ref={i === 0 ? first : undefined}
          aria-hidden
          style={{
            position: 'absolute',
            left: `${b.x0 * 100}%`,
            top: `${b.y0 * 100}%`,
            width: `${Math.max(b.x1 - b.x0, 0.01) * 100}%`,
            height: `${Math.max(b.y1 - b.y0, 0.008) * 100}%`,
            background: 'rgba(250, 204, 21, 0.35)',
            outline: '2px solid #EAB308',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
}

/**
 * Shows the uploaded document beside the review form and highlights where the selected value was
 * read. Photos are shown as-is with boxes on top; PDFs are shown as a positioned reconstruction of
 * their words (with a link to the original file).
 */
export function DocumentViewer({ documentId, fileName, mimeType, pages, extractedText, highlight, highlightText }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    apiFetchBlob(`/ai/documents/${documentId}/file`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
      <strong style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</strong>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <ExternalLink size={14} /> Open original
        </a>
      )}
    </div>
  );

  if (error) return <div className="alert alert-danger">{error}</div>;

  if (mimeType.startsWith('image/')) {
    return (
      <div>
        {header}
        <div style={{ position: 'relative', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL of the user's own upload; next/image cannot optimise it */}
          {url ? <img src={url} alt={fileName} style={{ display: 'block', width: '100%' }} /> : <div style={{ padding: '2rem' }}>Loading…</div>}
          <Overlay boxes={highlight.filter((b) => b.page === 1)} />
        </div>
      </div>
    );
  }

  const positioned = pages.filter((p) => p.words.length > 0);
  if (positioned.length > 0) {
    return (
      <div>
        {header}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {positioned.map((p) => {
            const ratio = p.width && p.height ? p.height / p.width : A4_RATIO;
            return (
              <div
                key={p.pageNumber}
                aria-label={`Page ${p.pageNumber}`}
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: `1 / ${ratio}`,
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
                  containerType: 'inline-size',
                }}
              >
                {p.words.map((w, i) => (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${w.x0 * 100}%`,
                      top: `${w.y0 * 100}%`,
                      fontSize: `${Math.max((w.y1 - w.y0) * ratio * 100 * 0.85, 0.8)}cqw`,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      color: '#0F172A',
                      fontFamily: 'Helvetica, Arial, sans-serif',
                    }}
                  >
                    {w.text}
                  </span>
                ))}
                <Overlay boxes={highlight.filter((b) => b.page === p.pageNumber)} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Plain text (or no positions): show the text and mark the selected value.
  const text = extractedText ?? '';
  const idx = highlightText ? text.toLowerCase().indexOf(highlightText.toLowerCase()) : -1;
  return (
    <div>
      {header}
      <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', border: '1px solid #E2E8F0', padding: '1rem', borderRadius: 6, fontSize: '0.85rem' }}>
        {idx >= 0 ? (
          <>
            {text.slice(0, idx)}
            <mark style={{ background: 'rgba(250, 204, 21, 0.5)' }}>{text.slice(idx, idx + highlightText!.length)}</mark>
            {text.slice(idx + highlightText!.length)}
          </>
        ) : (
          text
        )}
      </pre>
    </div>
  );
}

export function StatusBadge({ status }: { status: 'verified' | 'inconsistent' | 'missing' | string }) {
  const style: Record<string, React.CSSProperties> = {
    verified: { background: '#DCFCE7', color: '#166534' },
    inconsistent: { background: '#FEE2E2', color: '#991B1B' },
    missing: { background: '#F1F5F9', color: '#475569' },
  };
  return (
    <span style={{ ...(style[status] ?? style.missing), fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: 999, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}
