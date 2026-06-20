import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.0.8", "192.168.0.8:3000"],
} as any;

export default nextConfig;
