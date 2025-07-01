import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== NextAuth Fix Script ===');
console.log('Current directory:', process.cwd());
console.log('Script directory:', __dirname);

// Path to the NextAuth route file
const nextAuthPath = path.join(process.cwd(), 'app/api/auth/[...nextauth]/route.ts');
const tempNextAuthPath = path.join(process.cwd(), '.temp-routes/app_api_auth_[...nextauth]_route.ts');
const libAuthPath = path.join(process.cwd(), 'lib/auth.ts');

console.log(`Looking for NextAuth file at: ${nextAuthPath}`);
console.log(`Looking for temp NextAuth file at: ${tempNextAuthPath}`);
console.log(`Looking for lib/auth.ts file at: ${libAuthPath}`);

// Check if NextAuth file exists
console.log(`NextAuth file exists: ${fs.existsSync(nextAuthPath)}`);
if (fs.existsSync(nextAuthPath)) {
  console.log('Current NextAuth content:');
  console.log(fs.readFileSync(nextAuthPath, 'utf8').substring(0, 100) + '...');
}

// Check if the temp file exists
console.log(`Temp NextAuth file exists: ${fs.existsSync(tempNextAuthPath)}`);
if (fs.existsSync(tempNextAuthPath)) {
  console.log('Found backup NextAuth implementation in .temp-routes');
  
  try {
    // Read the temp file
    const tempContent = fs.readFileSync(tempNextAuthPath, 'utf8');
    console.log('Temp content preview:');
    console.log(tempContent.substring(0, 100) + '...');
    
    // Extract the actual implementation (remove the static placeholder comments if they exist)
    const implementation = tempContent.includes('// This is a static placeholder') 
      ? tempContent.split('export const revalidate = false;\n\n')[1]
      : tempContent;
    
    if (!implementation) {
      console.error('Could not extract implementation from temp file');
      process.exit(1);
    }
    
    console.log('Implementation preview:');
    console.log(implementation.substring(0, 100) + '...');
    
    // Write the implementation to the actual file
    fs.writeFileSync(nextAuthPath, implementation);
    console.log('Successfully restored NextAuth implementation');
  } catch (error) {
    console.error('Error restoring NextAuth implementation:', error.message);
    process.exit(1);
  }
} else {
  console.log('No backup NextAuth implementation found in .temp-routes');
  console.log('Creating a new implementation...');
  
  // Create a new NextAuth implementation
  const newImplementation = `import NextAuth from "next-auth"
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isApproved: user.isApproved,
          mfaEnabled: user.mfaEnabled,
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.isApproved = user.isApproved
        token.mfaEnabled = user.mfaEnabled
        // Determine if user is admin based on role
        token.isAdmin = user.role === 'admin'
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.isApproved = token.isApproved as boolean
        session.user.mfaEnabled = token.mfaEnabled as boolean
        session.user.isAdmin = token.isAdmin as boolean
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }`;

  try {
    // Make sure the directory exists
    const dirPath = path.dirname(nextAuthPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Write the implementation to the file
    fs.writeFileSync(nextAuthPath, newImplementation);
    console.log('Successfully created new NextAuth implementation');
  } catch (error) {
    console.error('Error creating NextAuth implementation:', error.message);
    process.exit(1);
  }
}

// Fix the NextAuth route file
console.log('\n1. Fixing NextAuth route file...');
const nextAuthContent = `import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Export the NextAuth handler
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };`;

fs.writeFileSync(nextAuthPath, nextAuthContent);
console.log('Successfully updated NextAuth route file');

// Update files that import authOptions
console.log('\n2. Updating files that import authOptions...');
const filesToUpdate = [
  'lib/auth-guard.ts',
  'lib/validate-session.ts',
  'app/api/notifications/mark-all-read/route.ts',
  'app/api/notifications/route.ts',
  'app/api/notifications/unread-count/route.ts',
  'app/api/notifications/register-device/route.ts',
  'app/api/admin/settings/route.ts',
  'app/api/admin/security-settings/route.ts',
  'app/api/admin/employee/attendance/route.ts'
];

let updatedCount = 0;
for (const file of filesToUpdate) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      // Replace import statement
      const updatedContent = content.replace(
        /import\s+{\s*authOptions\s*}\s+from\s+['"]@\/app\/api\/auth\/\[\.\.\.nextauth\]\/route['"];?/,
        `import { authOptions } from '@/lib/auth';`
      );
      
      if (content !== updatedContent) {
        fs.writeFileSync(filePath, updatedContent);
        updatedCount++;
        console.log(`Updated imports in ${file}`);
      }
    } catch (error) {
      console.error(`Error updating ${file}:`, error.message);
    }
  } else {
    console.log(`File not found: ${file}`);
  }
}

console.log(`Updated ${updatedCount} files with correct imports`);

// Run Next.js dev to clear cache
console.log('\n3. Clearing Next.js cache...');
try {
  execSync('pnpm exec next clean', { stdio: 'inherit' });
  console.log('Successfully cleared Next.js cache');
} catch (error) {
  console.error('Failed to clear Next.js cache:', error.message);
}

console.log('\n=== NextAuth Fix Complete ==='); 