'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { apiRequest, ApiError } from '@/lib/api';
import { addDecimals, isPositiveDecimal, toUnits } from '@/lib/decimal';
import { formatMoney, isNegativeDecimal } from '@/lib/money-format';
import {
  attentionItems,
  cashPosition,
  greeting,
  monthRanges,
  overdueSummary,
  periodToClose,
  safeToSpend,
  type AgeingReportLite,
  type AttentionTone,
  type BankAccountSummary,
  type PeriodLite,
} from '@/lib/dashboard';
import { Callout, EmptyState, Page, Panel, SkeletonRows } from '@/components/ui/page';
import {
  DashboardCustomizerModal,
  DashboardPreferences,
  DEFAULT_DASHBOARD_PREFERENCES,
} from '@/components/dashboard/dashboard-customizer-modal';

interface PnlSection {
  total: string;
}
interface PnlReport {
  revenue: PnlSection;
  costOfSales: PnlSection;
  operatingExpenses: PnlSection;
  otherExpenses: PnlSection;
  netProfit: string;
}

interface AgeingReport extends AgeingReportLite {
  groups: {
    contactId: string;
    contactName: string;
    items: { id: string; referenceNumber: string; dueDate: string; amountDue: string; daysOverdue: number }[];
  }[];
}

/** Each card loads on its own: one slow or forbidden report never blanks the page. */
type Load<T> =
  | { state: 'loading' }
  | { state: 'ok'; data: T }
  | { state: 'error'; message: string }
  | { state: 'forbidden' };

const LOADING = { state: 'loading' } as const;

