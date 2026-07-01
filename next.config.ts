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
      {
        source: '/monthly-watchlist',
        destination: '/stocks/watchlist',
        permanent: true,
      },
      {
        source: '/stocks',
        destination: '/stocks/watchlist',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
