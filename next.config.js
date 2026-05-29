/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Tell next/image which hosts it's allowed to optimize from.
    // Supabase Storage serves public objects from <project-ref>.supabase.co.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    // These must not be bundled: sharp loads native binaries, firebase-admin
    // pulls in gRPC/native deps, and Prisma ships its own engine.
    serverComponentsExternalPackages: ["sharp", "@prisma/client", "firebase-admin"],
  },
};

module.exports = nextConfig;
