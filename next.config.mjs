/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS || false;
let repoBasePath = '';

if (isGithubActions && process.env.GITHUB_REPOSITORY) {
  const repoName = process.env.GITHUB_REPOSITORY.replace(/.*?\//, '');
  if (!repoName.endsWith('.github.io')) {
    repoBasePath = `/${repoName}`;
  }
}

const resolvedBase = process.env.NEXT_PUBLIC_BASE_PATH || repoBasePath || undefined;

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: resolvedBase,
  assetPrefix: resolvedBase,
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com'
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com'
      }
    ]
  }
};

export default nextConfig;

