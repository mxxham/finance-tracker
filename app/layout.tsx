import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { SettingsProvider } from '@/lib/SettingsContext';
import ClientLayout from './ClientLayout';

export const metadata: Metadata = {
  title: 'FinTrack — Personal Finance',
  description: 'Track your income, expenses, and budgets with clarity.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <ClientLayout>
          <AuthProvider><SettingsProvider>{children}</SettingsProvider></AuthProvider>
        </ClientLayout>
      </body>
    </html>
  );
}