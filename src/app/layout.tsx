import type { Metadata, Viewport } from "next";
import "./globals.css";

import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Monex",
  description: "Monex: dashboard financeiro pessoal com planejamento, cartoes, dividas e investimentos.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Monex",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
