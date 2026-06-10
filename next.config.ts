import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/watchlist',
        destination: '/companies',
        permanent: true,
      },
      {
        source: '/markets',
        destination: '/research/markets',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
