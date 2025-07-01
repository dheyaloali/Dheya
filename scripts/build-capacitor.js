import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as glob from 'glob';

// Temporary directory to store dynamic route files
const TEMP_DIR = path.join(process.cwd(), '.temp-routes');

// Configuration files that need special handling
const CONFIG_FILES = {
  nextIntl: {
    source: path.join(process.cwd(), 'next-intl.config.js'),
    temp: path.join(TEMP_DIR, 'next-intl.config.js.bak')
  },
  i18n: {
    source: path.join(process.cwd(), 'app/i18n.ts'),
    temp: path.join(TEMP_DIR, 'i18n.ts.bak')
  }
};

// Critical files that need special handling
const CRITICAL_FILES = [
  'app/api/auth/[...nextauth]/route.ts'
];

// Find all dynamic route files that need to be temporarily moved
function findDynamicRoutes() {
  // More comprehensive pattern to catch all dynamic routes
  const patterns = [
    'app/**/\\[**\\]/**/page.tsx',
    'app/**/\\[**\\]/page.tsx',
    'app/**/\\[**\\]/**/route.ts',
    'app/**/\\[**\\]/route.ts',
    'pages/**/\\[**\\].tsx',
    'pages/**/\\[**\\].ts'
  ];
  
  const dynamicRouteFiles = [];
  patterns.forEach(pattern => {
    const files = glob.sync(pattern);
    dynamicRouteFiles.push(...files);
    console.log(`Found ${files.length} files matching pattern: ${pattern}`);
  });
  
  console.log(`Found ${dynamicRouteFiles.length} total dynamic route files`);
  return dynamicRouteFiles;
}

// Detect and resolve route conflicts
function resolveRouteConflicts(files) {
  const pageToRouteMap = new Map();
  const conflictingRoutes = [];
  
  // Find page.tsx and route.ts files that would conflict
  files.forEach(file => {
    const isPage = file.endsWith('page.tsx');
    const isRoute = file.endsWith('route.ts');
    
    if (!isPage && !isRoute) return;
    
    // Get the route path without the file name
    const routePath = path.dirname(file);
    
    if (isPage) {
      pageToRouteMap.set(routePath, file);
    } else if (isRoute) {
      // If we already have a page.tsx for this route, this route.ts conflicts
      if (pageToRouteMap.has(routePath)) {
        conflictingRoutes.push(file);
      }
    }
  });
  
  // Log conflicts
  if (conflictingRoutes.length > 0) {
    console.log(`\nDetected ${conflictingRoutes.length} conflicting routes:`);
    conflictingRoutes.forEach(route => {
      console.log(`- ${route} conflicts with ${pageToRouteMap.get(path.dirname(route))}`);
    });
  }
  
  return conflictingRoutes;
}

// Create temporary directory if it doesn't exist
function createTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`Created temporary directory: ${TEMP_DIR}`);
  }
}

// Move files to temporary directory
function moveToTemp(files) {
  let movedCount = 0;
  let skippedCount = 0;
  
  files.forEach(filePath => {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      
      if (fs.existsSync(fullPath)) {
        // Create a unique name to avoid collisions
        const fileName = path.basename(filePath);
        const dirName = path.dirname(filePath).replace(/[\/\\]/g, '_');
        const tempPath = path.join(TEMP_DIR, `${dirName}_${fileName}`);
        
        fs.copyFileSync(fullPath, tempPath);
        fs.unlinkSync(fullPath);
        console.log(`Moved: ${filePath} → ${tempPath}`);
        movedCount++;
      } else {
        console.log(`File not found (skipping): ${filePath}`);
        skippedCount++;
      }
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err.message);
      skippedCount++;
    }
  });
  
  console.log(`Successfully moved ${movedCount} files, skipped ${skippedCount} files`);
}

// Restore files from temporary directory
function restoreFromTemp(files) {
  let restoredCount = 0;
  let failedCount = 0;
  
  files.forEach(filePath => {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const fileName = path.basename(filePath);
      const dirName = path.dirname(filePath).replace(/[\/\\]/g, '_');
      const tempPath = path.join(TEMP_DIR, `${dirName}_${fileName}`);
      
      if (fs.existsSync(tempPath)) {
        // Make sure the directory exists
        const dirPath = path.dirname(fullPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.copyFileSync(tempPath, fullPath);
        console.log(`Restored: ${tempPath} → ${filePath}`);
        restoredCount++;
      } else {
        console.log(`Temp file not found: ${tempPath}`);
        failedCount++;
      }
    } catch (err) {
      console.error(`Error restoring ${filePath}:`, err.message);
      failedCount++;
    }
  });
  
  console.log(`Successfully restored ${restoredCount} files, failed to restore ${failedCount} files`);
}

// Backup configuration files
function backupConfigFiles() {
  Object.values(CONFIG_FILES).forEach(({ source, temp }) => {
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, temp);
      console.log(`Backed up: ${source} → ${temp}`);
    }
  });
}

// Restore configuration files
function restoreConfigFiles() {
  Object.values(CONFIG_FILES).forEach(({ source, temp }) => {
    if (fs.existsSync(temp)) {
      fs.copyFileSync(temp, source);
      console.log(`Restored: ${temp} → ${source}`);
    }
  });
}

