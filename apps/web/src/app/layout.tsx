import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/auth-context';

export const metadata: Metadata = {
  title: 'LedgerPro | Professional Accounting Platform',
  description: 'Professional multi-organisation double-entry accounting platform for growing businesses',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
