import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withNextIntl = require('next-intl/plugin')('./app/i18n.ts');

/** @type {import('next').NextConfig} */
const isMobileExport = process.env.EXPORT_MOBILE === 'true';

// Identify problematic dependencies for static export
const problematicDependencies = [
  'require-in-the-middle',
  '@opentelemetry/instrumentation',
  '@opentelemetry',
  '@sentry/node',
  '@sentry/nextjs',
  '@sentry'
];

// Try to delete the .next/trace directory to prevent EPERM errors
try {
  const tracePath = join(process.cwd(), '.next', 'trace');
  if (fs.existsSync(tracePath)) {
    fs.rmSync(tracePath, { recursive: true, force: true });
    console.log('Removed .next/trace directory to prevent EPERM errors');
  }
} catch (error) {
  console.warn('Failed to remove .next/trace directory:', error.message);
}

// Create a more robust Next.js configuration
const nextConfig = {
  // Only use static export for mobile builds, and not in development
  ...((isMobileExport && process.env.NODE_ENV === 'production') ? { output: 'export' } : {}),
  
  // Always unoptimize images for compatibility
  images: {
    unoptimized: true,
  },
  
  // Enable trailing slash for better compatibility
  ...(isMobileExport ? { trailingSlash: true } : {}),
  
  // Asset prefix for mobile builds - must start with a slash for Next.js font
  ...(isMobileExport ? { assetPrefix: '/' } : {}),
  
  reactStrictMode: true,
  
  // Handle static file imports for Leaflet and disable problematic modules in static export
  webpack: (config, { isServer, webpack }) => {
    config.module.rules.push({
      test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
      type: 'asset',
    });
    
    // Add environment variables to indicate we're disabling monitoring
    if (webpack && webpack.DefinePlugin) {
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.NEXT_PUBLIC_DISABLE_SENTRY': JSON.stringify(true),
          'process.env.NEXT_PUBLIC_DISABLE_TELEMETRY': JSON.stringify(true),
          'process.env.IS_CAPACITOR_BUILD': JSON.stringify(isMobileExport),
        })
      );
    }
    
    // Only apply these changes for client-side code in mobile export mode
    if (isMobileExport) {
      // Define capacitor packages to exclude from the build
      const capacitorPackages = [
        '@capacitor/core',
        '@capacitor/app',
        '@capacitor/camera',
        '@capacitor/device',
        '@capacitor/geolocation',
        '@capacitor/network',
        '@capacitor/push-notifications',
        '@capacitor/preferences',
        '@capacitor-community/background-geolocation',
      ];
      
      // For client-side code, exclude Capacitor packages from the bundle
      if (!isServer) {
        // Use a more reliable approach to exclude Capacitor packages
        config.resolve.fallback = {
          ...config.resolve.fallback,
          // Add Node.js polyfills needed by Capacitor plugins
          path: false,
          fs: false,
          os: false,
        };
        
        // Use externals to exclude Capacitor packages and problematic dependencies
        config.externals = [
          ...(config.externals || []),
          // Function to exclude Capacitor packages and problematic dependencies
          ({ context, request }, callback) => {
            // Exclude Capacitor packages
            if (capacitorPackages.some(pkg => request.startsWith(pkg))) {
              return callback(null, 'commonjs ' + request);
            }
            
            // Handle problematic dependencies in static export
            if (isMobileExport && problematicDependencies.some(pkg => request.includes(pkg))) {
              console.log(`Excluding problematic dependency: ${request}`);
              return callback(null, '{}');
            }
            
            callback();
          }
        ];
      }
      
      // Completely replace Sentry and OpenTelemetry modules with empty objects
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^@sentry\/.*/,
          join(__dirname, './lib/mocks/sentry-mock.js')
        ),
        new webpack.NormalModuleReplacementPlugin(
          /^@opentelemetry\/.*/,
          join(__dirname, './lib/mocks/opentelemetry-mock.js')
        )
      );
      
      // Ignore specific files that cause issues
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(require-in-the-middle|@sentry\/|@opentelemetry\/)/,
        })
      );
    }
    
    return config;
  },
  
  // Disable type checking during build for mobile export
  ...(isMobileExport ? { typescript: { ignoreBuildErrors: true } } : {}),
  
  // Disable ESLint during build for mobile export
  ...(isMobileExport ? { eslint: { ignoreDuringBuilds: true } } : {}),
  
  // Skip source maps in production for mobile export
  ...(isMobileExport ? { productionBrowserSourceMaps: false } : {}),
  
  // Configure experimental options
  experimental: {
    // Disable features that might cause file permission issues
    ...(isMobileExport ? {
      disableOptimizedLoading: true,
      optimizeCss: false,
    } : {}),
  },
}

// Export the final configuration
export default withNextIntl(nextConfig); 