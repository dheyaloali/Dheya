/**
 * Sanitizes and validates input strings
 * @param input The input string to sanitize
 * @returns Sanitized string or null if invalid
 */
export function sanitizeInput(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = input.trim();
  
  // Check if empty after trimming
  if (!trimmed) {
    return null;
  }

  // Remove any HTML tags
  const withoutHtml = trimmed.replace(/<[^>]*>/g, '');
  
  // Special handling for email addresses
  if (withoutHtml.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(withoutHtml)) {
    // If it's a valid email format, return it as is (after HTML sanitization)
    return withoutHtml;
  }
  
  // For non-email inputs, remove any special characters except letters, numbers, spaces, and basic punctuation
  const sanitized = withoutHtml.replace(/[^a-zA-Z0-9\s.,-@_]/g, '');
  
  // Check if result is empty after sanitization
  if (!sanitized) {
    return null;
  }

  return sanitized;
} 