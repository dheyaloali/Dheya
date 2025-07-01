import { validateActionUrl, isLikelyValidRoute } from './url-validator';

/**
 * Test function to verify URL validation is working correctly
 */
export function testNotificationUrlValidation() {
  console.log('🧪 Testing Notification URL Validation...\n');

  const testCases = [
    { url: '/employee/dashboard', expected: true, description: 'Valid employee dashboard URL' },
    { url: '/admin/reports', expected: true, description: 'Valid admin reports URL' },
    { url: 'employee/dashboard', expected: true, description: 'URL missing leading slash' },
    { url: 'https://malicious-site.com', expected: false, description: 'External malicious URL' },
  ];

  let passedTests = 0;
  testCases.forEach(({ url, expected, description }) => {
    const validatedUrl = validateActionUrl(url);
    const isValidRoute = isLikelyValidRoute(validatedUrl);
    const testPassed = isValidRoute === expected;
    
    if (testPassed) passedTests++;
    
    console.log(`${testPassed ? '✅' : '❌'} ${description}: ${isValidRoute === expected ? 'PASS' : 'FAIL'}`);
  });

  console.log(`\n📊 Results: ${passedTests}/${testCases.length} tests passed`);
  return passedTests === testCases.length;
}

// Run tests if executed directly
if (typeof window === 'undefined') {
  testNotificationUrlValidation();
}
