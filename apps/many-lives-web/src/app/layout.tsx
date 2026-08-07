import type { Metadata } from "next";

import { CHUNK_LOAD_RECOVERY_SCRIPT } from "./chunkLoadRecovery";
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
      <head>
        <script
          id="many-lives-chunk-load-recovery"
          dangerouslySetInnerHTML={{ __html: CHUNK_LOAD_RECOVERY_SCRIPT }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
