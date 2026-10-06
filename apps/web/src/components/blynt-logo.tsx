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
 * Vector geometry faithfully sourced from official brand master (Blynt-editable.svg).
 * Palette: Navy (#102654) and Coral (#FF7D6B)
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
  const idPrefix = isDark ? 'blynt-mark-dark' : 'blynt-mark-light';

  return (
    <svg
      width={size}
      height={Math.round(size * 1.25)}
      viewBox="170 470 234 295"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-label="Blynt Brand Mark"
    >
      <defs>
        <linearGradient
          id={`${idPrefix}-coral`}
          gradientUnits="userSpaceOnUse"
          x1="182"
          y1="493"
          x2="385"
          y2="669"
        >
          <stop offset="0" stopColor="#FF947F" />
          <stop offset="1" stopColor="#FF6657" />
        </linearGradient>
        <linearGradient
          id={`${idPrefix}-navy`}
          gradientUnits="userSpaceOnUse"
          x1="183"
          y1="741"
          x2="398"
          y2="642"
        >
          {isDark ? (
            <>
              <stop offset="0" stopColor="#E2E8F0" />
              <stop offset="1" stopColor="#FFFFFF" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#0C214D" />
              <stop offset="1" stopColor="#223D77" />
            </>
          )}
        </linearGradient>
      </defs>

      {/* Symbol Upper Lobe (Coral) */}
      <path
        id="Symbol-upper"
        fill={`url(#${idPrefix}-coral)`}
        fillRule="evenodd"
        d="M 195 474 L 319 474 C 361 474 396 503 396 541 C 396 561 386 580 369 592 C 342 576 312 566 278 566 L 202 566 C 183 566 172 555 172 538 L 172 496 C 172 483 181 474 195 474 Z"
      />

      {/* Symbol Lower Lobe - Coral section */}
      <path
        id="Symbol-coral-lower"
        fill={`url(#${idPrefix}-coral)`}
        fillRule="evenodd"
        d="M 172 741 L 172 647 C 172 611 203 582 244 582 L 274 582 C 306 582 335 589 357 602 L 198 706 C 181 717 172 728 172 741 Z"
      />

      {/* Symbol Lower Lobe - Navy foundation curve */}
      <path
        id="Symbol-navy-lower"
        fill={`url(#${idPrefix}-navy)`}
        fillRule="evenodd"
        d="M 357 602 C 385 618 402 643 402 673 C 402 723 359 761 305 761 L 195 761 C 180 761 172 752 172 741 C 172 728 181 717 198 706 Z"
      />
    </svg>
  );
}

/**
 * Blynt Full Brand Logo (Vector Outlined Mark + Wordmark)
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
    sm: { markSize: 22, height: 28, fontSize: '1.15rem', taglineSize: '0.62rem', gap: '0.6rem' },
    md: { markSize: 28, height: 34, fontSize: '1.45rem', taglineSize: '0.72rem', gap: '0.75rem' },
    lg: { markSize: 36, height: 44, fontSize: '1.85rem', taglineSize: '0.82rem', gap: '0.9rem' },
    xl: { markSize: 48, height: 58, fontSize: '2.4rem', taglineSize: '0.95rem', gap: '1.1rem' },
  }[size];

  if (variant === 'mark-only') {
    return <BlyntMark size={dimensions.markSize} theme={theme} className={className} style={style} />;
  }

  const textColor = isDark ? '#FFFFFF' : '#102654';
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
          <BlyntMark size={dimensions.markSize * 1.35} theme={theme} />
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
          <span style={{ color: '#FF7D6B', marginLeft: '1px' }}>.</span>
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
          <span style={{ color: '#FF7D6B', fontSize: '1.2em', lineHeight: 0.5 }}>.</span>
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
