import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

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
    // suppressHydrationWarning is highly recommended by next-themes 
    // to prevent hydration mismatch errors on the <html> tag
    <html lang="en" suppressHydrationWarning> 
      <body className="antialiased transition-colors duration-300">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}