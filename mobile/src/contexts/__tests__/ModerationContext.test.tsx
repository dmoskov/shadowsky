import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { MMKV } from 'react-native-mmkv';
import {
  ModerationProvider,
  useModeration,
  DEFAULT_CONTENT_FILTER_PREFERENCES,
} from '../ModerationContext';

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <ModerationProvider>{children}</ModerationProvider>;
}

/**
 * Get the shared MMKV mock instance so we can inspect or pre-populate storage.
 * The jest.setup.js mock creates a new object per `new MMKV()` call, but they
 * all share the same backing Map, so we can use any instance to clear state.
 */
function getMMKVInstance() {
  return new MMKV({ id: 'shadowsky-moderation' });
}

describe('ModerationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the shared Map backing the MMKV mock
    getMMKVInstance().clearAll();
  });

  // ---------------------------------------------------------------------------
  // 1. Initialization
  // ---------------------------------------------------------------------------
  describe('Initialization', () => {
    it('provides default preferences when no saved data exists', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      expect(result.current.contentFilterPreferences).toEqual(
        DEFAULT_CONTENT_FILTER_PREFERENCES,
      );
    });

    it('default preferences match DEFAULT_CONTENT_FILTER_PREFERENCES', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      expect(result.current.contentFilterPreferences.porn).toBe('hide');
      expect(result.current.contentFilterPreferences.sexual).toBe('warn');
      expect(result.current.contentFilterPreferences.nudity).toBe('warn');
      expect(result.current.contentFilterPreferences['graphic-media']).toBe('warn');
      expect(result.current.contentFilterPreferences.gore).toBe('warn');
      expect(result.current.contentFilterPreferences.nsfl).toBe('hide');
      expect(result.current.contentFilterPreferences.spam).toBe('hide');
      expect(result.current.contentFilterPreferences.impersonation).toBe('warn');
      expect(result.current.contentFilterPreferences.scam).toBe('warn');
      expect(result.current.contentFilterPreferences.misleading).toBe('warn');
    });

    it('loads previously saved preferences from MMKV', () => {
      const saved = { ...DEFAULT_CONTENT_FILTER_PREFERENCES, porn: 'show' };
      getMMKVInstance().set(
        'content_filter_preferences',
        JSON.stringify(saved),
      );

      const { result } = renderHook(() => useModeration(), { wrapper });

      expect(result.current.contentFilterPreferences.porn).toBe('show');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. setContentFilterPreference
  // ---------------------------------------------------------------------------
  describe('setContentFilterPreference', () => {
    it('updates a single preference', async () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      await act(async () => {
        await result.current.setContentFilterPreference('porn', 'show');
      });

      expect(result.current.contentFilterPreferences.porn).toBe('show');
    });

    it('persists the update to MMKV', async () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      await act(async () => {
        await result.current.setContentFilterPreference('porn', 'warn');
      });

      const stored = getMMKVInstance().getString('content_filter_preferences');
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed.porn).toBe('warn');
    });

    it('does not affect other preferences when updating one', async () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      await act(async () => {
        await result.current.setContentFilterPreference('porn', 'show');
      });

      expect(result.current.contentFilterPreferences.sexual).toBe('warn');
      expect(result.current.contentFilterPreferences.nudity).toBe('warn');
      expect(result.current.contentFilterPreferences.gore).toBe('warn');
      expect(result.current.contentFilterPreferences.spam).toBe('hide');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. resetContentFilterPreferences
  // ---------------------------------------------------------------------------
  describe('resetContentFilterPreferences', () => {
    it('resets all preferences to defaults', async () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      await act(async () => {
        await result.current.setContentFilterPreference('porn', 'show');
        await result.current.setContentFilterPreference('sexual', 'hide');
      });

      await act(async () => {
        await result.current.resetContentFilterPreferences();
      });

      expect(result.current.contentFilterPreferences).toEqual(
        DEFAULT_CONTENT_FILTER_PREFERENCES,
      );
    });

    it('after reset all values match DEFAULT_CONTENT_FILTER_PREFERENCES', async () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      await act(async () => {
        await result.current.setContentFilterPreference('spam', 'show');
        await result.current.setContentFilterPreference('gore', 'show');
        await result.current.setContentFilterPreference('nsfl', 'warn');
      });

      await act(async () => {
        await result.current.resetContentFilterPreferences();
      });

      for (const [key, value] of Object.entries(DEFAULT_CONTENT_FILTER_PREFERENCES)) {
        expect(result.current.contentFilterPreferences[key as keyof typeof DEFAULT_CONTENT_FILTER_PREFERENCES]).toBe(value);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 4. shouldHideContent
  // ---------------------------------------------------------------------------
  describe('shouldHideContent', () => {
    it('returns false with no labels (undefined)', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.shouldHideContent()).toBe(false);
    });

    it('returns false with an empty labels array', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.shouldHideContent([])).toBe(false);
    });

    it('returns true when a label matches a hide preference', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      // porn is 'hide' by default
      expect(result.current.shouldHideContent([{ val: 'porn' }])).toBe(true);
    });

    it('returns false when a label matches a warn preference', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      // sexual is 'warn' by default
      expect(result.current.shouldHideContent([{ val: 'sexual' }])).toBe(false);
    });

    it('returns false when a label matches a show preference', async () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      await act(async () => {
        await result.current.setContentFilterPreference('porn', 'show');
      });

      expect(result.current.shouldHideContent([{ val: 'porn' }])).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. shouldWarnContent
  // ---------------------------------------------------------------------------
  describe('shouldWarnContent', () => {
    it('returns false with no labels (undefined)', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.shouldWarnContent()).toBe(false);
    });

    it('returns true when a label matches a warn preference', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      // sexual is 'warn' by default
      expect(result.current.shouldWarnContent([{ val: 'sexual' }])).toBe(true);
    });

    it('returns false when a label matches a hide preference', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      // porn is 'hide' by default
      expect(result.current.shouldWarnContent([{ val: 'porn' }])).toBe(false);
    });

    it('returns false when a label matches a show preference', async () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      await act(async () => {
        await result.current.setContentFilterPreference('sexual', 'show');
      });

      expect(result.current.shouldWarnContent([{ val: 'sexual' }])).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. shouldBlurImages
  // ---------------------------------------------------------------------------
  describe('shouldBlurImages', () => {
    it('returns false with no labels (undefined)', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.shouldBlurImages()).toBe(false);
    });

    it('returns true for a label with warn preference', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      // sexual is 'warn' by default
      expect(result.current.shouldBlurImages([{ val: 'sexual' }])).toBe(true);
    });

    it('returns true for a label with hide preference', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      // porn is 'hide' by default
      expect(result.current.shouldBlurImages([{ val: 'porn' }])).toBe(true);
    });

    it('returns false for a label with show preference', async () => {
      const { result } = renderHook(() => useModeration(), { wrapper });

      await act(async () => {
        await result.current.setContentFilterPreference('sexual', 'show');
      });

      expect(result.current.shouldBlurImages([{ val: 'sexual' }])).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. getContentWarningText
  // ---------------------------------------------------------------------------
  describe('getContentWarningText', () => {
    it('returns "Sensitive Content" with no labels (undefined)', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.getContentWarningText()).toBe('Sensitive Content');
    });

    it('returns "Adult Content" for porn label', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.getContentWarningText([{ val: 'porn' }])).toBe('Adult Content');
    });

    it('returns "Sexually Suggestive" for sexual label', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.getContentWarningText([{ val: 'sexual' }])).toBe(
        'Sexually Suggestive',
      );
    });

    it('returns "Nudity" for nudity label', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.getContentWarningText([{ val: 'nudity' }])).toBe('Nudity');
    });

    it('returns "Sensitive Content" for an unknown label type', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(
        result.current.getContentWarningText([{ val: 'totally-unknown' }]),
      ).toBe('Sensitive Content');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. parseLabelType (tested indirectly)
  // ---------------------------------------------------------------------------
  describe('parseLabelType (indirect)', () => {
    it('handles case-insensitive labels (PORN treated same as porn)', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      // porn is 'hide' by default; uppercase should still match
      expect(result.current.shouldHideContent([{ val: 'PORN' }])).toBe(true);
    });

    it('handles mixed-case labels', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.shouldHideContent([{ val: 'Porn' }])).toBe(true);
    });

    it('unknown labels do not match any preference', () => {
      const { result } = renderHook(() => useModeration(), { wrapper });
      expect(result.current.shouldHideContent([{ val: 'unknown-label' }])).toBe(false);
      expect(result.current.shouldWarnContent([{ val: 'unknown-label' }])).toBe(false);
      expect(result.current.shouldBlurImages([{ val: 'unknown-label' }])).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Error handling
  // ---------------------------------------------------------------------------
  describe('Error handling', () => {
    it('useModeration throws when used outside ModerationProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useModeration());
      }).toThrow('useModeration must be used within a ModerationProvider');

      consoleError.mockRestore();
    });
  });
});
