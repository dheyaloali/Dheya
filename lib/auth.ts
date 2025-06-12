import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { isPasswordComplex, passwordComplexityMessage } from './passwordUtils'

const prisma = new PrismaClient()

// User roles constant
export const ROLES = {
  ADMIN: "admin",
  EMPLOYEE: "employee",
}

// Function to check if a user is an admin
export async function isAdmin(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  })
  return user?.role === ROLES.ADMIN
}

// Function to validate credentials against database
export async function validateCredentials(email: string, password: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) return false

    // Compare password with hashed password in database
    return await bcrypt.compare(password, user.password)
  } catch (error) {
    console.error('Error validating credentials:', error)
    return false
  }
}

// Generate a password reset token
export async function generateResetToken(email: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) return null

  // Generate a random token
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    // Store token in database with expiration
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        resetToken: token,
        resetTokenExpires: new Date(Date.now() + 3600000) // 1 hour from now
      }
  })

  return token
  } catch (error) {
    console.error('Error generating reset token:', error)
    return null
  }
}

// Verify a reset token
export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date()
        }
      }
    })

    return user?.email || null
  } catch (error) {
    console.error('Error verifying reset token:', error)
    return null
  }
}

// Reset a password
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    // Enforce password complexity
    if (!isPasswordComplex(newPassword)) {
      console.error('Password reset failed: ' + passwordComplexityMessage())
    return false
  }
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date()
        }
      }
    })

    if (!user) return false

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null
      }
    })

    return true
  } catch (error) {
    console.error('Error resetting password:', error)
    return false
  }
}

export async function requestPasswordReset(email: string, recaptchaToken: string) {
  try {
    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, recaptchaToken }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Password reset request error:', error);
    return {
      success: false,
      message: 'Failed to send reset link. Please try again.',
    };
  }
}
