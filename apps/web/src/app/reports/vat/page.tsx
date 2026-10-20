'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest, ApiError } from '@/lib/api';
import { formatMoney, isNegativeDecimal } from '@/lib/money-format';
import { recentQuarters, vatDueDate } from '@/lib/vat-quarters';
import {
  Callout,
  EmptyState,
  Page,
  PageHeader,
  Panel,
  SkeletonRows,
  StatusBadge,
} from '@/components/ui/page';

type VatBox = 'box1' | 'box2' | 'box3' | 'box4' | 'box5' | 'box6' | 'box7' | 'box8' | 'box9';

interface VatReturnReport {
  from: string;
  to: string;
  scheme: string;
  flatRatePercent: string | null;
  boxes: Record<VatBox, string>;
  lineCount: number;
  unsupportedBoxes: VatBox[];
  reconciliation: { vatControlMovement: string; box5: string; difference: string; reconciled: boolean };
}

interface VatBoxLine {
  journalLineId: string;
  journalId: string;
  journalNumber: string;
  postingDate: string;
  description: string | null;
  accountCode: string;
  accountName: string;
  taxCode: string;
  net: string;
  vat: string;
  amount: string;
}

const BOXES: { box: VatBox; title: string; wholePounds?: boolean }[] = [
  { box: 'box1', title: 'VAT due on sales' },
  { box: 'box2', title: 'VAT due on EU acquisitions (NI)' },
  { box: 'box3', title: 'Total VAT due' },
  { box: 'box4', title: 'VAT reclaimed on purchases' },
  { box: 'box5', title: 'Net VAT to pay or reclaim' },
  { box: 'box6', title: 'Total sales excluding VAT', wholePounds: true },
  { box: 'box7', title: 'Total purchases excluding VAT', wholePounds: true },
  { box: 'box8', title: 'Goods supplied to the EU (NI)', wholePounds: true },
  { box: 'box9', title: 'Goods acquired from the EU (NI)', wholePounds: true },
];

/** Boxes the API can drill into (standard basis only). */
const DRILLABLE = new Set<VatBox>(['box1', 'box4', 'box6', 'box7']);

const SCHEME_LABEL: Record<string, string> = {
  STANDARD_ACCRUAL: 'Standard, accrual basis',
  STANDARD: 'Standard',
  CASH_ACCOUNTING: 'Cash accounting',
  FLAT_RATE: 'Flat Rate Scheme',
};

const STAGGERS = [
  { value: 1, label: 'Jan · Apr · Jul · Oct' },
  { value: 2, label: 'Feb · May · Aug · Nov' },
  { value: 3, label: 'Mar · Jun · Sep · Dec' },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((isoToUtc(toIso) - isoToUtc(fromIso)) / 86_400_000);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatWholePounds(value: string): string {
  return formatMoney(value).replace(/\.\d\d(\))?$/, '$1');
}

