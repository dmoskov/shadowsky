module.exports = {
  extends: ['expo', 'prettier'],
  plugins: ['react-native', 'shadowsky-mobile'],
  rules: {
    // -- Quoted color references --
    // Prevents the common mistake of using color theme variables as string literals
    // BAD:  backgroundColor: 'colors.surface'
    // GOOD: backgroundColor: colors.surface
    'no-restricted-syntax': [
      'error',
      {
        selector: "Literal[value=/^(theme\\.)?colors\\./]",
        message:
          'Color reference should not be a string literal. Remove quotes to use the actual color variable (e.g., use colors.surface instead of "colors.surface")',
      },
    ],

    // Custom rule (from eslint-rules/) to catch quoted color references with auto-fix
    'shadowsky-mobile/no-quoted-color-references': 'error',

    // -- Unsafe native module calls --
    // Native APIs (expo-*, react-native) can throw when the native bridge is unavailable.
    // All calls should be wrapped in try/catch.
    'shadowsky-mobile/no-unsafe-native-call': 'warn',

    // -- Console statements --
    // Catches console.log left from debugging. console.warn and console.error are allowed
    // since they serve legitimate purposes in production.
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

    // -- React Native specific rules (from eslint-plugin-react-native) --
    // Prevent unused styles in StyleSheet.create
    'react-native/no-unused-styles': 'warn',

    // Prevent inline styles for performance (they create new objects every render)
    'react-native/no-inline-styles': 'warn',

    // Detect raw text outside of Text components (crashes on iOS)
    'react-native/no-raw-text': 'off', // Disabled: too noisy with conditional rendering
  },
  overrides: [
    {
      // Allow console.log in the debug utility since that's its purpose
      files: ['**/debug.ts', '**/debug.js', '**/debug-*.ts', '**/debug-*.js'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      // Allow console.log in test files for debugging tests
      files: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
