import React from 'react';
import Link from 'next/link';
import { Callout, Page, PageHeader, Panel } from './page';

interface PlannedFeatureProps {
  title: string;
  breadcrumb: { label: string; href?: string }[];
  /** One line: the question this page will answer for the person. */
  purpose: string;
  /** What the finished page will do — plain language, no promises of dates. */
  willDo: string[];
  /** Real pages that cover the need today. */
  today: { label: string; href: string; note?: string }[];
}

/**
 * Honest placeholder for a page that is in the menu but not built yet.
 * Replaces the old dead links: it explains what's coming and routes people to what works today.
 * Never shows sample numbers.
 */
export function PlannedFeature({ title, breadcrumb, purpose, willDo, today }: PlannedFeatureProps) {
  return (
    <Page>
      <PageHeader title={title} breadcrumb={breadcrumb} description={purpose} />
      <Callout tone="info" title="This page is being built.">
        Nothing here changes your books yet. Until it’s ready, use the links below.
      </Callout>
      <div className="bl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Panel title="What it will do">
          <ul className="bl-checklist">
            {willDo.map((line) => (
              <li key={line}>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                  ○
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="What you can do today">
          <ul className="bl-checklist">
            {today.map((t) => (
              <li key={t.href}>
                <span aria-hidden="true" style={{ color: 'var(--success)' }}>
                  →
                </span>
                <span>
                  <Link href={t.href} style={{ fontWeight: 600 }}>
                    {t.label}
                  </Link>
                  {t.note && <span style={{ color: 'var(--ink-2)' }}> — {t.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
