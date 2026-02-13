/**
 * Composer - Post composer component
 *
 * This is a simplified wrapper that exports the refactored Composer component.
 * The refactored version uses modular sub-components for better maintainability.
 *
 * Original 3714 LOC Composer has been moved to Composer.legacy.tsx for reference.
 */

export { ComposerRefactored as Composer } from "./composer/ComposerRefactored";
export default ComposerRefactored;

// Re-export from ComposerRefactored for backwards compatibility
import ComposerRefactored from "./composer/ComposerRefactored";