// Clean up temporary directory
function cleanupTempDir() {
  try {
    if (fs.existsSync(TEMP_DIR)) {
      fs.readdirSync(TEMP_DIR).forEach(file => {
        fs.unlinkSync(path.join(TEMP_DIR, file));
      });
      fs.rmdirSync(TEMP_DIR);
      console.log(`Removed temporary directory: ${TEMP_DIR}`);
    }
  } catch (err) {
    console.error(`Error cleaning up temp directory:`, err.message);
  }
}

// Create static placeholders for dynamic routes
function createStaticPlaceholders(dynamicRoutes) {
  dynamicRoutes.forEach(filePath => {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const dirPath = path.dirname(fullPath);
      
      // Special handling for NextAuth route
      if (filePath.includes('api/auth/[...nextauth]/route.ts')) {
        // Create a functional NextAuth placeholder that imports authOptions from lib/auth
        const staticContent = `import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

// Export the NextAuth handler
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }`;
        
        // Make sure the directory exists
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(fullPath, staticContent);
        console.log(`\nCreated functional NextAuth placeholder for: ${filePath}`);
        return;
      }
      
      // Regular static placeholder for other routes
      const isPage = filePath.endsWith('page.tsx');
      const staticContent = isPage ? 
        `// Add force-static export configuration for static builds
export const dynamic = "force-static";
export const revalidate = false;

export default function StaticPlaceholder() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Static Placeholder</h1>
      <p className="text-gray-500">
        This is a static placeholder for a dynamic route.
        In the native app, this page will be dynamically generated.
      </p>
    </div>
  );
}` :
        `// This is a static placeholder for a dynamic route
// It will be replaced with the actual file after the build
export const dynamic = "force-static";
export const revalidate = false;

// For API routes
export async function GET() {
  return new Response(JSON.stringify({ message: 'Static placeholder' }), {
    headers: { 'content-type': 'application/json' },
  });
}`;
      
      // Make sure the directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, staticContent);
      console.log(`\nCreated static placeholder for: ${filePath}`);
    } catch (err) {
      console.error(`Error creating placeholder for ${filePath}:`, err.message);
    }
  });
}

// Try to clean up the .next directory to prevent EPERM errors
function cleanNextDirectory() {
  try {
    const nextDir = path.join(process.cwd(), '.next');
    if (fs.existsSync(nextDir)) {
      const traceDir = path.join(nextDir, 'trace');
      if (fs.existsSync(traceDir)) {
        fs.rmSync(traceDir, { recursive: true, force: true });
        console.log('Removed .next/trace directory to prevent EPERM errors');
      }
    }
  } catch (error) {
    console.warn('Failed to clean .next directory:', error.message);
  }
}

// Main execution
try {
  console.log('=== Enhanced Capacitor Build Process ===');
  
  // Get all dynamic routes
  const dynamicRoutes = findDynamicRoutes();
  
  // Detect and resolve route conflicts
  const conflictingRoutes = resolveRouteConflicts(dynamicRoutes);
  
  // Clean .next directory to prevent EPERM errors
  cleanNextDirectory();
  
  console.log('\n1. Setting up temporary directory...');
  createTempDir();
  
  console.log('\n2. Backing up configuration files...');
  backupConfigFiles();
  
  console.log('\n3. Temporarily moving dynamic route files...');
  moveToTemp(dynamicRoutes);
  
  console.log('\n4. Creating static placeholders for dynamic routes...');
  // Don't create placeholders for conflicting routes
  const routesToCreate = dynamicRoutes.filter(route => !conflictingRoutes.includes(route));
  createStaticPlaceholders(routesToCreate);
  
  console.log('\n5. Running Next.js build for mobile...');
  execSync('pnpm exec cross-env NEXT_DISABLE_ESLINT=1 EXPORT_MOBILE=true next build', { stdio: 'inherit' });
  
  console.log('\n6. Syncing with Capacitor...');
  execSync('pnpm exec cap sync', { stdio: 'inherit' });
  
  console.log('\n7. Restoring dynamic route files...');
  restoreFromTemp(dynamicRoutes);
  
  console.log('\n8. Restoring configuration files...');
  restoreConfigFiles();
  
  console.log('\n9. Cleaning up...');
  cleanupTempDir();
  
  console.log('\n10. Running NextAuth fix script...');
  execSync('node --experimental-modules scripts/fix-nextauth.js', { stdio: 'inherit' });
  
  console.log('\n=== Build completed successfully! ===');
  console.log('You can now run "pnpm cap open android" or "pnpm cap open ios" to open the project in Android Studio or Xcode.');
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  
  // Always try to restore files even if build fails
  console.log('\nAttempting to restore files...');
  const dynamicRoutes = findDynamicRoutes();
  restoreFromTemp(dynamicRoutes);
  restoreConfigFiles();
  cleanupTempDir();
  
  // Run NextAuth fix script even if build fails
  try {
    console.log('\nRunning NextAuth fix script...');
    execSync('node --experimental-modules scripts/fix-nextauth.js', { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to run NextAuth fix script:', e.message);
  }
  
  process.exit(1);
} 