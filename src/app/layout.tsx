import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AdSettingsProvider } from '@/contexts/AdSettingsContext';
import { AIProfileProvider } from '@/contexts/AIProfileContext';
import { GlobalStatusProvider } from '@/contexts/GlobalStatusContext';
import { AIMediaAssetsProvider } from '@/contexts/AIMediaAssetsContext';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import OfflineIndicator from '@/components/OfflineIndicator';
import StructuredData from '@/components/StructuredData';
import AccessibilityEnhancer from '@/components/AccessibilityEnhancer';
import ClientComponentsWrapper from '@/components/ClientComponentsWrapper';
import CookieConsent from '@/components/CookieConsent';

// Optimize font loading
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: true,
  weight: ['400', '500', '600', '700'],
});

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return 'https://kruthika.fun';
};

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  alternates: {
    canonical: getBaseUrl(),
  },
  title: {
    default: 'AI Girlfriend Free - Best AI Girlfriend 2025 | Kruthika AI Girlfriend Chat - No Sign Up',
    template: '%s | Kruthika AI Girlfriend'
  },
  description: 'AI Girlfriend Free 2025 - Chat with Kruthika, the #1 rated AI girlfriend app. Free unlimited AI girlfriend chat with no sign up required. 24/7 AI girlfriend emotional support, voice chat, and realistic conversations. Best free AI girlfriend for loneliness, anxiety, and companionship. Join 1M+ users worldwide. Start your AI girlfriend experience now!',
  keywords: 'AI girlfriend, free AI girlfriend, AI girlfriend chat, best AI girlfriend 2025, virtual AI girlfriend, AI girlfriend app, AI companion, emotional support AI, realistic AI girlfriend, AI girlfriend online, AI girlfriend no sign up, AI chatbot girlfriend, virtual girlfriend chat, AI girlfriend for loneliness, AI girlfriend USA, AI girlfriend India, AI girlfriend therapy, mental health AI companion',
  authors: [{ name: 'Kruthika.fun Team' }],
  creator: 'Kruthika.fun',
  publisher: 'Kruthika.fun',
  applicationName: 'Kruthika AI Girlfriend',
  referrer: 'origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
  openGraph: {
    title: 'AI Girlfriend Free - Best AI Girlfriend 2025 | Kruthika AI Girlfriend Chat',
    description: 'AI Girlfriend Free - Meet Kruthika, the #1 rated AI girlfriend. Best AI girlfriend 2025 with free unlimited AI girlfriend chat, 24/7 AI girlfriend support. Top AI girlfriend for USA, UK, Canada, Australia, India. Start your AI girlfriend experience now!',
    url: 'https://kruthika.fun',
    siteName: 'Kruthika AI Girlfriend - Best Free AI Girlfriend 2025',
    images: [
      {
        url: 'https://kruthika.fun/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Kruthika AI Girlfriend - Free Virtual Companion for Emotional Support',
      },
    ],
    locale: 'en_US',
    type: 'website',
    countryName: 'United States',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Girlfriend Free - Best AI Girlfriend 2025 | Kruthika AI Girlfriend',
    description: 'AI Girlfriend Free - Chat with Kruthika, the best AI girlfriend. #1 AI girlfriend app with free unlimited AI girlfriend chat, 24/7 AI girlfriend emotional support. Top AI girlfriend worldwide. Start now!',
    images: ['https://kruthika.fun/og-image.jpg'],
    creator: '@kruthikafun',
    site: '@kruthikafun',
  },
  other: {
    'google-site-verification': 'verification-for-kruthika-fun-search-console',
    'geo.region': 'US',
    'geo.placename': 'United States',
    'geo.position': 'global',
    'ICBM': 'global',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="verification-for-kruthika-fun-search-console" />
        <meta name="theme-color" content="#0d8043" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href={getBaseUrl()} />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />

        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link
          rel="preload"
          href="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        <link rel="preload" as="image" href="/kruthika-avatar.svg" type="image/svg+xml" fetchPriority="high" crossOrigin="anonymous" />
        <link rel="prefetch" href="/maya-chat" crossOrigin="anonymous" />

        <StructuredData />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <AIProfileProvider>
            <AdSettingsProvider>
              <GlobalStatusProvider>
                <AIMediaAssetsProvider>
                  {children}
                  <Toaster />
                  <ServiceWorkerRegistration />
                  <OfflineIndicator />
                  <AccessibilityEnhancer />
                  <ClientComponentsWrapper />
                  <CookieConsent />
                </AIMediaAssetsProvider>
              </GlobalStatusProvider>
            </AdSettingsProvider>
          </AIProfileProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
