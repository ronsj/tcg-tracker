import type { Metadata } from "next";
import { Suspense } from "react";
import { AppFrame } from "@/components/AppFrame";
import { UserMenu } from "@/components/UserMenu";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCG Tracker",
  description: "Pokémon, Magic: The Gathering and Riftbound prices and collection tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppFrame
            userMenu={
              <Suspense fallback={null}>
                <UserMenu />
              </Suspense>
            }
          >
            {children}
          </AppFrame>
        </Providers>
      </body>
    </html>
  );
}
