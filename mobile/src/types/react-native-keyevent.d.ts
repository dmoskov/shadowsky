declare module 'react-native-keyevent' {
  export interface KeyEventData {
    pressedKey: string;
    keyCode: number;
    action: 'keyDown' | 'keyUp' | 'keyMultiple';
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }

  export type KeyEventListener = (event: KeyEventData) => void;

  export function onKeyDownListener(listener: KeyEventListener): void;
  export function onKeyUpListener(listener: KeyEventListener): void;
  export function onKeyMultipleListener(listener: KeyEventListener): void;
  export function removeKeyDownListener(): void;
  export function removeKeyUpListener(): void;
  export function removeKeyMultipleListener(): void;
}
