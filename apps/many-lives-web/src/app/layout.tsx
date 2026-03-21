import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Many Lives",
  description:
    "Find your way in South Quay, a river district of Brackenport: learn the streets, find work, meet people, and solve local problems.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
