import type {Metadata} from 'next';
import './globals.css';
import ReduxProvider from '@/components/ReduxProvider';

export const metadata: Metadata = {
  title: 'Webtoon Studio & Reader',
  description: 'Production-ready Webtoon Reader, Scene Editor, and Video Studio with MongoDB and MinIO storage.',
  openGraph: {
    title: 'Webtoon Studio & Reader',
    description: 'Production-ready Webtoon Reader, Scene Editor, and Video Studio with MongoDB and MinIO storage.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Webtoon Studio & Reader',
    description: 'Production-ready Webtoon Reader, Scene Editor, and Video Studio with MongoDB and MinIO storage.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-neutral-50 text-neutral-900 min-h-screen font-sans antialiased">
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}

