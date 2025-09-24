module.exports = {
  extends: ["./.eslintrc.js"],
  plugins: ["react-hooks", "react"],
  rules: {
    // Enforce memoization for performance
    "react/jsx-no-bind": [
      "warn",
      {
        allowArrowFunctions: false,
        allowBind: false,
        ignoreRefs: true,
        allowFunctions: false,
      },
    ],

    // Warn about missing dependencies in hooks
    "react-hooks/exhaustive-deps": [
      "warn",
      {
        additionalHooks: "(useMyCustomHook|useAnimationFrame)",
      },
    ],

    // Ensure hooks are used correctly
    "react-hooks/rules-of-hooks": "error",

    // Custom rules for performance
    "no-restricted-syntax": [
      "warn",
      {
        selector:
          'CallExpression[callee.name="map"]:not(:has(CallExpression[callee.object.name="React"][callee.property.name="memo"]))',
        message:
          "Consider using React.memo for components rendered in lists/maps",
      },
    ],
  },

  overrides: [
    {
      files: ["**/components/**/*.tsx", "**/components/**/*.jsx"],
      rules: {
        // Stricter rules for component files
        "react/jsx-no-bind": "error",
      },
    },
    {
      files: ["**/*Feed*.tsx", "**/*List*.tsx", "**/*Table*.tsx"],
      rules: {
        // Extra strict for list/feed components
        "react/jsx-no-bind": "error",
        "no-restricted-syntax": [
          "error",
          {
            selector:
              'ExportDefaultDeclaration:not(:has(CallExpression[callee.object.name="React"][callee.property.name="memo"]))',
            message: "Feed/List components must be wrapped with React.memo",
          },
        ],
      },
    },
  ],
};
