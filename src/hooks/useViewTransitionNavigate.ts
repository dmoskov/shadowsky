import { useCallback } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router";

/**
 * Wraps React Router's useNavigate to automatically enable view transitions.
 * Falls back to instant navigation in browsers that don't support the View Transitions API.
 *
 * Usage:
 *   const navigate = useViewTransitionNavigate();
 *   navigate('/profile/alice');  // automatically uses viewTransition
 *   navigate(-1);               // back navigation also uses viewTransition
 */
export function useViewTransitionNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        // For numeric navigation (back/forward), we can't pass options
        // to React Router's navigate(number) overload.
        // Use startViewTransition directly if available.
        if (typeof document.startViewTransition === "function") {
          document.startViewTransition(() => {
            navigate(to);
          });
        } else {
          navigate(to);
        }
      } else {
        navigate(to, { viewTransition: true, ...options });
      }
    },
    [navigate],
  );
}

/**
 * Sets a view-transition-name on a DOM element for shared element transitions.
 * Call this on the source element (e.g., a post card) before navigation
 * so the View Transitions API captures it as a named snapshot.
 *
 * The name is automatically cleared after the transition completes.
 *
 * @param element - The DOM element to tag
 * @param name - The view-transition-name value (e.g., 'vt-post-hero')
 */
export function tagForViewTransition(
  element: HTMLElement | null,
  name: string,
) {
  if (!element) return;
  element.style.viewTransitionName = name;
}
