import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const fontVariables = [outfit.variable, dmSans.variable, jetBrainsMono.variable].join(" ");

export const metadata: Metadata = {
  title: "Fairwork",
  description: "Get paid for what you deliver. Milestone-based freelance agreements.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
