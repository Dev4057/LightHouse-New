import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // 👈 React Query lives in here!
import AuthProvider from "@/components/AuthProvider" // 👈 NextAuth lives in here!

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lighthouse",
  description:
    "Advanced Snowflake warehouse monitoring and optimization with AI insights",
  icons: {
    icon: "/spectra.svg", // browser tab icon
    shortcut: "/spectra.svg",
    apple: "/spectra.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* We must wrap the app in BOTH providers! */}
        <Providers>
          <AuthProvider>
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}