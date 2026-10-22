import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.3.136'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rzvfghbmcfliqailseeh.supabase.co', // <-- URL do SEU projeto
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;