/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["@mui/material", "lucide-react", "recharts"],
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  serverExternalPackages: ["@google-cloud/documentai"],
  compress: true,
}

export default nextConfig
