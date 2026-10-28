import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-only Next.js badge so it does not cover the navbar.
  devIndicators: false,
  // Passport must run as a plain Node module, not bundled.
  serverExternalPackages: ["passport", "passport-google-oauth20"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  // The old syllabus browser now lives inside Ask your Syllabus. Query strings (?branch=&year=) pass through.
  async redirects() {
    return [{ source: "/syllabus", destination: "/ask", permanent: true }];
  },
};

export default nextConfig;
