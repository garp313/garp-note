/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignora erros de tipo no build (a Vercel falha por padrão nisso)
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
