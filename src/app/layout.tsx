import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorker } from "@/components/pwa/service-worker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Society MS", template: "%s · Society MS" },
  description: "Run your housing society: maintenance dues, expenses, notices and complaints",
  applicationName: "Society MS",
  manifest: "/manifest.json",
  formatDetection: { telephone: false }, // don't turn flat numbers into phone links
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Society MS",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  viewportFit: "cover", // use the full screen on phones with a notch; pages add safe-area padding
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        {children}
        <Toaster position="top-center" richColors />
        <ServiceWorker />
      </body>
    </html>
  );
}
