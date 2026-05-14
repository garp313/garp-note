import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Garp Note',
  description: 'Aplicativo de anotações para universitários',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
