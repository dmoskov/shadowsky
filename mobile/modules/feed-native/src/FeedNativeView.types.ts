import { ViewProps } from 'react-native';

export interface FeedNativeViewProps extends ViewProps {
  /**
   * Message to display in the native SwiftUI view
   * @default "Hello from SwiftUI"
   */
  message?: string;
}
