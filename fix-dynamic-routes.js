import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template for page.tsx files
const pageTemplate = `// This is a placeholder page for static export
export default function DynamicPage() {
  return (
    <div>
      <h1>Dynamic Page</h1>
      <p>This page would normally show dynamic content.</p>
    </div>
  );
}

// This function is required for static export with dynamic routes
export function generateStaticParams() {
  // Return an empty array for static export
  // In a real app, you would fetch IDs from your database
  return [];
}`;

// Function to recursively find all directories with names in square brackets
function findDynamicRoutes(dir, dynamicDirs = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      if (item.name.startsWith('[') && item.name.endsWith(']')) {
        dynamicDirs.push(fullPath);
      }
      // Recursively search subdirectories
      findDynamicRoutes(fullPath, dynamicDirs);
    }
  }
  
  return dynamicDirs;
}

// Function to ensure page.tsx exists in dynamic route directories
function fixDynamicRoutes(dynamicDirs) {
  for (const dir of dynamicDirs) {
    const pagePath = path.join(dir, 'page.tsx');
    
    // Skip if page.tsx already exists
    if (fs.existsSync(pagePath)) {
      console.log(`Skipping ${pagePath} - already exists`);
      continue;
    }
    
    // Create page.tsx with template
    fs.writeFileSync(pagePath, pageTemplate);
    console.log(`Created ${pagePath}`);
  }
}

// Main function
function main() {
  const appDir = path.join(__dirname, 'app');
  const dynamicDirs = findDynamicRoutes(appDir);
  
  console.log(`Found ${dynamicDirs.length} dynamic routes`);
  fixDynamicRoutes(dynamicDirs);
  console.log('Done!');
}

main(); 