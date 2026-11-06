import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Pharmacy reorder · RefillCare',
  description: 'Reorder regular medicines in a minute. A registered pharmacist checks every prescription.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2226%22 fill=%22%232D6A4F%22/><rect x=%2216%22 y=%2240%22 width=%2268%22 height=%2220%22 rx=%2210%22 fill=%22%23FFFDF8%22 transform=%22rotate(-35 50 50)%22/></svg>',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F5F1E6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Young+Serif&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@500;600&family=Noto+Serif+Devanagari:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased selection:bg-teal-100 selection:text-teal-900">
        {children}
      </body>
    </html>
  );
}
