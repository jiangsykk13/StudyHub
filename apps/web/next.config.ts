import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@studyhub/ui", "@studyhub/shared", "@studyhub/config"],
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`
      }
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
