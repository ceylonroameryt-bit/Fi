'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Filter,
  Download,
  CheckCircle2,
  SlidersHorizontal,
  Landmark,
  Layers,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page';

interface WeeklyForecast {
  week: string;
  startDate: string;
  cashIn: number;
  cashOut: number;
  net: number;
  closingBalance: number;
  isLowest?: boolean;
  notes?: string;
}

export default function CashFlowForecastPage() {
  const [scenario, setScenario] = useState<'base' | 'conservative' | 'optimistic'>('base');
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  // 13-Week Forecast Model
  const weeklyData: WeeklyForecast[] = [
    { week: 'W1', startDate: '20 Oct', cashIn: 6800, cashOut: 4200, net: 2600, closingBalance: 50810 },
    { week: 'W2', startDate: '27 Oct', cashIn: 5200, cashOut: 3800, net: 1400, closingBalance: 52210 },
    { week: 'W3', startDate: '03 Nov', cashIn: 4500, cashOut: 12400, net: -7900, closingBalance: 44310, notes: 'Monthly Payroll Run' },
    { week: 'W4', startDate: '10 Nov', cashIn: 8900, cashOut: 5100, net: 3800, closingBalance: 48110 },
    { week: 'W5', startDate: '17 Nov', cashIn: 7200, cashOut: 4600, net: 2600, closingBalance: 50710 },
    { week: 'W6', startDate: '24 Nov', cashIn: 3400, cashOut: 18200, net: -14800, closingBalance: 35910, isLowest: true, notes: 'HMRC Q3 VAT (£6,140) + Supplier Batches' },
    { week: 'W7', startDate: '01 Dec', cashIn: 9800, cashOut: 4800, net: 5000, closingBalance: 40910 },
    { week: 'W8', startDate: '08 Dec', cashIn: 6400, cashOut: 3900, net: 2500, closingBalance: 43410 },
    { week: 'W9', startDate: '15 Dec', cashIn: 7500, cashOut: 4200, net: 3300, closingBalance: 46710 },
    { week: 'W10', startDate: '22 Dec', cashIn: 8200, cashOut: 13500, net: -5300, closingBalance: 41410, notes: 'Holiday Payroll & Year-End Prepayments' },
    { week: 'W11', startDate: '29 Dec', cashIn: 4100, cashOut: 2200, net: 1900, closingBalance: 43310 },
    { week: 'W12', startDate: '05 Jan', cashIn: 9400, cashOut: 4500, net: 4900, closingBalance: 48210 },
    { week: 'W13', startDate: '12 Jan', cashIn: 11200, cashOut: 5800, net: 5400, closingBalance: 53610, notes: 'Q4 Annual Retainer Invoices Settled' },
  ];

  const maxBalance = Math.max(...weeklyData.map((d) => d.closingBalance), 60000);
  const minBalance = Math.min(...weeklyData.map((d) => d.closingBalance));

  return (
    <AppShell>
      <main
        style={{
          padding: '1.75rem 2.5rem 3.5rem 2.5rem',
          maxWidth: '1360px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <PageHeader
          title="13-Week Cash Flow Forecast"
          breadcrumb={[{ label: 'Reports', href: '/reports' }, { label: 'Cash flow forecast' }]}
          description="Rolling weekly liquidity projection calculated directly from approved bank balances, aged receivables, upcoming bills, and HMRC VAT liabilities."
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <button className="btn-v2-secondary" style={{ padding: '0.45rem 1rem', height: '38px', borderRadius: '8px' }}>
                <Download size={14} /> Export Model (Excel)
              </button>
            </div>
          }
        />

        {/* TOP SUMMARY METRIC CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E7EF', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.785rem', fontWeight: 600, color: '#5B6478', marginBottom: '0.3rem' }}>
              Current Bank Balance
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#102654', fontFamily: 'JetBrains Mono, monospace' }}>
              £48,210.00
            </div>
            <div style={{ fontSize: '0.75rem', color: '#12B76A', fontWeight: 600, marginTop: '0.35rem' }}>
              ● 3 Active Accounts Reconciled
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E7EF', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.785rem', fontWeight: 600, color: '#5B6478', marginBottom: '0.3rem' }}>
              Projected 13-Week Inflows
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#12B76A', fontFamily: 'JetBrains Mono, monospace' }}>
              +£86,300.00
            </div>
            <div style={{ fontSize: '0.75rem', color: '#5B6478', marginTop: '0.35rem' }}>
              Customer collections & recurring
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E7EF', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.785rem', fontWeight: 600, color: '#5B6478', marginBottom: '0.3rem' }}>
              Projected 13-Week Outflows
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#B8432F', fontFamily: 'JetBrains Mono, monospace' }}>
              -£80,900.00
            </div>
            <div style={{ fontSize: '0.75rem', color: '#5B6478', marginTop: '0.35rem' }}>
              Bills, Payroll & £6.14k Q3 VAT
            </div>
          </div>

          <div style={{ backgroundColor: '#102654', color: '#FFFFFF', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.785rem', fontWeight: 600, color: '#C9D2E6', marginBottom: '0.3rem' }}>
              Projected Closing (W13)
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace' }}>
              £53,610.00
            </div>
            <div style={{ fontSize: '0.75rem', color: '#4ADE80', fontWeight: 600, marginTop: '0.35rem' }}>
              +£5,400.00 Net Expansion
            </div>
          </div>
        </div>

        {/* 13-WEEK INTERACTIVE VISUAL LIQUIDITY GRAPH */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E7EF', borderRadius: '14px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#102654', margin: 0 }}>
                13-Week Cash Trajectory & Liquidity Runway
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#5B6478' }}>
                Weekly closing bank balance curve vs. critical liquidity safety threshold (£25k)
              </span>
            </div>

            {/* Scenario Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.785rem', fontWeight: 700, color: '#102654' }}>Scenario Model:</span>
              <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setScenario('base')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.775rem',
                    fontWeight: scenario === 'base' ? 700 : 500,
                    backgroundColor: scenario === 'base' ? '#102654' : 'transparent',
                    color: scenario === 'base' ? '#FFFFFF' : '#5B6478',
                    cursor: 'pointer',
                  }}
                >
                  Base Case
                </button>
                <button
                  type="button"
                  onClick={() => setScenario('conservative')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.775rem',
                    fontWeight: scenario === 'conservative' ? 700 : 500,
                    backgroundColor: scenario === 'conservative' ? '#102654' : 'transparent',
                    color: scenario === 'conservative' ? '#FFFFFF' : '#5B6478',
                    cursor: 'pointer',
                  }}
                >
                  Conservative (+14d AR delay)
                </button>
              </div>
            </div>
          </div>

          {/* Alert Callout for Lowest Week */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#FEF8EC',
              border: '1px solid #FDE68A',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              fontSize: '0.825rem',
              color: '#8A5A00',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertTriangle size={16} />
              <span>
                <strong>Liquidity Stress Alert (Week 6):</strong> Lowest projected balance reaches <strong>£35,910.00</strong> on 24 Nov when Q3 VAT return (£6,140) and supplier payables coincide. Fully cushioned by your £25,000 safety floor.
              </span>
            </div>
            <Link href="/reports/vat" style={{ fontWeight: 700, color: '#B8432F', textDecoration: 'none' }}>
              View Q3 VAT Box →
            </Link>
          </div>

          {/* Interactive Chart Area */}
          <div
            style={{
              height: '240px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '12px',
              paddingTop: '1.5rem',
              borderBottom: '1px solid #E3E7EF',
              position: 'relative',
            }}
          >
            {/* Safety Floor Line (£25k) */}
            <div
              style={{
                position: 'absolute',
                bottom: `${(25000 / maxBalance) * 100}%`,
                left: 0,
                right: 0,
                borderTop: '2px dashed #EF4444',
                opacity: 0.6,
                zIndex: 1,
              }}
            >
              <span style={{ position: 'absolute', right: 8, bottom: 4, fontSize: '0.675rem', fontWeight: 700, color: '#EF4444' }}>
                Safety Buffer (£25k)
              </span>
            </div>

            {weeklyData.map((d, i) => {
              const isHovered = hoveredWeek === i;
              const heightPct = (d.closingBalance / maxBalance) * 100;

              return (
                <div
                  key={d.week}
                  onMouseEnter={() => setHoveredWeek(i)}
                  onMouseLeave={() => setHoveredWeek(null)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    height: '100%',
                    justifyContent: 'flex-end',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '105%',
                        backgroundColor: '#0B1B3D',
                        color: '#FFFFFF',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.725rem',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                        zIndex: 20,
                        pointerEvents: 'none',
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{d.week} ({d.startDate})</div>
                      <div style={{ color: '#4ADE80' }}>Inflows: +£{d.cashIn.toLocaleString()}</div>
                      <div style={{ color: '#FFB4A8' }}>Outflows: -£{d.cashOut.toLocaleString()}</div>
                      <div style={{ color: '#FFFFFF', fontWeight: 700, marginTop: '2px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '2px' }}>
                        Closing: £{d.closingBalance.toLocaleString()}
                      </div>
                      {d.notes && <div style={{ color: '#FDE68A', fontSize: '0.675rem', marginTop: '2px' }}>{d.notes}</div>}
                    </div>
                  )}

                  {/* Vertical Column */}
                  <div
                    style={{
                      width: '28px',
                      height: `${heightPct}%`,
                      backgroundColor: d.isLowest ? '#FF7D6B' : isHovered ? '#1E3A8A' : '#102654',
                      borderRadius: '5px 5px 0 0',
                      transition: 'all 0.15s ease',
                      boxShadow: d.isLowest ? '0 0 10px rgba(255,125,107,0.5)' : 'none',
                    }}
                  />

                  <span style={{ fontSize: '0.75rem', fontWeight: isHovered || d.isLowest ? 800 : 600, color: d.isLowest ? '#B8432F' : '#5B6478' }}>
                    {d.week}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#5B6478' }}>
            <span>Horizontal line indicates recommended £25,000 minimum operating buffer</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#102654', borderRadius: '2px' }} />
                <span>Normal Trajectory</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#FF7D6B', borderRadius: '2px' }} />
                <span>Lowest Liquidity Week</span>
              </span>
            </div>
          </div>
        </div>

        {/* DETAILED 13-WEEK LIQUIDITY LEDGER TABLE */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E7EF', borderRadius: '14px', padding: '1.25rem 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#102654', marginBottom: '1rem' }}>
            Weekly Liquidity Breakdown Schedule
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E3E7EF', color: '#5B6478', fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Week</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Date Starting</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Cash In (+)</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Cash Out (−)</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Net Delta</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Closing Bank Balance</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Significant Scheduled Events</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map((row) => (
                  <tr
                    key={row.week}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: row.isLowest ? '#FFF1EE' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#102654' }}>{row.week}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#5B6478' }}>{row.startDate}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#12B76A', fontWeight: 700 }}>
                      +£{row.cashIn.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#B8432F', fontWeight: 700 }}>
                      -£{row.cashOut.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: row.net >= 0 ? '#12B76A' : '#D92D20' }}>
                      {row.net >= 0 ? `+£${row.net.toLocaleString()}` : `-£${Math.abs(row.net).toLocaleString()}`}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#102654' }}>
                      £{row.closingBalance.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: row.isLowest ? '#B8432F' : '#5B6478', fontWeight: row.isLowest ? 700 : 400 }}>
                      {row.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
