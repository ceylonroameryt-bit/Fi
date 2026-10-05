'use client';

import React from 'react';

interface AdminMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
}

export function AdminMetricCard({ title, value, subtitle }: AdminMetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        padding: '1.25rem',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
        {value}
      </div>
      {subtitle && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{subtitle}</div>}
    </div>
  );
}