export default function VatReturnPage() {
  const { activeOrg } = useAuth();
  const [stagger, setStagger] = useState(1);
  const today = useMemo(todayIso, []);
  const quarters = useMemo(() => recentQuarters(today, 8, stagger), [today, stagger]);
  // Default to the last completed quarter — the one you'd normally be filing.
  const [quarterIdx, setQuarterIdx] = useState(1);
  const quarter = quarters[quarterIdx] ?? quarters[0];

  const [report, setReport] = useState<VatReturnReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);

  const [openBox, setOpenBox] = useState<VatBox | null>(null);
  const [lines, setLines] = useState<VatBoxLine[] | null>(null);
  const [linesError, setLinesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg || !quarter) return;
    setLoading(true);
    setError(null);
    setOpenBox(null);
    try {
      setReport(await apiRequest<VatReturnReport>(`/vat-return?from=${quarter.from}&to=${quarter.to}`));
    } catch (e) {
      const forbidden = e instanceof ApiError && e.status === 403;
      setError({ message: e instanceof Error ? e.message : 'Could not load the VAT return', forbidden });
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [activeOrg, quarter]);

  useEffect(() => {
    load();
  }, [load]);

  const showLines = async (box: VatBox) => {
    if (!quarter) return;
    if (openBox === box) {
      setOpenBox(null);
      return;
    }
    setOpenBox(box);
    setLines(null);
    setLinesError(null);
    try {
      setLines(
        await apiRequest<VatBoxLine[]>(
          `/vat-return/boxes/${box}/lines?from=${quarter.from}&to=${quarter.to}`,
        ),
      );
    } catch (e) {
      setLinesError(e instanceof Error ? e.message : 'Could not load the lines behind this box');
    }
  };

  const due = quarter ? vatDueDate(quarter.to) : null;
  const daysToDue = due ? daysBetween(today, due) : null;
  const periodOpen = quarter ? quarter.to >= today : false;
  const box5Negative = report ? isNegativeDecimal(report.boxes.box5) : false;
  const isFlatRate = report?.scheme === 'FLAT_RATE';

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="VAT return"
          breadcrumb={[{ label: 'Reports', href: '/reports' }, { label: 'VAT return' }]}
          description="The nine boxes HMRC asks for, calculated from your posted ledger and cross-checked against your VAT control account."
          actions={
            <>
              <label className="bl-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span>Quarters</span>
                <select
                  className="bl-select"
                  value={stagger}
                  onChange={(e) => {
                    setStagger(Number(e.target.value));
                    setQuarterIdx(1);
                  }}
                >
                  {STAGGERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="bl-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span>Period</span>
                <select
                  className="bl-select"
                  value={quarterIdx}
                  onChange={(e) => setQuarterIdx(Number(e.target.value))}
                >
                  {quarters.map((q, i) => (
                    <option key={q.from} value={i}>
                      {q.label}
                      {i === 0 ? ' (in progress)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
        />

        {quarter && due && daysToDue !== null && (
          <div className="bl-actions">
            {periodOpen ? (
              <StatusBadge tone="neutral">Period still open — figures will change</StatusBadge>
            ) : daysToDue < 0 ? (
              <StatusBadge tone="danger">Was due {formatDate(due)}</StatusBadge>
            ) : (
              <StatusBadge tone={daysToDue <= 14 ? 'warning' : 'info'}>
                Due {formatDate(due)} · {daysToDue} {daysToDue === 1 ? 'day' : 'days'} left
              </StatusBadge>
            )}
            {report && (
              <StatusBadge tone="neutral">{SCHEME_LABEL[report.scheme] ?? report.scheme}</StatusBadge>
            )}
          </div>
        )}

        {loading ? (
          <Panel>
            <SkeletonRows rows={6} />
          </Panel>
        ) : error ? (
          error.forbidden ? (
            <EmptyState title="You don't have access to VAT returns">
              Ask an Owner or Accountant in {activeOrg?.name ?? 'this company'} to give your role the “View
              VAT return” permission.
            </EmptyState>
          ) : (
            <Callout tone="danger" role="alert" title="We couldn't load this VAT return.">
              {error.message}. Nothing was changed.{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                Try again
              </button>
            </Callout>
          )
        ) : report && report.lineCount === 0 ? (
          <EmptyState
            title={`No VAT transactions in ${quarter?.label}`}
            action={
              <Link href="/sales/invoices/new" className="btn btn-primary">
                Create an invoice
              </Link>
            }
          >
            Posted invoices, bills and bank items with a VAT code will appear here automatically.
          </EmptyState>
        ) : report ? (
          <>
            <Panel
              title={
                <>
                  {box5Negative ? 'HMRC owes you ' : 'To pay HMRC '}
                  <span className="bl-money">{formatMoney(report.boxes.box5.replace(/^-/, ''))}</span>
                </>
              }
            >
              <div
                className="bl-grid"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}
              >
                {BOXES.map(({ box, title, wholePounds }) => {
                  const unsupported = report.unsupportedBoxes.includes(box);
                  const drillable = DRILLABLE.has(box) && !isFlatRate;
                  const value = wholePounds
                    ? formatWholePounds(report.boxes[box])
                    : formatMoney(report.boxes[box]);
                  const content = (
                    <>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                        Box {box.slice(3)} · {title}
                      </span>
                      <span
                        className="bl-money"
                        style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}
                      >
                        {value}
                      </span>
                      {unsupported && (
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                          Not supported yet — always £0
                        </span>
                      )}
                      {drillable && (
                        <span style={{ fontSize: 12, color: 'var(--action-text)', fontWeight: 600 }}>
                          {openBox === box ? 'Hide lines' : 'See lines'}
                        </span>
                      )}
                    </>
                  );
                  const boxStyle: React.CSSProperties = {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border:
                      box === 'box5' || openBox === box
                        ? '2px solid var(--primary)'
                        : '1px solid var(--border-subtle)',
                    background: '#fff',
                    textAlign: 'left',
                    font: 'inherit',
                  };
                  return drillable ? (
                    <button
                      key={box}
                      type="button"
                      onClick={() => showLines(box)}
                      aria-expanded={openBox === box}
                      style={{ ...boxStyle, cursor: 'pointer' }}
                    >
                      {content}
                    </button>
                  ) : (
                    <div key={box} style={boxStyle}>
                      {content}
                    </div>
                  );
                })}
              </div>
              {report.flatRatePercent && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                  Box 1 uses your flat rate of {report.flatRatePercent}% of VAT-inclusive turnover.
                </p>
              )}
            </Panel>

            {openBox && (
              <Panel title={`Lines behind box ${openBox.slice(3)}`}>
                {linesError ? (
                  <Callout tone="danger" role="alert">
                    {linesError}
                  </Callout>
                ) : !lines ? (
                  <SkeletonRows rows={4} />
                ) : lines.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--ink-2)' }}>No lines contribute to this box.</p>
                ) : (
                  <div className="bl-table-wrap">
                    <table className="bl-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Journal</th>
                          <th>Description</th>
                          <th>Account</th>
                          <th>Code</th>
                          <th style={{ textAlign: 'right' }}>Net</th>
                          <th style={{ textAlign: 'right' }}>VAT</th>
                          <th style={{ textAlign: 'right' }}>In this box</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l) => (
                          <tr key={l.journalLineId}>
                            <td>{formatDate(l.postingDate)}</td>
                            <td>
                              <Link href={`/accounting/journals/${l.journalId}`} className="bl-money">
                                {l.journalNumber}
                              </Link>
                            </td>
                            <td>{l.description ?? '—'}</td>
                            <td>
                              {l.accountCode} · {l.accountName}
                            </td>
                            <td>{l.taxCode}</td>
                            <td className="num">{formatMoney(l.net)}</td>
                            <td className="num">{formatMoney(l.vat)}</td>
                            <td className="num">{formatMoney(l.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            )}

            <Panel title="Before you submit">
              <ul className="bl-checklist">
                <li>
                  <span
                    aria-hidden="true"
                    style={{
                      color: report.reconciliation.reconciled ? 'var(--success)' : 'var(--danger)',
                      fontWeight: 700,
                    }}
                  >
                    {report.reconciliation.reconciled ? '✓' : '!'}
                  </span>
                  <span>
                    {report.reconciliation.reconciled ? (
                      <>Box 5 matches the movement on your VAT control account.</>
                    ) : (
                      <>
                        Box 5 is{' '}
                        <strong className="bl-money">{formatMoney(report.reconciliation.difference)}</strong>{' '}
                        different from your VAT control account (
                        {formatMoney(report.reconciliation.vatControlMovement)}). Check for journals posted
                        directly to the VAT account in this period.
                      </>
                    )}
                  </span>
                </li>
                <li>
                  <span aria-hidden="true" style={{ color: 'var(--ink-2)', fontWeight: 700 }}>
                    ○
                  </span>
                  <span>
                    Reconcile every bank account to {quarter ? formatDate(quarter.to) : 'the period end'} —{' '}
                    <Link href="/banking/reconciliation">Reconcile</Link>
                  </span>
                </li>
                <li>
                  <span aria-hidden="true" style={{ color: 'var(--ink-2)', fontWeight: 700 }}>
                    ○
                  </span>
                  <span>
                    Approve or reject any AI drafts dated in this period —{' '}
                    <Link href="/purchases/review">Inbox</Link>
                  </span>
                </li>
              </ul>
              <Callout tone="info">
                Submitting to HMRC from Blynt (Making Tax Digital) isn’t available yet. Use these figures in
                your bridging software or the HMRC service, then lock the period in{' '}
                <Link href="/accounting/periods">Accounting periods</Link> so they can’t change.
              </Callout>
            </Panel>
          </>
        ) : null}
      </Page>
    </AppShell>
  );
}
