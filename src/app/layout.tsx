import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import * as stylex from "@stylexjs/stylex";
import { colors, fonts } from "./tokens.stylex";
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
  title: "TCG Tracker",
  description: "Pokémon, Magic: The Gathering and Riftbound prices and collection tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body {...stylex.props(styles.body)}>{children}</body>
    </html>
  );
}

const styles = stylex.create({
  body: {
    minHeight: "100dvh",
    fontFamily: fonts.sans,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
});
