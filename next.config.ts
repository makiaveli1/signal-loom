import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'localhost:3098',
    '127.0.0.1:3098',
  ],
};

export default nextConfig;
