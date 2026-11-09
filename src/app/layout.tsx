import type { Metadata } from 'next';
import { ThemeInit } from "@/components/theme-init";
import { ThemeProvider } from "@/lib/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { dashboardConfig } from "@/config/dashboard.config";
import './globals.css';

export const metadata: Metadata = {
  title: dashboardConfig.site.name,
  description: dashboardConfig.site.description,
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`antialiased`}>
        <ThemeProvider>
          <ThemeInit />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
