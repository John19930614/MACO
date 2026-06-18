import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafetyIQ — Reliance Predictive Safety Technologies",
  description:
    "AI-powered EHS management platform. Chemical inventory intelligence, compliance tracking, audit management, and predictive risk analysis for pharmaceutical and biotech.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-[var(--color-primary)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
