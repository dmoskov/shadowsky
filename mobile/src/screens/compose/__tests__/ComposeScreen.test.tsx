import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: mockRouterBack,
    canGoBack: jest.fn(() => true),
  }),
}));

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Mock createPost hook
const mockMutateAsync = jest.fn();
jest.mock('../../../hooks/api/usePosts', () => ({
  useCreatePost: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// Mock draft hooks
jest.mock('../../../hooks/api', () => ({
  useSaveDraft: () => ({ mutateAsync: jest.fn() }),
  useDeleteDraft: () => ({ mutateAsync: jest.fn() }),
  useDrafts: () => ({ data: undefined }),
}));

// Mock image picker
const mockSelectedImages: any[] = [];
const mockPickFromCamera = jest.fn();
const mockPickFromLibrary = jest.fn();
const mockClearImages = jest.fn();
const mockAddImages = jest.fn();
const mockRemoveImage = jest.fn();
const mockUpdateAltText = jest.fn();
jest.mock('../../../hooks/useImagePicker', () => ({
  useImagePicker: () => ({
    selectedImages: mockSelectedImages,
    pickFromCamera: mockPickFromCamera,
    pickFromLibrary: mockPickFromLibrary,
    clearImages: mockClearImages,
    addImages: mockAddImages,
    removeImage: mockRemoveImage,
    updateAltText: mockUpdateAltText,
    isUploading: false,
    setIsUploading: jest.fn(),
    setUploadProgress: jest.fn(),
  }),
}));

// Mock video picker
jest.mock('../../../hooks/useVideoPicker', () => ({
  useVideoPicker: () => ({
    selectedVideo: null,
    pickFromLibrary: jest.fn(),
    recordVideo: jest.fn(),
    removeVideo: jest.fn(),
    clearVideo: jest.fn(),
    updateVideoUri: jest.fn(),
    formatDuration: jest.fn((d: number) => `${d}s`),
    isUploading: false,
    setIsUploading: jest.fn(),
    setUploadProgress: jest.fn(),
  }),
}));

// Mock video compression
jest.mock('../../../hooks/useVideoCompression', () => ({
  useVideoCompression: () => ({
    compress: jest.fn(),
    cancel: jest.fn(),
    reset: jest.fn(),
    shouldCompress: jest.fn(() => false),
    isCompressing: false,
    state: 'idle',
    getStatusMessage: jest.fn(() => ''),
  }),
}));

// Mock search actors (mention autocomplete)
jest.mock('../../../hooks/api/useProfile', () => ({
  useSearchActors: () => ({ data: [], isLoading: false }),
}));

// Mock GIF picker hook
jest.mock('../../../hooks/useGifPicker', () => ({
  useGifPicker: () => ({
    selectedGif: null,
    isVisible: false,
    gifs: [],
    loading: false,
    error: null,
    searchQuery: '',
    open: jest.fn(),
    close: jest.fn(),
    selectGif: jest.fn(),
    clearSelection: jest.fn(),
    search: jest.fn(),
  }),
}));

// Mock emoji picker hook
jest.mock('../../../hooks/useEmojiPicker', () => ({
  useEmojiPicker: () => ({
    isVisible: false,
    open: jest.fn(),
    close: jest.fn(),
  }),
}));

// Mock link preview
jest.mock('../../../hooks/useLinkPreview', () => ({
  useLinkPreview: () => ({
    metadata: null,
    isLoading: false,
    clearPreview: jest.fn(),
  }),
}));

// Mock keyboard shortcuts
jest.mock('../../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

// Mock preferences
jest.mock('../../../contexts/PreferencesContext', () => ({
  usePreferences: () => ({ preferences: {} }),
}));

// Mock services
jest.mock('../../../services/preferences', () => ({
  preferencesService: {
    get: jest.fn(() => Promise.resolve({ postLanguages: ['en'] })),
    set: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../../services/ai-service', () => ({
  generateAltText: jest.fn(() => Promise.resolve('Generated alt text')),
}));

// Mock compose sub-components
jest.mock('../components', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    ComposeToolbar: (props: any) => (
      <View testID="compose-toolbar">
        <Text testID="char-count">{props.charCount}/{props.maxLength}</Text>
        <TouchableOpacity testID="toolbar-image" onPress={props.onImagePicker}>
          <Text>Image</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="toolbar-video" onPress={props.onVideoPicker}>
          <Text>Video</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="toolbar-gif" onPress={props.onGifPicker}>
          <Text>GIF</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="toolbar-emoji" onPress={props.onEmojiPicker}>
          <Text>Emoji</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="toolbar-thread" onPress={props.onToggleThreadMode}>
          <Text>Thread</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="toolbar-language" onPress={props.onLanguagePickerOpen}>
          <Text>Language</Text>
        </TouchableOpacity>
        {props.isThreadMode && <Text testID="thread-mode-active">Thread Mode</Text>}
      </View>
    ),
    ComposeMediaPreview: (props: any) => (
      <View testID="compose-media-preview">
        {props.selectedImages.length > 0 && <Text testID="image-preview">Images: {props.selectedImages.length}</Text>}
      </View>
    ),
    ComposeQuotePreview: (props: any) => (
      <View testID="compose-quote-preview">
        <Text>Quote: @{props.quoteTo.author.handle}</Text>
        <Text>{props.quoteTo.text}</Text>
      </View>
    ),
  };
});

// Mock other sub-components
jest.mock('../../../components/Avatar', () => {
  const { View } = require('react-native');
  return {
    Avatar: (props: any) => <View testID="avatar" {...props} />,
  };
});

jest.mock('../../../components/MentionSuggestions', () => {
  const { View } = require('react-native');
  return {
    MentionSuggestions: () => <View testID="mention-suggestions" />,
  };
});

jest.mock('../../../components/ThreadComposer', () => {
  const { View, Text, TouchableOpacity, TextInput } = require('react-native');
  return {
    ThreadComposer: (props: any) => (
      <View testID="thread-composer">
        <Text testID="thread-post-count">{props.posts.length} thread posts</Text>
        <TouchableOpacity testID="thread-add-post" onPress={props.onAddPost}>
          <Text>Add Post</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('../../../components/LanguagePicker', () => {
  const { View } = require('react-native');
  return {
    LanguagePicker: () => <View testID="language-picker" />,
  };
});

jest.mock('../../../components/GifPicker', () => {
  const { View } = require('react-native');
  return {
    GifPicker: () => <View testID="gif-picker" />,
  };
});

jest.mock('../../../components/EmojiPickerModal', () => {
  const { View } = require('react-native');
  return {
    EmojiPickerModal: () => <View testID="emoji-picker-modal" />,
  };
});

jest.mock('../../../components/ImageEditor', () => {
  const { View } = require('react-native');
  return {
    ImageEditor: () => <View testID="image-editor" />,
  };
});

jest.mock('../../../components/LinkPreviewCard', () => {
  const { View } = require('react-native');
  return {
    LinkPreviewCard: () => <View testID="link-preview-card" />,
  };
});

jest.mock('../../../services/drafts', () => ({
  draftToComposerState: jest.fn(),
}));

jest.mock('../../../utils/error-reporting', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

// ─── Import after mocks ───────────────────────────────────

import { ComposeScreen } from '../ComposeScreen';

// ─── Tests ─────────────────────────────────────────────────

describe('ComposeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedImages.length = 0;
  });

  // ─── Basic rendering ──────────────────────────────────────

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<ComposeScreen />)).not.toThrow();
    });

    it('shows Cancel button', () => {
      const { getByText } = render(<ComposeScreen />);
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('shows Post button', () => {
      const { getByText } = render(<ComposeScreen />);
      expect(getByText('Post')).toBeTruthy();
    });

    it('shows Drafts button when not in thread mode', () => {
      const { getByText } = render(<ComposeScreen />);
      expect(getByText('Drafts')).toBeTruthy();
    });

    it('renders the compose toolbar', () => {
      const { getByTestId } = render(<ComposeScreen />);
      expect(getByTestId('compose-toolbar')).toBeTruthy();
    });

    it('renders the text input with default placeholder', () => {
      const { getByPlaceholderText } = render(<ComposeScreen />);
      expect(getByPlaceholderText("What's happening?")).toBeTruthy();
    });
  });

  // ─── Text input and character count ───────────────────────

  describe('text input and character count', () => {
    it('updates text on input change', () => {
      const { getByPlaceholderText, getByTestId } = render(<ComposeScreen />);
      const input = getByPlaceholderText("What's happening?");

      fireEvent.changeText(input, 'Hello world');
      expect(getByTestId('char-count').props.children).toEqual([11, '/', 300]);
    });

    it('shows 0/300 initially', () => {
      const { getByTestId } = render(<ComposeScreen />);
      expect(getByTestId('char-count').props.children).toEqual([0, '/', 300]);
    });

    it('tracks character count for longer text', () => {
      const { getByPlaceholderText, getByTestId } = render(<ComposeScreen />);
      const input = getByPlaceholderText("What's happening?");

      const text = 'a'.repeat(250);
      fireEvent.changeText(input, text);
      expect(getByTestId('char-count').props.children).toEqual([250, '/', 300]);
    });
  });

  // ─── Post button state ────────────────────────────────────

  describe('post button state', () => {
    it('disables Post button when text is empty and no media', () => {
      const { getByText, debug } = render(<ComposeScreen />);
      const postText = getByText('Post');
      // Walk up the tree to find the TouchableOpacity with disabled
      let node = postText.parent;
      while (node && node.props.disabled === undefined) {
        node = node.parent;
      }
      expect(node?.props.disabled).toBe(true);
    });

    it('enables Post button when text is entered', () => {
      const { getByPlaceholderText, getByText } = render(<ComposeScreen />);
      fireEvent.changeText(getByPlaceholderText("What's happening?"), 'Test post');

      let node: any = getByText('Post').parent;
      while (node && node.props.disabled === undefined) {
        node = node.parent;
      }
      expect(node?.props.disabled).toBe(false);
    });

    it('disables Post button when text exceeds max length', () => {
      const { getByPlaceholderText, getByText } = render(<ComposeScreen />);
      fireEvent.changeText(getByPlaceholderText("What's happening?"), 'a'.repeat(301));

      let node: any = getByText('Post').parent;
      while (node && node.props.disabled === undefined) {
        node = node.parent;
      }
      expect(node?.props.disabled).toBe(true);
    });
  });

  // ─── Reply context ────────────────────────────────────────

  describe('reply context', () => {
    const replyTo = {
      uri: 'at://did:plc:test/app.bsky.feed.post/123',
      cid: 'bafyrei123',
      author: {
        handle: 'alice.bsky.social',
        displayName: 'Alice',
        avatar: 'https://example.com/avatar.jpg',
      },
      text: 'Original post text',
    };

    it('shows reply context when replyTo is provided', () => {
      const { getByText } = render(<ComposeScreen replyTo={replyTo} />);
      expect(getByText('Replying to @alice.bsky.social')).toBeTruthy();
    });

    it('shows parent post text', () => {
      const { getByText } = render(<ComposeScreen replyTo={replyTo} />);
      expect(getByText('Original post text')).toBeTruthy();
    });

    it('shows parent author display name', () => {
      const { getByText } = render(<ComposeScreen replyTo={replyTo} />);
      expect(getByText('Alice')).toBeTruthy();
    });

    it('uses reply placeholder text', () => {
      const { getByPlaceholderText } = render(<ComposeScreen replyTo={replyTo} />);
      expect(getByPlaceholderText('Post your reply')).toBeTruthy();
    });
  });

  // ─── Quote context ────────────────────────────────────────

  describe('quote context', () => {
    const quoteTo = {
      uri: 'at://did:plc:test/app.bsky.feed.post/456',
      cid: 'bafyrei456',
      author: {
        handle: 'bob.bsky.social',
        displayName: 'Bob',
        avatar: 'https://example.com/bob-avatar.jpg',
      },
      text: 'Quoted post text',
    };

    it('shows quote preview when quoteTo is provided', () => {
      const { getByTestId } = render(<ComposeScreen quoteTo={quoteTo} />);
      expect(getByTestId('compose-quote-preview')).toBeTruthy();
    });

    it('shows quoted author handle', () => {
      const { getByText } = render(<ComposeScreen quoteTo={quoteTo} />);
      expect(getByText('Quote: @bob.bsky.social')).toBeTruthy();
    });

    it('shows quoted post text', () => {
      const { getByText } = render(<ComposeScreen quoteTo={quoteTo} />);
      expect(getByText('Quoted post text')).toBeTruthy();
    });

    it('uses quote placeholder text', () => {
      const { getByPlaceholderText } = render(<ComposeScreen quoteTo={quoteTo} />);
      expect(getByPlaceholderText('Add your thoughts')).toBeTruthy();
    });
  });

  // ─── Thread mode ──────────────────────────────────────────

  describe('thread mode', () => {
    it('switches to thread mode when toolbar thread button is pressed', () => {
      const { getByTestId, queryByPlaceholderText } = render(<ComposeScreen />);
      fireEvent.press(getByTestId('toolbar-thread'));

      // In thread mode, ThreadComposer should be rendered
      expect(getByTestId('thread-composer')).toBeTruthy();
      // Regular text input should not be rendered
      expect(queryByPlaceholderText("What's happening?")).toBeNull();
    });

    it('shows thread mode indicator in toolbar', () => {
      const { getByTestId } = render(<ComposeScreen />);
      fireEvent.press(getByTestId('toolbar-thread'));

      expect(getByTestId('thread-mode-active')).toBeTruthy();
    });

    it('hides Drafts button in thread mode', () => {
      const { getByTestId, queryByText } = render(<ComposeScreen />);
      fireEvent.press(getByTestId('toolbar-thread'));

      expect(queryByText('Drafts')).toBeNull();
    });

    it('carries initial text to first thread post', () => {
      const { getByPlaceholderText, getByTestId } = render(<ComposeScreen />);
      fireEvent.changeText(getByPlaceholderText("What's happening?"), 'Carried text');
      fireEvent.press(getByTestId('toolbar-thread'));

      // ThreadComposer should show 1 post
      expect(getByTestId('thread-post-count').props.children).toEqual([1, ' thread posts']);
    });
  });

  // ─── Toolbar interactions ─────────────────────────────────

  describe('toolbar interactions', () => {
    it('triggers image picker from toolbar', () => {
      const { getByTestId } = render(<ComposeScreen />);
      fireEvent.press(getByTestId('toolbar-image'));
      // Image picker triggers an Alert
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('triggers video picker from toolbar', () => {
      const { getByTestId } = render(<ComposeScreen />);
      fireEvent.press(getByTestId('toolbar-video'));
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  // ─── Close / discard ──────────────────────────────────────

  describe('close behavior', () => {
    it('navigates back when cancel is pressed and no content', () => {
      const { getByText } = render(<ComposeScreen />);
      fireEvent.press(getByText('Cancel'));
      expect(mockRouterBack).toHaveBeenCalled();
    });

    it('shows save draft alert when cancel is pressed with text content', () => {
      const { getByPlaceholderText, getByText } = render(<ComposeScreen />);
      fireEvent.changeText(getByPlaceholderText("What's happening?"), 'Unsaved text');
      fireEvent.press(getByText('Cancel'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'compose.save_draft_title',
        'compose.save_draft_message',
        expect.arrayContaining([
          expect.objectContaining({ text: 'compose.discard_button' }),
          expect.objectContaining({ text: 'compose.cancel_button' }),
          expect.objectContaining({ text: 'compose.save_draft_button' }),
        ])
      );
    });
  });

  // ─── Shared content initialization ────────────────────────

  describe('shared content', () => {
    it('initializes with sharedText', () => {
      const { getByDisplayValue } = render(<ComposeScreen sharedText="Shared text" />);
      expect(getByDisplayValue('Shared text')).toBeTruthy();
    });

    it('initializes with sharedUrl', () => {
      const { getByDisplayValue } = render(<ComposeScreen sharedUrl="https://example.com" />);
      expect(getByDisplayValue('https://example.com')).toBeTruthy();
    });

    it('initializes with both sharedText and sharedUrl', () => {
      const { getByDisplayValue } = render(
        <ComposeScreen sharedText="Check this" sharedUrl="https://example.com" />
      );
      expect(getByDisplayValue('Check this\n\nhttps://example.com')).toBeTruthy();
    });

    it('initializes with initialText', () => {
      const { getByDisplayValue } = render(<ComposeScreen initialText="Prefilled text" />);
      expect(getByDisplayValue('Prefilled text')).toBeTruthy();
    });

    it('prefers initialText over sharedText', () => {
      const { getByDisplayValue, queryByDisplayValue } = render(
        <ComposeScreen initialText="Initial" sharedText="Shared" />
      );
      expect(getByDisplayValue('Initial')).toBeTruthy();
      expect(queryByDisplayValue('Shared')).toBeNull();
    });
  });

  // ─── Render stability ─────────────────────────────────────

  describe('render stability', () => {
    it('renders with all props undefined', () => {
      expect(() => render(<ComposeScreen />)).not.toThrow();
    });

    it('renders with replyTo', () => {
      const replyTo = {
        uri: 'at://test', cid: 'cid',
        author: { handle: 'test.bsky.social', displayName: 'Test' },
        text: 'Reply to this',
      };
      expect(() => render(<ComposeScreen replyTo={replyTo} />)).not.toThrow();
    });

    it('renders with quoteTo', () => {
      const quoteTo = {
        uri: 'at://test', cid: 'cid',
        author: { handle: 'test.bsky.social', displayName: 'Test' },
        text: 'Quote this',
      };
      expect(() => render(<ComposeScreen quoteTo={quoteTo} />)).not.toThrow();
    });

    it('renders with draftId', () => {
      expect(() => render(<ComposeScreen draftId="draft-123" />)).not.toThrow();
    });
  });
});
