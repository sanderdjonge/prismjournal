import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrismJournal | Professional Trading Intelligence",
  description: "Advanced trading journal with automated MT5 syncing, high-fidelity trade replay, and premium glassmorphic analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased min-h-screen">
        <Providers>
          <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(0,102,255,0.05)_0%,_transparent_50%)] pointer-events-none" />
          <main className="relative z-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
