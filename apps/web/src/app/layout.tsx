import type { Metadata } from 'next';
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
