import React from 'react';

export interface BlyntLogoProps {
  variant?: 'horizontal' | 'stacked' | 'mark-only';
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Blynt Official B-Mark Component
 * Features the solid deep navy foundation spine with dynamic ascending teal financial growth lobes.
 */
export function BlyntMark({
  size = 32,
  theme = 'light',
  className = '',
  style,
}: {
  size?: number;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}) {
  const isDark = theme === 'dark';
  const spineFill = isDark ? '#FFFFFF' : '#082B5C';
  const upperLobeCutout = isDark ? '#041F46' : '#FFFFFF';
  const lowerLobeCutout = isDark ? '#041F46' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-label="Blynt B Logo Mark"
    >
      <defs>
        <linearGradient id={`blynt-teal-${isDark ? 'dark' : 'light'}`} x1="20" y1="80" x2="90" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10B8A7" />
          <stop offset="100%" stop-color="#18D3BE" />
        </linearGradient>
        <linearGradient id={`blynt-navy-${isDark ? 'dark' : 'light'}`} x1="15" y1="15" x2="80" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#082B5C" />
          <stop offset="100%" stop-color="#041F46" />
        </linearGradient>
      </defs>

      {/* Left Structural Spine */}
      <rect x="14" y="14" width="18" height="72" rx="4" fill={spineFill} />

      {/* Upper Lobe (Trust / Stability) */}
      <path
        d="M32 14 H58 C72 14 80 22 80 34 C80 44 72 50 58 50 H32 V14 Z"
        fill={isDark ? '#FFFFFF' : 'url(#blynt-navy-light)'}
      />
      <path
        d="M32 26 H56 C62 26 67 29 67 34 C67 39 62 42 56 42 H32 V26 Z"
        fill={upperLobeCutout}
      />

      {/* Lower Lobe (Ascending Financial Growth - Blynt Teal) */}
      <path
        d="M32 46 H62 C78 46 86 54 86 68 C86 80 76 86 60 86 H32 V46 Z"
        fill={`url(#blynt-teal-${isDark ? 'dark' : 'light'})`}
      />
      <path
        d="M32 58 H58 C65 58 71 61 71 68 C71 74 65 76 58 76 H32 V58 Z"
        fill={lowerLobeCutout}
      />

      {/* Upward Growth Arrow Vector */}
      <polygon points="64,38 78,22 86,30" fill="#18D3BE" />
    </svg>
  );
}

/**
 * Blynt Official Brand Logo (Wordmark + Mark + Tagline)
 */
export function BlyntLogo({
  variant = 'horizontal',
  theme = 'light',
  size = 'md',
  showTagline = false,
  className = '',
  style,
}: BlyntLogoProps) {
  const isDark = theme === 'dark';

  const dimensions = {
    sm: { markSize: 24, fontSize: '1.1rem', dotSize: 3, taglineSize: '0.62rem', gap: '0.5rem' },
    md: { markSize: 32, fontSize: '1.45rem', dotSize: 4, taglineSize: '0.72rem', gap: '0.65rem' },
    lg: { markSize: 42, fontSize: '1.9rem', dotSize: 5, taglineSize: '0.85rem', gap: '0.8rem' },
    xl: { markSize: 56, fontSize: '2.5rem', dotSize: 6, taglineSize: '1rem', gap: '1rem' },
  }[size];

  if (variant === 'mark-only') {
    return <BlyntMark size={dimensions.markSize} theme={theme} className={className} style={style} />;
  }

  const textColor = isDark ? '#FFFFFF' : '#082B5C';
  const taglineColor = isDark ? '#94A3B8' : '#64748B';

  if (variant === 'stacked') {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          ...style,
        }}
      >
        <div style={{ marginBottom: '0.5rem' }}>
          <BlyntMark size={dimensions.markSize * 1.3} theme={theme} />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '2px',
            fontSize: dimensions.fontSize,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: textColor,
            lineHeight: 1.1,
          }}
        >
          <span>Blynt</span>
          <span style={{ color: '#10B8A7', marginLeft: '1px' }}>.</span>
        </div>
        {showTagline && (
          <div
            style={{
              fontSize: dimensions.taglineSize,
              fontWeight: 500,
              color: taglineColor,
              marginTop: '0.35rem',
              letterSpacing: '0.02em',
            }}
          >
            Business Finance, Simplified
          </div>
        )}
      </div>
    );
  }

  // Horizontal variant (default)
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: dimensions.gap,
        ...style,
      }}
    >
      <BlyntMark size={dimensions.markSize} theme={theme} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '2px',
            fontSize: dimensions.fontSize,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: textColor,
            lineHeight: 1.1,
          }}
        >
          <span>Blynt</span>
          <span style={{ color: '#10B8A7', fontSize: '1.2em', lineHeight: 0.5 }}>.</span>
        </div>
        {showTagline && (
          <span
            style={{
              fontSize: dimensions.taglineSize,
              fontWeight: 500,
              color: taglineColor,
              letterSpacing: '0.02em',
              marginTop: '2px',
            }}
          >
            Business Finance, Simplified
          </span>
        )}
      </div>
    </div>
  );
}
