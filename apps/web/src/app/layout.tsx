import type { Metadata } from 'next';
import { Fraunces, Outfit } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const sans = Outfit({ subsets: ['latin'], variable: '--font-sans' });
const display = Fraunces({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: {
    default: 'Oakline',
    template: '%s · Oakline',
  },
  description: 'Oakline is a learning studio for courses, progress, and certificates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
