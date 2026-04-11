import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['142.93.72.32', '142.93.72.32:3001'],
  output: 'standalone',
  transpilePackages: ['kurukin-video-player-pkg'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.kuruk.in',
      },
    ],
  },
};

export default nextConfig;
