declare module 'react-native-context-menu-view' {
  import { ComponentType } from 'react';
  import { ViewProps } from 'react-native';

  export interface ContextMenuAction {
    title: string;
    systemIcon?: string;
    destructive?: boolean;
    disabled?: boolean;
    inlineChildren?: boolean;
    actions?: ContextMenuAction[];
  }

  export interface ContextMenuOnPressNativeEvent {
    index: number;
    indexPath: number[];
    name: string;
  }

  interface ContextMenuProps extends ViewProps {
    actions?: ContextMenuAction[];
    onPress?: (event: { nativeEvent: ContextMenuOnPressNativeEvent }) => void;
    onPreviewPress?: () => void;
    preview?: React.ReactNode;
    previewBackgroundColor?: string;
    dropdownMenuMode?: boolean;
    disabled?: boolean;
  }

  const ContextMenu: ComponentType<ContextMenuProps>;
  export default ContextMenu;
}
