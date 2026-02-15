module.exports = {
  extends: ['expo', 'prettier'],
  rules: {
    // Custom rule to prevent quoted color references like 'colors.surface' or "colors.text"
    // This prevents the common mistake of using color theme variables as string literals
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
  },
};
