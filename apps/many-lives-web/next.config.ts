import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },
  async rewrites() {
    return [
      {
        source: "/sim/:path*",
        destination: `${
          process.env.NEXT_PUBLIC_MANY_LIVES_API_URL ?? "http://127.0.0.1:3000"
        }/:path*`,
      },
    ];
  },
};

export default nextConfig;
