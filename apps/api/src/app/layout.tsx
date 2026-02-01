import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email Kategorisierung API',
  description: 'Backend API for Email Kategorisierung',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
