import { config } from 'dotenv';
import { resolve } from 'node:path';
// Monorepo: nạp .env ở repo root cho server runtime (DATABASE_URL, REDIS_URL, ...).
config({ path: resolve(process.cwd(), '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma engine không bundle được → để external phía server.
  serverExternalPackages: ['@prisma/client', '.prisma/client', '@wc/db'],
};

export default nextConfig;
