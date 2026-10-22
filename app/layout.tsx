import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OHEL ON | Gestão Eclesiástica",
  description: "Plataforma SaaS premium para gestão de igrejas, congregações e denominações.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-ohel-bg text-ohel-silver`}>
        {children}
      </body>
    </html>
  );
}