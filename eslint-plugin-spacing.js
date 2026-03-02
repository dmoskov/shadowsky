/**
 * Custom ESLint rule: no-raw-spacing
 *
 * Prevents raw numeric literals in spacing-related style properties
 * (padding, margin, gap) within React Native mobile components.
 * Enforces use of the shared `spacing` constants from src/theme/spacing.ts.
 */

const SPACING_PROPERTIES = new Set([
  "padding",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingHorizontal",
  "paddingVertical",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "gap",
  "rowGap",
  "columnGap",
]);

/** @type {import('eslint').Rule.RuleModule} */
const noRawSpacing = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow raw numeric literals in spacing properties; use spacing constants instead",
    },
    messages: {
      noRawSpacing:
        "Use spacing constants (e.g. spacing.sm) instead of raw number {{value}} for {{property}}.",
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        if (
          node.key &&
          node.key.type === "Identifier" &&
          SPACING_PROPERTIES.has(node.key.name) &&
          node.value &&
          node.value.type === "Literal" &&
          typeof node.value.value === "number"
        ) {
          context.report({
            node: node.value,
            messageId: "noRawSpacing",
            data: {
              value: String(node.value.value),
              property: node.key.name,
            },
          });
        }
      },
    };
  },
};

export default {
  rules: {
    "no-raw-spacing": noRawSpacing,
  },
};
