/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material", "lucide-react", "recharts"],
  },
  compress: true,
}

export default nextConfig
