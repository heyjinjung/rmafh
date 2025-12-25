/** @type {import('next').NextConfig} */
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const normalizedBasePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+/, '').replace(/\/+$/, '')}`
  : '';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  ...(normalizedBasePath ? { basePath: normalizedBasePath, assetPrefix: normalizedBasePath } : {}),
};

module.exports = nextConfig;
