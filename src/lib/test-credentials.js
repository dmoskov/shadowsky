/**
 * CommonJS version of test credentials helper
 * This module provides a type-safe way to access test credentials
 * from environment variables instead of hardcoded values.
 */

/**
 * Get test credentials from environment variables
 * @throws Error if credentials are not properly configured
 */
function getTestCredentials() {
  const identifier = process.env.VITE_TEST_IDENTIFIER;
  const password = process.env.VITE_TEST_PASSWORD;

  if (!identifier || !password) {
    throw new Error(
      'Test credentials not configured. Please copy .env.example to .env.local and fill in your test account details.'
    );
  }

  // Basic validation
  if (!identifier.includes('@') && !identifier.includes('.')) {
    console.warn('Test identifier appears to be invalid. Expected email or handle format.');
  }

  return {
    identifier,
    password
  };
}

/**
 * Check if test credentials are available
 */
function hasTestCredentials() {
  return !!(
    process.env.VITE_TEST_IDENTIFIER && 
    process.env.VITE_TEST_PASSWORD
  );
}

module.exports = {
  getTestCredentials,
  hasTestCredentials
};