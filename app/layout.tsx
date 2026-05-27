import type { Metadata } from "next";
import { Playfair_Display, Lato, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Entartes — Escola de Dança",
  description: "Plataforma de gestão da Entartes, escola de dança.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`${playfair.variable} ${lato.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${lato.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}