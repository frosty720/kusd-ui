import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "KUSD - KalyChain Stablecoin",
  description: "Decentralized stablecoin system on KalyChain - Mint, borrow, and earn with KUSD",
  icons: {
    icon: '/icons/logo.svg',
    apple: '/icons/logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
