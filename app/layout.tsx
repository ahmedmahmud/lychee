import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import './(styles)/chessground.css';
import './(styles)/cg-board.css';
import './(styles)/cg-pieces.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Lychee',
  description: 'Your chess puzzle trainer',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
