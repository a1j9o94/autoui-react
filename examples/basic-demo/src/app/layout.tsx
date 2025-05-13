import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// This file sets up global styles and fonts for the demo app.
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AutoUI React Example',
  description: 'Example of using AutoUI React to generate UIs with LLMs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
} 