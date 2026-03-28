import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Grange Land Intelligence | Victorian Retail Lot Price Platform",
  description: "Real-time residential land market intelligence across Victoria's growth corridors. Track lot prices, sales velocity, and market trends at LGA and suburb level.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${dmSerif.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
