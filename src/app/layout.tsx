import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mafija Helper",
  description: "Web moderator za Mafiju / Werewolf partije",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
