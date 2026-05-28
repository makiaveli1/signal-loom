import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { DEFAULT_SIGNAL_THEME, SIGNAL_THEME_STORAGE_KEY, isSignalThemeId, type SignalThemeId } from "@/lib/theme";
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

async function readInitialTheme(): Promise<SignalThemeId> {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(SIGNAL_THEME_STORAGE_KEY)?.value;
  return isSignalThemeId(cookieTheme) ? cookieTheme : DEFAULT_SIGNAL_THEME;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialTheme = await readInitialTheme();

  return (
    <html
      lang="en"
      className="dark h-full"
      data-signal-theme={initialTheme}
      style={{ colorScheme: initialTheme === 'papyrus-dawn' ? 'light' : 'dark' }}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
