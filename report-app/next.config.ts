import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname),

  // Tăng timeout cho compilation
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Tối ưu hóa build
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // Giảm thời gian compile
  reactStrictMode: true,
};

export default nextConfig;
