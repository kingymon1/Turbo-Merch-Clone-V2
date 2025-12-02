import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from '../contexts/ThemeContext';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

// Force dynamic rendering to prevent build-time errors when env vars aren't available
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'TurboMerch - AI-Powered Amazon Merch Listing Generator',
  description: 'Create viral Amazon Merch listings in minutes with AI-powered trend discovery, listing generation, and design creation.',
  keywords: ['Amazon Merch', 'POD', 'Print on Demand', 'AI Design', 'Merch Listings', 'Trend Scanner'],
  authors: [{ name: 'TurboMerch' }],
  openGraph: {
    title: 'TurboMerch - AI-Powered Amazon Merch Listing Generator',
    description: 'Create viral Amazon Merch listings in minutes with AI-powered trend discovery.',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://turbomerch.ai',
    siteName: 'TurboMerch',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TurboMerch - AI Merch Generator',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TurboMerch - AI-Powered Amazon Merch Listing Generator',
    description: 'Create viral Amazon Merch listings in minutes with AI-powered trend discovery.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
        <head>
          {/* Prevent flash of wrong theme */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var theme = localStorage.getItem('turbomerch-theme') || 'system';
                    var resolved = theme;
                    if (theme === 'system') {
                      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    }
                    document.documentElement.classList.add(resolved);
                  } catch (e) {
                    document.documentElement.classList.add('dark');
                  }
                })();
              `,
            }}
          />
        </head>
        <body className="font-sans">
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
