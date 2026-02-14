import React, {createContext, useContext, useState, useCallback} from 'react';

export interface LightboxImage {
  thumb: string;
  fullsize: string;
  alt?: string;
}

export interface SourceLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LightboxState {
  visible: boolean;
  images: LightboxImage[];
  index: number;
  sourceLayout: SourceLayout | null;
}

interface LightboxContextType {
  state: LightboxState;
  openLightbox: (
    images: LightboxImage[],
    index: number,
    sourceLayout?: SourceLayout | null,
  ) => void;
  closeLightbox: () => void;
}

const LightboxContext = createContext<LightboxContextType>({
  state: {visible: false, images: [], index: 0, sourceLayout: null},
  openLightbox: () => {},
  closeLightbox: () => {},
});

export function LightboxProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<LightboxState>({
    visible: false,
    images: [],
    index: 0,
    sourceLayout: null,
  });

  const openLightbox = useCallback(
    (
      images: LightboxImage[],
      index: number,
      sourceLayout?: SourceLayout | null,
    ) => {
      setState({
        visible: true,
        images,
        index,
        sourceLayout: sourceLayout ?? null,
      });
    },
    [],
  );

  const closeLightbox = useCallback(() => {
    setState(prev => ({...prev, visible: false}));
  }, []);

  return (
    <LightboxContext.Provider value={{state, openLightbox, closeLightbox}}>
      {children}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  return useContext(LightboxContext);
}
