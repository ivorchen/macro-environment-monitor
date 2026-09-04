import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["salute-pang-bottom.ngrok-free.dev"],
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
