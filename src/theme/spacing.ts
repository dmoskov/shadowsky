/**
 * Spacing constants following a 4/8pt grid system.
 *
 * All padding, margin, and gap values in mobile components should
 * use these constants to ensure visual consistency across the app.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingKey = keyof typeof spacing;
export type SpacingValue = (typeof spacing)[SpacingKey];
