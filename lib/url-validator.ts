/**
 * Validates and sanitizes action URLs for notifications
 *
 * This utility ensures URLs are properly formatted while preserving their functionality
 */

/**
 * Validates and sanitizes a notification action URL
 *
 * @param url The URL to validate
 * @returns Validated and sanitized URL or undefined
 */
export function validateActionUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  // Ensure URL starts with /
  if (!url.startsWith('/') && !url.startsWith('http')) {
    url = '/' + url;
  }
  
  // Clean up any double slashes (except for http://)
  url = url.replace(/([^:])\/\//g, '/');
  
  // Sanitize URL to prevent XSS
  url = url.replace(/[<>]/g, '');
  
  return url;
}

/**
 * Checks if a URL is likely to be a valid route in the application
 * This is a non-blocking check that logs warnings but doesn't prevent URLs from being used
 *
 * @param url The URL to check
 * @returns Boolean indicating if the URL is likely valid
 */
export function isLikelyValidRoute(url: string | undefined): boolean {
  if (!url) return false;
  
  // Common route patterns in the application
  const commonRoutePatterns = [
    /^\/admin\/.+/,
    /^\/employee\/.+/,
    /^\/dashboard/,
    /^\/profile/,
    /^\/settings/,
    /^\/documents/,
    /^\/attendance/,
    /^\/sales/,
    /^\/reports/,
    /^\/salaries/,
    /^\/products/,
    /^\/location/,
  ];
  
  // Check if URL matches any common pattern
  return commonRoutePatterns.some(pattern => pattern.test(url));
}
