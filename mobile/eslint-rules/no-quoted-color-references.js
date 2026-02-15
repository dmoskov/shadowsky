/**
 * ESLint rule to prevent quoted color references
 *
 * This rule catches common mistakes where color theme variables are used as
 * string literals instead of actual variable references.
 *
 * Examples:
 *   BAD:  backgroundColor: 'colors.surface'
 *   GOOD: backgroundColor: colors.surface
 *
 *   BAD:  color: "colors.text"
 *   GOOD: color: colors.text
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow quoted color theme references',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      quotedColorReference:
        'Color reference should not be a string literal. Remove quotes from "{{value}}" to use the actual color variable.',
    },
  },

  create(context) {
    // Pattern to match quoted strings that look like color references
    // Matches: 'colors.xyz', "colors.xyz", 'theme.colors.xyz', "theme.colors.xyz"
    const quotedColorPattern = /^(['"])((?:theme\.)?colors\.[a-zA-Z]+)\1$/;

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          const match = node.raw.match(quotedColorPattern);

          if (match) {
            const colorReference = match[2]; // Extract the color reference without quotes

            context.report({
              node,
              messageId: 'quotedColorReference',
              data: {
                value: colorReference,
              },
              fix(fixer) {
                // Auto-fix: remove the quotes
                return fixer.replaceText(node, colorReference);
              },
            });
          }
        }
      },
    };
  },
};
