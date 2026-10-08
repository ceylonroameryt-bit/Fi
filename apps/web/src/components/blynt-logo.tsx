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
 * Palette: Coral (#FF7D6B) and Navy (#102654)
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
 * Blynt Official Brand Logo (Logo Only, No Name)
 * Renders the official Blynt B-mark symbol without text letters.
 */
export function BlyntLogo({
  variant = 'mark-only',
  theme = 'light',
  size = 'md',
  showTagline = false,
  className = '',
  style,
}: BlyntLogoProps) {
  const dimensions = {
    sm: { markSize: 28 },
    md: { markSize: 36 },
    lg: { markSize: 48 },
    xl: { markSize: 64 },
  }[size];

  return (
    <BlyntMark
      size={dimensions.markSize}
      theme={theme}
      className={className}
      style={style}
    />
  );
}

