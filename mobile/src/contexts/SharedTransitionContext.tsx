import React, {createContext, useContext, useState, useCallback, useRef} from 'react';

export interface TransitionSourceLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransitionPostData {
  uri: string;
  authorAvatar?: string;
  authorName?: string;
  authorHandle?: string;
  text?: string;
  imageThumb?: string;
}

interface SharedTransitionState {
  active: boolean;
  sourceLayout: TransitionSourceLayout | null;
  postData: TransitionPostData | null;
}

interface SharedTransitionContextType {
  state: SharedTransitionState;
  startTransition: (
    sourceLayout: TransitionSourceLayout,
    postData: TransitionPostData,
  ) => void;
  completeTransition: () => void;
  cancelTransition: () => void;
  /**
   * Ref-based setter for PostCard to register its layout without triggering re-renders.
   * Call this from PostCard's onPress before navigating.
   */
  prepareTransition: (
    sourceLayout: TransitionSourceLayout,
    postData: TransitionPostData,
  ) => void;
  /**
   * Called by the thread screen once it has rendered, so the overlay can begin animating.
   */
  activateTransition: () => void;
  /** Returns the pending transition data if available (consumed on read). */
  consumePending: () => {
    sourceLayout: TransitionSourceLayout;
    postData: TransitionPostData;
  } | null;
}

const SharedTransitionContext = createContext<SharedTransitionContextType>({
  state: {active: false, sourceLayout: null, postData: null},
  startTransition: () => {},
  completeTransition: () => {},
  cancelTransition: () => {},
  prepareTransition: () => {},
  activateTransition: () => {},
  consumePending: () => null,
});

export function SharedTransitionProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<SharedTransitionState>({
    active: false,
    sourceLayout: null,
    postData: null,
  });

  // Ref for pending transition data (set synchronously before navigation)
  const pendingRef = useRef<{
    sourceLayout: TransitionSourceLayout;
    postData: TransitionPostData;
  } | null>(null);

  const prepareTransition = useCallback(
    (sourceLayout: TransitionSourceLayout, postData: TransitionPostData) => {
      pendingRef.current = {sourceLayout, postData};
    },
    [],
  );

  const activateTransition = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      setState({
        active: true,
        sourceLayout: pending.sourceLayout,
        postData: pending.postData,
      });
    }
  }, []);

  const consumePending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    return pending;
  }, []);

  const startTransition = useCallback(
    (sourceLayout: TransitionSourceLayout, postData: TransitionPostData) => {
      setState({
        active: true,
        sourceLayout,
        postData,
      });
    },
    [],
  );

  const completeTransition = useCallback(() => {
    setState({active: false, sourceLayout: null, postData: null});
  }, []);

  const cancelTransition = useCallback(() => {
    pendingRef.current = null;
    setState({active: false, sourceLayout: null, postData: null});
  }, []);

  return (
    <SharedTransitionContext.Provider
      value={{
        state,
        startTransition,
        completeTransition,
        cancelTransition,
        prepareTransition,
        activateTransition,
        consumePending,
      }}>
      {children}
    </SharedTransitionContext.Provider>
  );
}

export function useSharedTransition() {
  return useContext(SharedTransitionContext);
}
