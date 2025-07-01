/**
 * Avatar utility functions for handling user images and fallbacks
 */

interface AvatarImageParams {
  image?: string | null;
  pictureUrl?: string | null;
}

/**
 * Get the appropriate avatar image URL with fallback logic
 * @param params - Object containing image and pictureUrl
 * @returns The best available image URL or empty string
 */
export function getAvatarImage({ image, pictureUrl }: AvatarImageParams): string {
  // Priority: pictureUrl (employee profile) > image (user profile) > fallback
  if (pictureUrl) {
    return pictureUrl;
  }
  
  if (image) {
    return image;
  }
  
  // Return empty string to trigger fallback
  return "";
}

/**
 * Get initials from a name for avatar fallback
 * @param name - The full name to extract initials from
 * @returns Initials (e.g., "John Doe" -> "JD")
 */
export function getAvatarInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') {
    return "U"; // Default fallback
  }
  
  const nameParts = name.trim().split(/\s+/);
  
  if (nameParts.length === 1) {
    // Single name - return first two characters
    return nameParts[0].substring(0, 2).toUpperCase();
  }
  
  // Multiple names - return first letter of each name
  const initials = nameParts
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase();
  
  return initials.substring(0, 2); // Limit to 2 characters
} 