import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/watchlist',
        destination: '/companies',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
