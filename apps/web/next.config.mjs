/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma engine không bundle được → để external phía server.
  serverExternalPackages: ['@prisma/client', '.prisma/client', '@wc/db'],
};

export default nextConfig;
