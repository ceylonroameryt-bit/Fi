import React from 'react';
import type { NavIconName } from '@/lib/navigation';

/** Stroke icons for the eight navigation hubs (24×24, currentColor). */
const PATHS: Record<NavIconName, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  moneyIn: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9v6h6" />
    </>
  ),
  moneyOut: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15l6-6M9 9h6v6" />
    </>
  ),
  bank: <path d="M3 21h18M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M12 3l9 5H3z" />,
  reports: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  books: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
};

export function NavIcon({ name, size = 18 }: { name: NavIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}
