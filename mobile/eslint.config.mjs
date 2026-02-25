import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import shadowskyMobilePlugin from 'eslint-plugin-shadowsky-mobile';

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'shadowsky-mobile': shadowskyMobilePlugin,
    },
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

      // Custom rule to catch quoted color references with auto-fix
      'shadowsky-mobile/no-quoted-color-references': 'error',

      // -- Unsafe native module calls --
      // Native APIs (expo-*, react-native) can throw when the native bridge is unavailable.
      // All calls should be wrapped in try/catch.
      'shadowsky-mobile/no-unsafe-native-call': 'warn',

      // -- Console statements --
      // Catches console.log left from debugging. console.warn and console.error are allowed.
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // Relax typescript-eslint rules that are too strict for this codebase
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // Disable preserve-caught-error — too noisy for existing catch/re-throw patterns
      'preserve-caught-error': 'off',

      // -- React Native specific rules --
      // eslint-plugin-react-native v4.1.0 is incompatible with ESLint 10
      // (uses removed context.getSourceCode API). Disabled until plugin is updated.
      // 'react-native/no-unused-styles': 'warn',
      // 'react-native/no-inline-styles': 'warn',
      // 'react-native/no-raw-text': 'off',
    },
  },
  {
    // Allow console.log in the debug utility since that's its purpose
    files: ['**/debug.ts', '**/debug.js', '**/debug-*.ts', '**/debug-*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Allow console.log in test files for debugging tests
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'ios/**',
      'android/**',
      'eslint-rules/**',
    ],
  },
]);
