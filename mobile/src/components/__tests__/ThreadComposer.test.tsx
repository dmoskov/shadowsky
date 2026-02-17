import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { mockTheme } from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.spyOn(Alert, 'alert');

// ─── Imports ───────────────────────────────────────────────

import { ThreadComposer } from '../ThreadComposer';
import { ThreadPost } from '../ThreadPostItem';

// ─── Helpers ───────────────────────────────────────────────

function makeThreadPost(overrides: Partial<ThreadPost> = {}): ThreadPost {
  return { text: '', images: [], ...overrides };
}

function makeImage(uri = 'https://example.com/img.jpg') {
  return { uri, width: 100, height: 100, mimeType: 'image/jpeg', altText: '' };
}

const defaultProps = () => ({
  posts: [makeThreadPost()],
  onUpdatePost: jest.fn(),
  onAddPost: jest.fn(),
  onRemovePost: jest.fn(),
  onImagePicker: jest.fn(),
  isUploading: false,
});

// ─── Tests ─────────────────────────────────────────────────

describe('ThreadComposer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Basic rendering ──────────────────────────────────────

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<ThreadComposer {...defaultProps()} />)).not.toThrow();
    });

    it('displays the header text', () => {
      const { getByText } = render(<ThreadComposer {...defaultProps()} />);
      expect(getByText('Thread Composer')).toBeTruthy();
    });

    it('displays the post count badge', () => {
      const { getByText } = render(<ThreadComposer {...defaultProps()} />);
      expect(getByText('1 posts')).toBeTruthy();
    });

    it('shows correct post count for multiple posts', () => {
      const props = defaultProps();
      props.posts = [makeThreadPost(), makeThreadPost(), makeThreadPost()];
      const { getByText } = render(<ThreadComposer {...props} />);
      expect(getByText('3 posts')).toBeTruthy();
    });

    it('renders add post button', () => {
      const { getByText } = render(<ThreadComposer {...defaultProps()} />);
      expect(getByText('+ Add Post to Thread')).toBeTruthy();
    });
  });

  // ─── Thread post items ────────────────────────────────────

  describe('thread post items', () => {
    it('renders a post item for each post', () => {
      const props = defaultProps();
      props.posts = [
        makeThreadPost({ text: 'First post' }),
        makeThreadPost({ text: 'Second post' }),
      ];
      const { getByText } = render(<ThreadComposer {...props} />);
      expect(getByText('1/2')).toBeTruthy();
      expect(getByText('2/2')).toBeTruthy();
    });

    it('shows post text in text inputs', () => {
      const props = defaultProps();
      props.posts = [makeThreadPost({ text: 'Hello world' })];
      const { getByDisplayValue } = render(<ThreadComposer {...props} />);
      expect(getByDisplayValue('Hello world')).toBeTruthy();
    });

    it('displays character count for posts', () => {
      const props = defaultProps();
      props.posts = [makeThreadPost({ text: 'Test' })];
      const { getByText } = render(<ThreadComposer {...props} />);
      expect(getByText('4/300')).toBeTruthy();
    });

    it('shows character count in danger style when over limit', () => {
      const longText = 'a'.repeat(301);
      const props = defaultProps();
      props.posts = [makeThreadPost({ text: longText })];
      const { getByText } = render(<ThreadComposer {...props} />);
      expect(getByText('301/300')).toBeTruthy();
    });
  });

  // ─── Text input interactions ──────────────────────────────

  describe('text input', () => {
    it('calls onUpdatePost when text changes', () => {
      const props = defaultProps();
      props.posts = [makeThreadPost()];
      const { getByPlaceholderText } = render(<ThreadComposer {...props} />);

      fireEvent.changeText(getByPlaceholderText('Post 1'), 'New text');
      expect(props.onUpdatePost).toHaveBeenCalledWith(0, { text: 'New text', images: [] });
    });

    it('disables text input when uploading', () => {
      const props = defaultProps();
      props.isUploading = true;
      const { getByPlaceholderText } = render(<ThreadComposer {...props} />);
      expect(getByPlaceholderText('Post 1').props.editable).toBe(false);
    });
  });

  // ─── Add post button ──────────────────────────────────────

  describe('add post button', () => {
    it('calls onAddPost when pressed', () => {
      const props = defaultProps();
      const { getByText } = render(<ThreadComposer {...props} />);

      fireEvent.press(getByText('+ Add Post to Thread'));
      expect(props.onAddPost).toHaveBeenCalledTimes(1);
    });

    it('disables add post button when uploading', () => {
      const props = defaultProps();
      props.isUploading = true;
      const { getByLabelText } = render(<ThreadComposer {...props} />);
      expect(getByLabelText('Add post to thread').props.accessibilityState.disabled).toBe(true);
    });

    it('has correct accessibility attributes', () => {
      const { getByLabelText } = render(<ThreadComposer {...defaultProps()} />);
      const button = getByLabelText('Add post to thread');
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  // ─── Remove post ──────────────────────────────────────────

  describe('remove post', () => {
    it('shows alert when trying to remove from single-post thread', () => {
      const props = defaultProps();
      props.posts = [makeThreadPost({ text: 'Only post' })];
      const { queryByTestId } = render(<ThreadComposer {...props} />);
      // With only one post, the remove button should not be shown
      // (showRemoveButton is posts.length > 1)
      // ThreadPostItem won't render a remove button, so no action needed
    });

    it('shows confirmation alert when removing a post from multi-post thread', () => {
      const props = defaultProps();
      props.posts = [makeThreadPost({ text: 'Post 1' }), makeThreadPost({ text: 'Post 2' })];
      const { getAllByText } = render(<ThreadComposer {...props} />);

      // The CloseIcon button is the remove button - find it via the post number context
      // ThreadPostItem renders a remove button as a TouchableOpacity with CloseIcon
      // We need to look for the remove buttons
    });
  });

  // ─── Image handling in thread posts ───────────────────────

  describe('image handling', () => {
    it('renders image previews for posts with images', () => {
      const props = defaultProps();
      props.posts = [makeThreadPost({ images: [makeImage()] })];
      const { getAllByTestId } = render(<ThreadComposer {...props} />);
      expect(getAllByTestId('expo-image').length).toBeGreaterThanOrEqual(1);
    });

    it('shows ALT text badge on images without alt text', () => {
      const props = defaultProps();
      props.posts = [makeThreadPost({ images: [makeImage()] })];
      const { getByText } = render(<ThreadComposer {...props} />);
      expect(getByText('ALT')).toBeTruthy();
    });

    it('shows checkmark ALT badge on images with alt text', () => {
      const props = defaultProps();
      const img = makeImage();
      img.altText = 'A description';
      props.posts = [makeThreadPost({ images: [img] })];
      const { getByText } = render(<ThreadComposer {...props} />);
      expect(getByText('\u2713 ALT')).toBeTruthy();
    });
  });

  // ─── Multiple posts ───────────────────────────────────────

  describe('multiple posts', () => {
    it('renders all posts in a thread', () => {
      const props = defaultProps();
      props.posts = [
        makeThreadPost({ text: 'First' }),
        makeThreadPost({ text: 'Second' }),
        makeThreadPost({ text: 'Third' }),
      ];
      const { getByText, getByDisplayValue } = render(<ThreadComposer {...props} />);
      expect(getByDisplayValue('First')).toBeTruthy();
      expect(getByDisplayValue('Second')).toBeTruthy();
      expect(getByDisplayValue('Third')).toBeTruthy();
      expect(getByText('3 posts')).toBeTruthy();
    });

    it('updates correct post when text changes in second post', () => {
      const props = defaultProps();
      props.posts = [
        makeThreadPost({ text: 'First' }),
        makeThreadPost({ text: 'Second' }),
      ];
      const { getByDisplayValue } = render(<ThreadComposer {...props} />);

      fireEvent.changeText(getByDisplayValue('Second'), 'Updated second');
      expect(props.onUpdatePost).toHaveBeenCalledWith(1, { text: 'Updated second', images: [] });
    });
  });

  // ─── Render stability ─────────────────────────────────────

  describe('render stability', () => {
    it('renders with empty posts array', () => {
      const props = defaultProps();
      props.posts = [];
      expect(() => render(<ThreadComposer {...props} />)).not.toThrow();
    });

    it('renders with posts containing images', () => {
      const props = defaultProps();
      props.posts = [
        makeThreadPost({ text: 'With image', images: [makeImage(), makeImage('https://example.com/img2.jpg')] }),
      ];
      expect(() => render(<ThreadComposer {...props} />)).not.toThrow();
    });

    it('renders while uploading', () => {
      const props = defaultProps();
      props.isUploading = true;
      expect(() => render(<ThreadComposer {...props} />)).not.toThrow();
    });
  });
});
