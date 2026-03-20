import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeMap — Visual Code Reasoning",
  description: "Understand code through visual node maps, decision inspection, and concept extraction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
