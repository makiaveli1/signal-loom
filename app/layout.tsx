import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Signal Loom — Nero Chair for Hermes",
  description: "Workspace for Hermes chats, tools, settings, and approval review",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <Script
          id="signal-loom-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const key = 'signal-loom-theme-v1';
                const theme = localStorage.getItem(key);
                const allowed = ['midnight-broadcast', 'nero-ember', 'oracle-teal', 'papyrus-dawn'];
                document.documentElement.dataset.signalTheme = allowed.includes(theme) ? theme : 'midnight-broadcast';
              } catch (_) {
                document.documentElement.dataset.signalTheme = 'midnight-broadcast';
              }
            })();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
