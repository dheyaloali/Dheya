const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../app/api');

function getAllRouteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllRouteFiles(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
}

function checkRequireAuth(file) {
  const content = fs.readFileSync(file, 'utf8');
  const hasImport = content.includes('requireAuth');
  const hasUsage = content.match(/requireAuth\s*\(/);
  return hasImport && hasUsage;
}

const files = getAllRouteFiles(API_DIR);
let unprotected = [];

files.forEach(file => {
  if (!checkRequireAuth(file)) {
    unprotected.push(file);
  }
});

if (unprotected.length === 0) {
  console.log('✅ All API routes are protected with requireAuth.');
} else {
  console.warn('⚠️ The following API route files may be missing requireAuth:');
  unprotected.forEach(f => console.warn(' -', path.relative(process.cwd(), f)));
  process.exitCode = 1;
} 