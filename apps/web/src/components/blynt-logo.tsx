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
 * Blynt Full Brand Logo (Vector Outlined Mark + Pure Outlined Wordmark)
 * Directly matches the master vector reference without extra dots or approximations.
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
  const idPrefix = isDark ? 'blynt-logo-dark' : 'blynt-logo-light';

  const dimensions = {
    sm: { width: 110, height: 32, markSize: 24, fontSize: '1.2rem', taglineSize: '0.62rem' },
    md: { width: 135, height: 40, markSize: 30, fontSize: '1.45rem', taglineSize: '0.72rem' },
    lg: { width: 175, height: 52, markSize: 38, fontSize: '1.85rem', taglineSize: '0.82rem' },
    xl: { width: 230, height: 68, markSize: 50, fontSize: '2.4rem', taglineSize: '0.95rem' },
  }[size];

  if (variant === 'mark-only') {
    return <BlyntMark size={dimensions.markSize} theme={theme} className={className} style={style} />;
  }

  const wordmarkFill = isDark ? '#FFFFFF' : '#0D2357';

  // Full SVG with vector mark + vector wordmark
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: variant === 'stacked' ? 'column' : 'row',
        alignItems: 'center',
        gap: variant === 'stacked' ? '0.4rem' : '0.6rem',
        ...style,
      }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="170 470 920 310"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
        aria-label="Blynt"
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
                <stop offset="0" stopColor="#CBD5E1" />
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

        {/* --- Symbol Mark --- */}
        <g id="Blynt-symbol">
          <path
            id="Symbol-upper"
            fill={`url(#${idPrefix}-coral)`}
            fillRule="evenodd"
            d="M 195 474 L 319 474 C 361 474 396 503 396 541 C 396 561 386 580 369 592 C 342 576 312 566 278 566 L 202 566 C 183 566 172 555 172 538 L 172 496 C 172 483 181 474 195 474 Z"
          />
          <path
            id="Symbol-coral-lower"
            fill={`url(#${idPrefix}-coral)`}
            fillRule="evenodd"
            d="M 172 741 L 172 647 C 172 611 203 582 244 582 L 274 582 C 306 582 335 589 357 602 L 198 706 C 181 717 172 728 172 741 Z"
          />
          <path
            id="Symbol-navy-lower"
            fill={`url(#${idPrefix}-navy)`}
            fillRule="evenodd"
            d="M 357 602 C 385 618 402 643 402 673 C 402 723 359 761 305 761 L 195 761 C 180 761 172 752 172 741 C 172 728 181 717 198 706 Z"
          />
        </g>

        {/* --- Outlined Wordmark "Blynt" --- */}
        <g id="Blynt-wordmark-outlines" fill={wordmarkFill}>
          <path
            id="Letter-B"
            fillRule="evenodd"
            d="M 475 524 L 548 524 C 591 524 617 544 617 575 C 617 593 607 608 591 616 C 613 624 626 641 626 664 C 626 700 600 723 557 723 L 470 723 C 467 723 466 721 466 718 L 466 534 C 466 528 469 524 475 524 Z M 509 560 L 509 601 L 549 601 C 565 601 574 594 574 581 C 574 568 565 560 549 560 Z M 509 637 L 509 684 L 555 684 C 573 684 582 676 582 661 C 582 646 572 637 555 637 Z"
          />
          <path
            id="Letter-l"
            fillRule="evenodd"
            d="M 649 524 L 671 524 C 678 524 681 528 681 534 L 681 717 C 681 721 679 723 675 723 L 645 723 C 641 723 639 721 639 717 L 639 534 C 639 528 642 524 649 524 Z"
          />
          <path
            id="Letter-y"
            fillRule="evenodd"
            d="M 705 581 L 735 581 C 739 581 741 582 742 587 L 771 670 L 800 587 C 801 582 803 581 807 581 L 837 581 C 845 581 849 587 845 596 L 792 730 C 779 764 761 778 720 778 L 705 778 C 698 778 695 774 695 768 L 695 746 C 695 740 698 737 704 737 L 713 737 C 729 737 741 731 748 719 L 696 595 C 692 587 697 581 705 581 Z"
          />
          <path
            id="Letter-n"
            fillRule="evenodd"
            d="M 847 651 C 847 607 879 578 920 578 C 963 578 990 601 990 636 L 990 716 C 990 720 988 723 984 723 L 953 723 C 949 723 947 721 947 717 L 947 645 C 947 627 938 618 922 618 C 903 618 889 630 889 651 L 889 717 C 889 721 887 723 883 723 L 853 723 C 849 723 847 721 847 717 Z"
          />
          <path
            id="Letter-t"
            fillRule="evenodd"
            d="M 1011 540 L 1036 540 C 1044 540 1047 544 1047 551 L 1047 581 L 1081 581 C 1085 581 1087 583 1087 587 L 1087 611 C 1087 616 1085 618 1081 618 L 1047 618 L 1047 663 C 1047 678 1055 684 1069 684 L 1080 683 C 1085 683 1087 685 1087 689 L 1087 716 C 1087 722 1078 725 1061 725 C 1023 725 1005 706 1005 670 L 1005 546 C 1005 542 1007 540 1011 540 Z"
          />
        </g>
      </svg>
      {showTagline && (
        <span
          style={{
            fontSize: dimensions.taglineSize,
            fontWeight: 500,
            color: isDark ? '#94A3B8' : '#64748B',
            letterSpacing: '0.02em',
          }}
        >
          Business Finance, Simplified
        </span>
      )}
    </div>
  );
}
