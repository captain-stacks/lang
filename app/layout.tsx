import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spanish Learning Chat',
  description: 'Practice Spanish with instant hints, corrections, and tips',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
