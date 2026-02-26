import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';

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

export interface LightboxPostMeta {
  postUri: string;
  postAuthorDid: string;
}

interface LightboxState {
  visible: boolean;
  images: LightboxImage[];
  index: number;
  sourceLayout: SourceLayout | null;
  postMeta: LightboxPostMeta | null;
}

interface LightboxContextType {
  state: LightboxState;
  openLightbox: (
    images: LightboxImage[],
    index: number,
    sourceLayout?: SourceLayout | null,
    postMeta?: LightboxPostMeta | null,
  ) => void;
  closeLightbox: () => void;
  updateImageAlt: (index: number, alt: string) => void;
}

const LightboxContext = createContext<LightboxContextType>({
  state: {visible: false, images: [], index: 0, sourceLayout: null, postMeta: null},
  openLightbox: () => {},
  closeLightbox: () => {},
  updateImageAlt: () => {},
});

export function LightboxProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<LightboxState>({
    visible: false,
    images: [],
    index: 0,
    sourceLayout: null,
    postMeta: null,
  });

  const openLightbox = useCallback(
    (
      images: LightboxImage[],
      index: number,
      sourceLayout?: SourceLayout | null,
      postMeta?: LightboxPostMeta | null,
    ) => {
      setState({
        visible: true,
        images,
        index,
        sourceLayout: sourceLayout ?? null,
        postMeta: postMeta ?? null,
      });
    },
    [],
  );

  const closeLightbox = useCallback(() => {
    setState(prev => ({...prev, visible: false}));
  }, []);

  const updateImageAlt = useCallback((index: number, alt: string) => {
    setState(prev => {
      const newImages = [...prev.images];
      if (index >= 0 && index < newImages.length) {
        newImages[index] = {...newImages[index], alt};
      }
      return {...prev, images: newImages};
    });
  }, []);

  const value = useMemo(
    () => ({state, openLightbox, closeLightbox, updateImageAlt}),
    [state, openLightbox, closeLightbox, updateImageAlt],
  );

  return (
    <LightboxContext.Provider value={value}>
      {children}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  return useContext(LightboxContext);
}
