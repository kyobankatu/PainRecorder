import type { Metadata, Viewport } from 'next';
import './globals.css';
import SessionWrapper from '@/components/SessionWrapper';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
    title: '痛み記録',
    description: '慢性疼痛トラッカー',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: '痛み記録',
    },
    icons: {
        apple: '/icon.svg',
    },
};

export const viewport: Viewport = {
    themeColor: '#3b82f6',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja">
            <body className="bg-gray-50 min-h-screen">
                <SessionWrapper>{children}</SessionWrapper>
                <ServiceWorkerRegistrar />
            </body>
        </html>
    );
}
