import fs from 'fs';
import path from 'path';

// List of placeholder page files to delete
const placeholderPages = [
  'app/api/auth/[...nextauth]/page.tsx',
  'app/api/salaries/[id]/page.tsx',
  'app/api/notifications/[id]/page.tsx',
  'app/api/employees/[id]/page.tsx',
  'app/api/auth/email-verification/verify/[token]/page.tsx',
  'app/api/employee/reports/[id]/page.tsx',
  'app/api/employee/documents/[id]/page.tsx',
  'app/api/employee/documents/delete-requests/[id]/page.tsx',
  'app/api/admin/reports/[id]/page.tsx',
  'app/api/admin/users/[id]/page.tsx',
  'app/api/admin/products/[id]/page.tsx',
  'app/(auth)/reset-password/[token]/page.tsx',
  'app/admin/(dashboard)/employees/employees/[id]/page.tsx',
  'app/api/admin/documents/[id]/page.tsx',
  'app/api/admin/documents/delete-requests/[id]/page.tsx'
];

// Function to delete a file
function deleteFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    
    // Check if file exists
    if (fs.existsSync(fullPath)) {
      // Delete the file
      fs.unlinkSync(fullPath);
      console.log(`✅ Deleted: ${filePath}`);
    } else {
      console.log(`⚠️ File not found: ${filePath}`);
    }
  } catch (err) {
    console.error(`❌ Error deleting ${filePath}:`, err.message);
  }
}

// Main execution
console.log('=== Removing Placeholder Pages ===');
let deletedCount = 0;
let notFoundCount = 0;
let errorCount = 0;

for (const filePath of placeholderPages) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    
    // Check if file exists
    if (fs.existsSync(fullPath)) {
      // Check if it's a placeholder file by reading first line
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('This is a placeholder page for static export')) {
        // Delete the file
        fs.unlinkSync(fullPath);
        console.log(`✅ Deleted: ${filePath}`);
        deletedCount++;
      } else {
        console.log(`⚠️ Not a placeholder file, skipping: ${filePath}`);
      }
    } else {
      console.log(`⚠️ File not found: ${filePath}`);
      notFoundCount++;
    }
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err.message);
    errorCount++;
  }
}

console.log('\n=== Summary ===');
console.log(`Total files processed: ${placeholderPages.length}`);
console.log(`Files deleted: ${deletedCount}`);
console.log(`Files not found: ${notFoundCount}`);
console.log(`Errors: ${errorCount}`); 
 