/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Header preview images can come from any https host the staff configure.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
