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
    // Raise body size limit for App Router API routes (default is 1 MB).
    // Vercel hard-caps at 4.5 MB for serverless functions — set to 4mb to stay under.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  serverExternalPackages: ["@google-cloud/documentai"],
  compress: true,
}

export default nextConfig
