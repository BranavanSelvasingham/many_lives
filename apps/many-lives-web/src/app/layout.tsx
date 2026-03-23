import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Many Lives",
  description:
    "Find your footing in South Quay, a river district of Brackenport: look for a place to stay, steady income, and a few friends while learning the block.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
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
