/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  // Tell Next.js not to bundle DuckDB's native C++ binaries
  serverExternalPackages: ['duckdb', 'duckdb-async'],
};

module.exports = nextConfig;