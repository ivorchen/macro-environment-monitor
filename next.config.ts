import type { NextConfig } from "next";

const allowedDevOrigins = (() => {
  if (!process.env.APP_URL) return [];
  try {
    return [new URL(process.env.APP_URL).hostname];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  allowedDevOrigins,
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