function settle<T>(p: Promise<T>): Promise<Load<T>> {
  return p.then(
    (data) => ({ state: 'ok', data }) as Load<T>,
    (e) =>
      e instanceof ApiError && e.status === 403
        ? ({ state: 'forbidden' } as Load<T>)
        : ({ state: 'error', message: e instanceof Error ? e.message : 'Could not load' } as Load<T>),
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function costsOf(p: PnlReport): string {
  return addDecimals(p.costOfSales?.total, p.operatingExpenses?.total, p.otherExpenses?.total);
}

const TONE_STYLE: Record<AttentionTone, { bg: string; fg: string; symbol: string }> = {
  ai: { bg: 'var(--action-soft)', fg: 'var(--action-text)', symbol: '✦' },
  danger: { bg: 'var(--danger-bg)', fg: 'var(--danger)', symbol: '!' },
  warning: { bg: 'var(--warning-bg)', fg: 'var(--warning-text)', symbol: '◷' },
  info: { bg: 'var(--info-bg)', fg: 'var(--primary)', symbol: '→' },
};

const EDITOR_ROLES = new Set(['OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'BOOKKEEPER']);

export default function DashboardPage() {
  const { user, activeOrg, activeRole } = useAuth();
  const currency = activeOrg?.baseCurrency ?? 'GBP';
  const money = useCallback((v: string | null | undefined) => formatMoney(v, { currency }), [currency]);
  const isEditor = !!activeRole?.systemKey && EDITOR_ROLES.has(activeRole.systemKey);

  const [prefs, setPrefs] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES);
  const [showCustomizer, setShowCustomizer] = useState(false);

  const [bank, setBank] = useState<Load<BankAccountSummary[]>>(LOADING);
  const [ar, setAr] = useState<Load<AgeingReport>>(LOADING);
  const [ap, setAp] = useState<Load<AgeingReport>>(LOADING);
  const [pnl, setPnl] = useState<Load<{ thisMonth: PnlReport; lastMonth: PnlReport }>>(LOADING);
  const [trend, setTrend] = useState<Load<{ label: string; income: string; costs: string }[]>>(LOADING);
  const [review, setReview] = useState<Load<unknown[]>>(LOADING);
  const [periods, setPeriods] = useState<Load<PeriodLite[]>>(LOADING);

  const today = useMemo(todayIso, []);

  useEffect(() => {
    if (!activeOrg?.id) return;
    try {
      const stored = localStorage.getItem(`blynt_dash_prefs_${activeOrg.id}`);
      setPrefs(
        stored ? { ...DEFAULT_DASHBOARD_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_DASHBOARD_PREFERENCES,
      );
    } catch {
      setPrefs(DEFAULT_DASHBOARD_PREFERENCES);
    }
  }, [activeOrg?.id]);

  const updatePrefs = (next: DashboardPreferences) => {
    setPrefs(next);
    if (!activeOrg?.id) return;
    try {
      localStorage.setItem(`blynt_dash_prefs_${activeOrg.id}`, JSON.stringify(next));
    } catch {
      /* storage unavailable — keep for this visit only */
    }
  };

  const load = useCallback(() => {
    if (!activeOrg) return;
    const { thisMonth, lastMonth } = monthRanges(today);
    setBank(LOADING);
    setAr(LOADING);
    setAp(LOADING);
    setPnl(LOADING);
    setTrend(LOADING);
    setReview(LOADING);
    setPeriods(LOADING);

    settle(apiRequest<BankAccountSummary[]>('/bank-accounts')).then(setBank);
    settle(apiRequest<AgeingReport>(`/reports/ar-ageing?asOfDate=${today}`)).then(setAr);
    settle(apiRequest<AgeingReport>(`/reports/ap-ageing?asOfDate=${today}`)).then(setAp);
    settle(
      Promise.all([
        apiRequest<PnlReport>(`/reports/profit-and-loss?startDate=${thisMonth.from}&endDate=${thisMonth.to}`),
        apiRequest<PnlReport>(`/reports/profit-and-loss?startDate=${lastMonth.from}&endDate=${lastMonth.to}`),
      ]).then(([a, b]) => ({ thisMonth: a, lastMonth: b })),
    ).then(setPnl);

    // Six whole months ending with the current month (to date).
    const months: { label: string; from: string; to: string }[] = [];
    let cursor = today;
    for (let i = 0; i < 6; i++) {
      const r = monthRanges(cursor);
      const [y, m] = r.thisMonth.from.split('-').map(Number);
      const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
        month: 'short',
        timeZone: 'UTC',
      });
      months.unshift({ label, from: r.thisMonth.from, to: i === 0 ? today : r.thisMonth.to });
      cursor = r.lastMonth.to;
    }
    settle(
      Promise.all(
        months.map((mo) =>
          apiRequest<PnlReport>(`/reports/profit-and-loss?startDate=${mo.from}&endDate=${mo.to}`).then(
            (p) => ({
              label: mo.label,
              income: p.revenue?.total ?? '0',
              costs: costsOf(p),
            }),
          ),
        ),
      ),
    ).then(setTrend);

    if (isEditor) settle(apiRequest<unknown[]>('/ai/review-queue')).then(setReview);
    else setReview({ state: 'ok', data: [] });
    settle(apiRequest<PeriodLite[]>('/accounting-periods')).then(setPeriods);
  }, [activeOrg, today, isEditor]);

  useEffect(() => {
    load();
  }, [load]);

  const cash = bank.state === 'ok' ? cashPosition(bank.data) : null;
  const receivables = ar.state === 'ok' ? overdueSummary(ar.data) : null;
  const payables = ap.state === 'ok' ? overdueSummary(ap.data) : null;
  const closePeriod = periods.state === 'ok' && isEditor ? periodToClose(periods.data, today) : null;
  const reviewCount = review.state === 'ok' && Array.isArray(review.data) ? review.data.length : null;

  const todo = attentionItems({
    reviewCount,
    receivables,
    payables,
    unmatchedBankLines: cash?.unmatched ?? null,
    closePeriod,
    formatMoney: (v) => money(v),
  });
  const todoLoading = [bank, ar, ap, review].some((l) => l.state === 'loading');

  const firstName = user?.firstName?.trim();
  const hello = `${greeting(new Date().getHours())}${firstName ? `, ${firstName}` : ''}`;
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const showPnlTiles = prefs.kpiIncome || prefs.kpiExpenses || prefs.kpiProfit;
  const showChart = prefs.chartCashFlow || prefs.chartIncomeExpenses;
  const nothingYet =
    bank.state === 'ok' &&
    bank.data.length === 0 &&
    ar.state === 'ok' &&
    ar.data.summaryTotals &&
    !isPositiveDecimal(ar.data.summaryTotals.total);

  return (
    <AppShell>
      <Page>
        {/* Greeting: one sentence that says how things are and how much work is waiting. */}
        <div className="bl-page-header">
          <div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{dateLine}</p>
            <h1 className="bl-page-title" style={{ fontSize: 28 }}>
              {hello}
            </h1>
            <p className="bl-page-desc" aria-live="polite">
              {todoLoading
                ? 'Checking what needs you…'
                : todo.length === 0
                  ? 'You’re all caught up. Nothing needs you right now.'
                  : `${todo.length} ${todo.length === 1 ? 'thing needs' : 'things need'} you today.`}
            </p>
          </div>
          <div className="bl-actions">
            {prefs.quickActions && isEditor && (
              <>
                <Link href="/sales/invoices/new" className="btn btn-primary">
                  New invoice
                </Link>
                <Link href="/accounting/documents" className="btn btn-secondary">
                  Upload receipt
                </Link>
              </>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setShowCustomizer(true)}>
              Customise
            </button>
          </div>
        </div>

        {nothingYet && isEditor && (
          <EmptyState
            title="Let's get your numbers in"
            action={
              <div className="bl-actions" style={{ justifyContent: 'center' }}>
                <Link href="/banking/accounts" className="btn btn-primary">
                  Add a bank account
                </Link>
                <Link href="/sales/invoices/new" className="btn btn-secondary">
                  Create an invoice
                </Link>
              </div>
            }
          >
            Your dashboard fills in as transactions arrive. Start with your bank — it’s how Blynt does most of
            the work for you.
          </EmptyState>
        )}

        {/* Row 1: what needs doing + what you can safely spend */}
        <div className="bl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <Panel title="Needs your attention" style={{ gridColumn: 'span 2' }}>
            {todoLoading ? (
              <SkeletonRows rows={4} />
            ) : todo.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink-2)' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 99,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--success-bg)',
                    color: 'var(--success-text)',
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
                No overdue invoices, no drafts waiting, no bank lines to confirm.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {todo.map((item, i) => {
                  const t = TONE_STYLE[item.tone];
                  return (
                    <li
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 0',
                        borderTop: i ? '1px solid var(--line-soft)' : 'none',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: t.bg,
                          color: t.fg,
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 700,
                          flex: 'none',
                        }}
                      >
                        {t.symbol}
                      </span>
                      <span style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: 14.5 }}>{item.title}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.detail}</span>
                      </span>
                      <Link
                        href={item.href}
                        className={i === 0 ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                      >
                        {item.action}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {prefs.kpiCash && (
            <section
              aria-labelledby="safe-h"
              style={{
                background: 'var(--primary)',
                color: '#fff',
                borderRadius: 16,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minWidth: 0,
              }}
            >
              <h2 id="safe-h" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#C9D2E6' }}>
                Safe to spend
              </h2>
              {bank.state === 'loading' || ap.state === 'loading' ? (
                <span className="bl-skeleton" style={{ height: 36, width: '70%', opacity: 0.3 }} />
              ) : bank.state === 'forbidden' ? (
                <p style={{ margin: 0, color: '#C9D2E6', fontSize: 14 }}>
                  Your role can’t see bank balances.
                </p>
              ) : bank.state === 'error' ? (
                <p style={{ margin: 0, color: '#FFB4A8', fontSize: 14 }}>Couldn’t load bank balances.</p>
              ) : cash && cash.count === 0 ? (
                <>
                  <p style={{ margin: 0, color: '#C9D2E6', fontSize: 14, lineHeight: 1.5 }}>
                    Add a bank account to see what you can safely spend.
                  </p>
                  <Link
                    href="/banking/accounts"
                    className="btn btn-action"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Add bank account
                  </Link>
                </>
              ) : cash ? (
                <>
                  {(() => {
                    const owed = ap.state === 'ok' ? ap.data.summaryTotals.total : '0';
                    const safe = safeToSpend(cash.total, owed);
                    return (
                      <>
                        <div
                          className="bl-money"
                          style={{
                            fontSize: 34,
                            fontWeight: 600,
                            letterSpacing: '-0.03em',
                            color: isNegativeDecimal(safe) ? '#FFB4A8' : '#fff',
                          }}
                        >
                          {money(safe)}
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#C9D2E6', lineHeight: 1.5 }}>
                          {isNegativeDecimal(safe)
                            ? 'You owe suppliers more than is in the bank.'
                            : 'Cash in the bank after paying every bill you owe.'}
                        </p>
                        <dl
                          style={{
                            margin: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            fontSize: 13,
                            borderTop: '1px solid #22396A',
                            paddingTop: 12,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <dt>
                              Cash in {cash.count} bank {cash.count === 1 ? 'account' : 'accounts'}
                            </dt>
                            <dd className="bl-money" style={{ margin: 0 }}>
                              {money(cash.total)}
                            </dd>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFB4A8' }}>
                            <dt>− Unpaid bills</dt>
                            <dd className="bl-money" style={{ margin: 0 }}>
                              {ap.state === 'ok' ? money(owed) : '—'}
                            </dd>
                          </div>
                        </dl>
                        <p style={{ margin: 0, fontSize: 12, color: '#9FAACC' }}>
                          Based on bank balances in Blynt. Confirm bank lines to keep this accurate.
                        </p>
                      </>
                    );
                  })()}
                </>
              ) : null}
            </section>
          )}
        </div>

        {/* Row 2: KPI tiles — this month with last month as the reference point. */}
        {(showPnlTiles || prefs.kpiInvoices || prefs.kpiBills) && (
          <div className="bl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {showPnlTiles &&
              (pnl.state === 'loading' ? (
                <Panel>
                  <SkeletonRows rows={2} />
                </Panel>
              ) : pnl.state === 'ok' ? (
                <>
                  {prefs.kpiIncome && (
                    <Kpi
                      label="Income this month"
                      value={money(pnl.data.thisMonth.revenue?.total)}
                      sub={`Last month ${money(pnl.data.lastMonth.revenue?.total)}`}
                      href="/reports/profit-and-loss"
                    />
                  )}
                  {prefs.kpiExpenses && (
                    <Kpi
                      label="Costs this month"
                      value={money(costsOf(pnl.data.thisMonth))}
                      sub={`Last month ${money(costsOf(pnl.data.lastMonth))}`}
                      href="/reports/profit-and-loss"
                    />
                  )}
                  {prefs.kpiProfit && (
                    <Kpi
                      label="Profit this month"
                      value={money(pnl.data.thisMonth.netProfit)}
                      sub={`Last month ${money(pnl.data.lastMonth.netProfit)}`}
                      tone={isNegativeDecimal(pnl.data.thisMonth.netProfit) ? 'danger' : undefined}
                      href="/reports/profit-and-loss"
                    />
                  )}
                </>
              ) : pnl.state === 'error' ? (
                <Panel>
                  <Callout tone="danger">Couldn’t load this month’s profit and loss.</Callout>
                </Panel>
              ) : null)}
            {prefs.kpiInvoices && receivables && (
              <Kpi
                label="Customers owe you"
                value={money(receivables.total)}
                sub={
                  receivables.overdueCount > 0
                    ? `! ${money(receivables.overdueAmount)} overdue`
                    : 'Nothing overdue'
                }
                tone={receivables.overdueCount > 0 ? 'danger' : 'success'}
                href="/reports/ar-ageing"
              />
            )}
            {prefs.kpiBills && payables && (
              <Kpi
                label="You owe suppliers"
                value={money(payables.total)}
                sub={
                  payables.overdueCount > 0
                    ? `! ${money(payables.overdueAmount)} past due`
                    : 'Nothing past due'
                }
                tone={payables.overdueCount > 0 ? 'warning' : 'success'}
                href="/reports/ap-ageing"
              />
            )}
          </div>
        )}

        {/* Row 3: six-month trend from real P&L figures + outstanding invoices */}
        <div className="bl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          {showChart && trend.state !== 'forbidden' && (
            <Panel title="Money in vs money out" style={{ gridColumn: 'span 2' }}>
              {trend.state === 'loading' ? (
                <SkeletonRows rows={5} />
              ) : trend.state === 'error' ? (
                <Callout tone="danger">Couldn’t load the last six months.</Callout>
              ) : (
                <TrendChart data={trend.data} money={money} />
              )}
            </Panel>
          )}

          {prefs.tableInvoices && ar.state === 'ok' && (
            <Panel
              title="Waiting to be paid"
              actions={
                <Link href="/sales/invoices" style={{ fontSize: 13, fontWeight: 600 }}>
                  All invoices
                </Link>
              }
            >
              {(() => {
                const rows = ar.data.groups
                  .flatMap((g) => g.items.map((it) => ({ ...it, contactName: g.contactName })))
                  .sort((a, b) => b.daysOverdue - a.daysOverdue)
                  .slice(0, 5);
                if (rows.length === 0)
                  return <p style={{ margin: 0, color: 'var(--ink-2)' }}>No unpaid invoices.</p>;
                return (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {rows.map((r, i) => (
                      <li
                        key={r.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 0',
                          borderTop: i ? '1px solid var(--line-soft)' : 'none',
                        }}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{r.contactName}</span>
                          <span
                            style={{
                              fontSize: 12.5,
                              color: r.daysOverdue > 0 ? 'var(--danger)' : 'var(--text-muted)',
                              fontWeight: r.daysOverdue > 0 ? 600 : 400,
                            }}
                          >
                            {r.referenceNumber} ·{' '}
                            {r.daysOverdue > 0
                              ? `! ${r.daysOverdue} days late`
                              : `due ${shortDate(r.dueDate)}`}
                          </span>
                        </span>
                        <span className="bl-money" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                          {money(r.amountDue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Panel>
          )}

          {prefs.tableBills && ap.state === 'ok' && (
            <Panel
              title="Bills to pay"
              actions={
                <Link href="/purchases/bills" style={{ fontSize: 13, fontWeight: 600 }}>
                  All bills
                </Link>
              }
            >
              {(() => {
                const rows = ap.data.groups
                  .flatMap((g) => g.items.map((it) => ({ ...it, contactName: g.contactName })))
                  .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
                  .slice(0, 5);
                if (rows.length === 0)
                  return <p style={{ margin: 0, color: 'var(--ink-2)' }}>No unpaid bills.</p>;
                return (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {rows.map((r, i) => (
                      <li
                        key={r.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 0',
                          borderTop: i ? '1px solid var(--line-soft)' : 'none',
                        }}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{r.contactName}</span>
                          <span
                            style={{
                              fontSize: 12.5,
                              color: r.daysOverdue > 0 ? 'var(--warning-text)' : 'var(--text-muted)',
                              fontWeight: r.daysOverdue > 0 ? 600 : 400,
                            }}
                          >
                            {r.referenceNumber} ·{' '}
                            {r.daysOverdue > 0
                              ? `${r.daysOverdue} days past due`
                              : `due ${shortDate(r.dueDate)}`}
                          </span>
                        </span>
                        <span className="bl-money" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                          {money(r.amountDue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Panel>
          )}
        </div>

        {isEditor && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles size={14} aria-hidden="true" /> Tip: press <span className="bl-kbd">⌘K</span> to jump
            anywhere, or <span className="bl-kbd">N</span> to create something.
          </p>
        )}
      </Page>

      <DashboardCustomizerModal
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        preferences={prefs}
        onChangePreferences={updatePrefs}
      />
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'danger' | 'warning' | 'success';
  href: string;
}) {
  const subColor =
    tone === 'danger'
      ? 'var(--danger)'
      : tone === 'warning'
        ? 'var(--warning-text)'
        : tone === 'success'
          ? 'var(--success-text)'
          : 'var(--text-muted)';
  return (
    <Link
      href={href}
      className="bl-panel"
      style={{ textDecoration: 'none', color: 'inherit', gap: 8, padding: 18 }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span
        className="bl-money"
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: tone === 'danger' && value.startsWith('(') ? 'var(--danger)' : 'var(--text-main)',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 13, color: subColor, fontWeight: tone ? 600 : 400 }}>{sub}</span>
    </Link>
  );
}

/** Paired bars per month. Heights are for drawing only; the exact figures are in the accessible table. */
function TrendChart({
  data,
  money,
}: {
  data: { label: string; income: string; costs: string }[];
  money: (v: string) => string;
}) {
  // Pixel heights from whole pounds — display geometry only, never shown as money.
  const pounds = (v: string) => {
    const u = toUnits(v);
    return Number((u < BigInt(0) ? -u : u) / BigInt(10000));
  };
  const max = Math.max(1, ...data.flatMap((d) => [pounds(d.income), pounds(d.costs)]));
  const height = (v: string) => `${Math.max(2, Math.round((pounds(v) / max) * 180))}px`;
  const empty = data.every((d) => !isPositiveDecimal(d.income) && !isPositiveDecimal(d.costs));

  if (empty)
    return (
      <p style={{ margin: 0, color: 'var(--ink-2)' }}>
        No posted income or costs in the last six months yet.
      </p>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--ink-2)' }} aria-hidden="true">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--primary)' }} />
          Money in
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#FFB4A8' }} />
          Money out
        </span>
      </div>
      <div
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          gap: 12,
          alignItems: 'end',
          height: 210,
        }}
      >
        {data.map((d) => (
          <div
            key={d.label}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <div
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'flex-end',
                height: 184,
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <div
                title={`In ${money(d.income)}`}
                style={{
                  width: '38%',
                  maxWidth: 26,
                  height: height(d.income),
                  background: 'var(--primary)',
                  borderRadius: '5px 5px 0 0',
                }}
              />
              <div
                title={`Out ${money(d.costs)}`}
                style={{
                  width: '38%',
                  maxWidth: 26,
                  height: height(d.costs),
                  background: '#FFB4A8',
                  borderRadius: '5px 5px 0 0',
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.label}</span>
          </div>
        ))}
      </div>
      <table
        className="bl-table"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        <caption>Money in and out by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Money in</th>
            <th>Money out</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{money(d.income)}</td>
              <td>{money(d.costs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
