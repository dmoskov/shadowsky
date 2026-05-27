/**
 * Composer - Post composer component
 *
 * This is a simplified wrapper that exports the refactored Composer component.
 * The refactored version uses modular sub-components for better maintainability.
 *
 */

export { ComposerRefactored as Composer } from "./composer/ComposerRefactored";
export default ComposerRefactored;

// Re-export from ComposerRefactored for backwards compatibility
import ComposerRefactored from "./composer/ComposerRefactored";
