/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['autoui-react'], // Add the package to ensure it gets transpiled
}

module.exports = nextConfig 