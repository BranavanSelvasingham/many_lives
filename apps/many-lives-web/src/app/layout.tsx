import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Many Lives",
  description:
    "The city is reordering itself, and no one with only one life can shape what comes next.",
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
