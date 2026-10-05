import React from 'react';

interface WarpLedgerLogoProps {
  variant?: 'horizontal' | 'stacked' | 'icon-only';
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

/**
 * Warp Ledger official logo mark and typography
 * Based on the UK Accounting & Business Advisory brand identity
 * Palette: Navy Blue (#0B2D5B), Royal Blue (#2563EB), White (#FFFFFF), Light Gray (#E5E7EB)
 */
export function WarpLedgerLogo({
  variant = 'horizontal',
  theme = 'light',
  size = 'md',
  showTagline = false,
  className = '',
}: WarpLedgerLogoProps) {
  const isDark = theme === 'dark';

  // Sizing scales
  const dimensions = {
    sm: { iconWidth: 26, iconHeight: 22, textScale: '1rem', taglineScale: '0.45rem', gap: '0.5rem' },
    md: { iconWidth: 34, iconHeight: 28, textScale: '1.25rem', taglineScale: '0.55rem', gap: '0.65rem' },
    lg: { iconWidth: 48, iconHeight: 40, textScale: '1.75rem', taglineScale: '0.7rem', gap: '0.85rem' },
  }[size];

  // SVG "W" Mark Geometry:
  // Features the iconic angled ribbon fold: deep navy/white left diagonal,
  // transitioning into vibrant royal blue facets with 3 ascending vertical growth bars.
  const MarkIcon = () => (
    <svg
      width={dimensions.iconWidth}
      height={dimensions.iconHeight}
      viewBox="0 0 100 82"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
      aria-label="Warp Ledger Logo Icon"
    >
      {/* Leftmost downward thick stroke (Navy in light theme, Crisp White in dark theme) */}
      <path
        d="M2 10 L24 10 L44 64 L26 64 Z"
        fill={isDark ? '#FFFFFF' : '#0B2D5B'}
      />

      {/* Upward dynamic diagonal fold (Royal Blue) */}
      <path
        d="M26 64 L44 64 L56 28 L42 28 Z"
        fill="#2563EB"
      />

      {/* Ascending Chart / Growth Pillar 1 (Shorter vertical bar) */}
      <path
        d="M58 36 L68 31 L68 64 L58 64 Z"
        fill="#2563EB"
      />

      {/* Ascending Chart / Growth Pillar 2 (Medium vertical bar) */}
      <path
        d="M72 23 L82 18 L82 64 L72 64 Z"
        fill="#2563EB"
      />

      {/* Ascending Chart / Growth Pillar 3 (Tallest vertical bar) */}
      <path
        d="M86 10 L96 5 L96 64 L86 64 Z"
        fill="#2563EB"
      />

      {/* Subtle depth shadow at the junction between navy and blue fold */}
      <path
        d="M26 64 L34 40 L44 64 Z"
        fill="#1D4ED8"
        opacity="0.45"
      />
    </svg>
  );

  if (variant === 'icon-only') {
    return <MarkIcon />;
  }

  const textColorWarp = isDark ? '#FFFFFF' : '#0B2D5B';
  const textColorLedger = '#2563EB';
  const textColorTagline = isDark ? '#94A3B8' : '#0B2D5B';

  if (variant === 'stacked') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '0.65rem' }}>
          <MarkIcon />
        </div>
        <div
          style={{
            fontSize: dimensions.textScale,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          <span style={{ color: textColorWarp }}>Warp</span>{' '}
          <span style={{ color: textColorLedger }}>Ledger</span>
        </div>
        {showTagline && (
          <div
            style={{
              fontSize: dimensions.taglineScale,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: textColorTagline,
              marginTop: '0.35rem',
              opacity: 0.85,
            }}
          >
            Accounting for a brighter tomorrow
          </div>
        )}
      </div>
    );
  }

  // Horizontal primary logo (Default)
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dimensions.gap,
        textDecoration: 'none',
      }}
    >
      <MarkIcon />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: dimensions.textScale,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.2rem',
          }}
        >
          <span style={{ color: textColorWarp }}>Warp</span>
          <span style={{ color: textColorLedger }}>Ledger</span>
        </div>
        {showTagline && (
          <span
            style={{
              fontSize: dimensions.taglineScale,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: textColorTagline,
              marginTop: '0.2rem',
              whiteSpace: 'nowrap',
              opacity: 0.8,
            }}
          >
            Accounting for a brighter tomorrow
          </span>
        )}
      </div>
    </div>
  );
}
