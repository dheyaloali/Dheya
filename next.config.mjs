import {withSentryConfig} from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add headers for CORS and security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  // Enable static exports for Capacitor
  output: isDev ? undefined : 'export',
  // Disable fallback for static export
  trailingSlash: !isDev ? true : false,
  // Skip API routes for static export
  skipTrailingSlashRedirect: !isDev ? true : false,
  // Skip type checking to avoid errors
  skipMiddlewareUrlNormalize: true,
  // Exclude API routes from static export
  experimental: {
    // This is experimental but allows to run `next build` without statically
    // exporting API routes
    appDocumentPreloading: false,
    // Allow importing .md files
    mdxRs: true,
    // Better handling of ES modules
    serverComponentsExternalPackages: ['next-auth'],
    // Improve module resolution
    esmExternals: 'loose'
  },
  // Disable server components for static export
  reactStrictMode: true,
  // Webpack configuration to handle module resolution
  webpack: (config, { isServer }) => {
    // Fix module resolution issues
    if (isServer) {
      config.experiments = {
        ...config.experiments,
        topLevelAwait: true,
      };
    }
    
    return config;
  },
};

export default withNextIntl(nextConfig);