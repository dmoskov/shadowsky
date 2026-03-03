/**
 * Accessibility constants following Apple HIG guidelines.
 * https://developer.apple.com/design/human-interface-guidelines/accessibility#Touch-targets
 */

/** Minimum tap target size in points per Apple HIG */
export const MIN_TAP_TARGET = 44;

/** Standard hitSlop to expand small visual elements to meet 44pt minimum */
export const MIN_TAP_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
