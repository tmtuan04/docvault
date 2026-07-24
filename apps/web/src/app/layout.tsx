import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';

import './globals.css';

export const metadata: Metadata = {
  title: 'DocVault',
  description: 'Nền tảng quản lý và hỏi đáp tài liệu',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full font-sans antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: 'text-sm',
          }}
        />
      </body>
    </html>
  );
}
