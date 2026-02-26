import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ account: { did: 'did:plc:myself', handle: 'myself.bsky.social' } }),
}));

jest.mock('../../../components/Avatar', () => ({
  Avatar: () => {
    const { View } = require('react-native');
    return <View testID="avatar" />;
  },
}));

jest.mock('../../../components/ImageEditor', () => ({
  ImageEditor: (props: any) => {
    const { View } = require('react-native');
    return props.visible ? <View testID="image-editor" /> : null;
  },
}));

jest.mock('../../../utils/logger', () => ({
  createLogger: () => ({ log: jest.fn(), error: jest.fn(), warn: jest.fn() }),
}));

const mockPickFromLibrary = jest.fn(() => Promise.resolve(null));
jest.mock('../../../hooks/useImagePicker', () => ({
  useImagePicker: () => ({
    pickFromLibrary: mockPickFromLibrary,
    selectedImages: [],
    clearImages: jest.fn(),
    addImages: jest.fn(),
  }),
}));

let mockProfile: any = null;
let mockIsLoading = true;
const mockMutateAsync = jest.fn(() => Promise.resolve());

jest.mock('../../../hooks/api/useProfile', () => ({
  useProfile: () => ({ data: mockProfile, isLoading: mockIsLoading }),
  useUpdateProfile: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// ─── Factory ───────────────────────────────────────────────

function makeProfile() {
  return {
    did: 'did:plc:myself',
    handle: 'myself.bsky.social',
    displayName: 'My Name',
    description: 'My bio text',
    avatar: 'https://example.com/avatar.jpg',
  };
}

// ─── Import after mocks ───────────────────────────────────

import { EditProfileScreen } from '../EditProfileScreen';

// ─── Tests ────────────────────────────────────────────────

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile = null;
    mockIsLoading = true;
  });

  // ─── Loading state ─────────────────────────────────────

  describe('loading state', () => {
    it('shows ActivityIndicator while profile is loading', () => {
      mockIsLoading = true;
      mockProfile = null;

      const { getByTestId, queryByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      // ActivityIndicator should be present (React Native renders it as an element with the "activity-indicator" role)
      // We verify loading state by confirming the form content is not rendered
      expect(queryByText('Display Name')).toBeNull();
      expect(queryByText('Bio')).toBeNull();
      expect(queryByText('Failed to load profile')).toBeNull();
    });
  });

  // ─── Error state ───────────────────────────────────────

  describe('error state', () => {
    it('shows "Failed to load profile" when profile is null and not loading', () => {
      mockIsLoading = false;
      mockProfile = null;

      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByText('Failed to load profile')).toBeTruthy();
    });

    it('does not render form fields in error state', () => {
      mockIsLoading = false;
      mockProfile = null;

      const { queryByText, queryByDisplayValue } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(queryByText('Display Name')).toBeNull();
      expect(queryByText('Bio')).toBeNull();
      expect(queryByDisplayValue('My Name')).toBeNull();
    });
  });

  // ─── Form rendering ───────────────────────────────────

  describe('form rendering', () => {
    beforeEach(() => {
      mockIsLoading = false;
      mockProfile = makeProfile();
    });

    it('renders display name input pre-filled with profile data', () => {
      const { getByDisplayValue } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByDisplayValue('My Name')).toBeTruthy();
    });

    it('renders bio input pre-filled with profile data', () => {
      const { getByDisplayValue } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByDisplayValue('My bio text')).toBeTruthy();
    });

    it('renders all section labels', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByText('Avatar')).toBeTruthy();
      expect(getByText('Display Name')).toBeTruthy();
      expect(getByText('Bio')).toBeTruthy();
      expect(getByText('Handle')).toBeTruthy();
    });

    it('renders the Avatar component', () => {
      const { getByTestId } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByTestId('avatar')).toBeTruthy();
    });
  });

  // ─── Character counters ────────────────────────────────

  describe('character counters', () => {
    beforeEach(() => {
      mockIsLoading = false;
      mockProfile = makeProfile();
    });

    it('displays remaining characters for display name', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      // 64 - "My Name".length(7) = 57
      expect(getByText('57')).toBeTruthy();
    });

    it('displays remaining characters for bio', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      // 256 - "My bio text".length(11) = 245
      expect(getByText('245')).toBeTruthy();
    });

    it('updates character counter when display name changes', () => {
      const { getByDisplayValue, getByText, queryByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      const nameInput = getByDisplayValue('My Name');
      fireEvent.changeText(nameInput, 'A Much Longer Display Name');

      // 64 - 26 = 38
      expect(getByText('38')).toBeTruthy();
      // Previous counter value should be gone
      expect(queryByText('57')).toBeNull();
    });

    it('updates character counter when bio changes', () => {
      const { getByDisplayValue, getByText, queryByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      const bioInput = getByDisplayValue('My bio text');
      fireEvent.changeText(bioInput, 'Updated bio');

      // 256 - 11 = 245 (same length as before since "Updated bio" is 11 chars too)
      // Let's use a different length: "Updated bio content" is 19 chars -> 256 - 19 = 237
      fireEvent.changeText(bioInput, 'Updated bio content');
      expect(getByText('237')).toBeTruthy();
    });
  });

  // ─── Change Avatar button ──────────────────────────────

  describe('change avatar button', () => {
    beforeEach(() => {
      mockIsLoading = false;
      mockProfile = makeProfile();
    });

    it('renders the Change Avatar button', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByText('Change Avatar')).toBeTruthy();
    });

    it('calls pickFromLibrary when Change Avatar is pressed', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      fireEvent.press(getByText('Change Avatar'));
      expect(mockPickFromLibrary).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Cancel button ────────────────────────────────────

  describe('cancel button', () => {
    beforeEach(() => {
      mockIsLoading = false;
      mockProfile = makeProfile();
    });

    it('renders the Cancel button', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByText('Cancel')).toBeTruthy();
    });

    it('calls onCancel when Cancel button is pressed', () => {
      const onCancel = jest.fn();

      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={onCancel} />
      );

      fireEvent.press(getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Save button ──────────────────────────────────────

  describe('save button', () => {
    beforeEach(() => {
      mockIsLoading = false;
      mockProfile = makeProfile();
    });

    it('renders the Save button', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByText('Save')).toBeTruthy();
    });
  });

  // ─── Handle (read-only) ───────────────────────────────

  describe('handle display', () => {
    beforeEach(() => {
      mockIsLoading = false;
      mockProfile = makeProfile();
    });

    it('shows handle as read-only text with @ prefix', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(getByText('@myself.bsky.social')).toBeTruthy();
    });

    it('does not render handle as an editable input', () => {
      const { getByText } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      const handleElement = getByText('@myself.bsky.social');
      // The handle should be a plain Text element, not a TextInput.
      // TextInput elements have an onChangeText prop; we verify it lacks that.
      expect(handleElement.props.onChangeText).toBeUndefined();
    });
  });

  // ─── Render stability ─────────────────────────────────

  describe('render stability', () => {
    it('renders without crashing in loading state', () => {
      mockIsLoading = true;
      mockProfile = null;

      expect(() =>
        render(<EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />)
      ).not.toThrow();
    });

    it('renders without crashing in error state', () => {
      mockIsLoading = false;
      mockProfile = null;

      expect(() =>
        render(<EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />)
      ).not.toThrow();
    });

    it('renders without crashing with full profile data', () => {
      mockIsLoading = false;
      mockProfile = makeProfile();

      expect(() =>
        render(<EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />)
      ).not.toThrow();
    });

    it('renders without crashing when profile has empty fields', () => {
      mockIsLoading = false;
      mockProfile = {
        ...makeProfile(),
        displayName: '',
        description: '',
        avatar: undefined,
      };

      expect(() =>
        render(<EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />)
      ).not.toThrow();
    });

    it('can re-render multiple times without error', () => {
      mockIsLoading = false;
      mockProfile = makeProfile();

      const { rerender } = render(
        <EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />
      );

      expect(() => {
        rerender(<EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />);
        rerender(<EditProfileScreen onSave={jest.fn()} onCancel={jest.fn()} />);
      }).not.toThrow();
    });
  });
});
