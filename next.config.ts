import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  reactStrictMode: true,

  // Cho phép iframe embed Streamlit từ bất kỳ origin nào được cấu hình
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
