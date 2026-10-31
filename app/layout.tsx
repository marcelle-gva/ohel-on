import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OHEL ON | Gestão para igrejas",
  description: "Conheça o OHEL ON: uma plataforma para organizar secretaria, financeiro, eventos, ensino e cuidado pastoral da sua igreja.",
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