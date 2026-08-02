import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spinos — Find the next.",
  description: "Sales Performance Intelligence & Opportunity System — inteligência comercial alimentada por IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
