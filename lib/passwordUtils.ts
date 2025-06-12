// lib/passwordUtils.ts
// Utility for password complexity validation

/**
 * Checks if a password meets complexity requirements:
 * - Minimum 12 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * Returns true if valid, false otherwise.
 */
export function isPasswordComplex(password: string): boolean {
  if (password.length < 12) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

/**
 * Returns a human-readable message for password requirements.
 */
export function passwordComplexityMessage(): string {
  return 'Password must be at least 12 characters long and include uppercase, lowercase, number, and special character.';
} 