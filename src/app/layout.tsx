import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { AppShell } from "@/components/layout/app-shell";
import "@/styles/globals.css";

const display = localFont({ src: "./fonts/Fraunces.ttf", variable: "--font-display", display: "swap", weight: "100 900" });
const interfaceFont = localFont({ src: "./fonts/Manrope.ttf", variable: "--font-interface", display: "swap", weight: "200 800" });

export const metadata: Metadata = {
  title: { default: "FoodDude", template: "%s | FoodDude" },
  description: "A personal Lahore restaurant discovery and collection platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${interfaceFont.variable}`}>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
