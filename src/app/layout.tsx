import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monex",
  description: "Monex: dashboard financeiro pessoal com planejamento, cartoes, dividas e investimentos.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
