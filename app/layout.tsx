import type { Metadata } from 'next';
import './globals.css';
import WhaleCollector from '@/components/whales/WhaleCollector';

export const metadata: Metadata = {
  title: 'TradeIQ — Trading Intelligence Dashboard',
  description: 'Professional trading signals for Forex, Crypto, Stocks & Commodities. Free, open source, no AI APIs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full antialiased">
        <WhaleCollector />
        {children}
      </body>
    </html>
  );
}
