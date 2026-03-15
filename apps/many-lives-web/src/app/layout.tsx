import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Many Lives",
  description:
    "Inbox-first prototype for managing multiple semi-autonomous lives.",
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
