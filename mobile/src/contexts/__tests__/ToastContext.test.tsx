import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ToastProvider, useToast } from '../ToastContext';

const mockToastComponent = jest.fn(() => null);
jest.mock('../../components/Toast', () => ({
  __esModule: true,
  default: (props: any) => {
    mockToastComponent(props);
    return null;
  },
}));

function getLatestToasts(): any[] {
  const calls = mockToastComponent.mock.calls;
  if (calls.length === 0) return [];
  return calls[calls.length - 1][0].toasts;
}

describe('ToastContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
  );

  describe('showToast', () => {
    it('returns a unique toast ID', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      let id1: string;
      let id2: string;
      act(() => {
        id1 = result.current.showToast('first');
      });
      act(() => {
        id2 = result.current.showToast('second');
      });

      expect(typeof id1!).toBe('string');
      expect(typeof id2!).toBe('string');
      expect(id1!).not.toBe(id2!);
    });

    it('creates toast with correct defaults for info type (duration 3000)', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('info message');
      });

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('info message');
      expect(toasts[0].type).toBe('info');
      expect(toasts[0].duration).toBe(3000);
      expect(toasts[0].dismissible).toBe(true);
    });

    it('creates toast with correct defaults for error type (duration 5000)', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('error message', { type: 'error' });
      });

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('error');
      expect(toasts[0].duration).toBe(5000);
    });

    it('creates toast with correct defaults for success type (duration 3000)', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('success message', { type: 'success' });
      });

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].duration).toBe(3000);
    });

    it('creates toast with correct defaults for warning type (duration 4000)', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('warning message', { type: 'warning' });
      });

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('warning');
      expect(toasts[0].duration).toBe(4000);
    });

    it('uses custom duration when provided', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('custom', { type: 'info', duration: 10000 });
      });

      const toasts = getLatestToasts();
      expect(toasts[0].duration).toBe(10000);
    });

    it('includes custom action', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      const onClick = jest.fn();

      act(() => {
        result.current.showToast('with action', {
          action: { label: 'Retry', onClick },
        });
      });

      const toasts = getLatestToasts();
      expect(toasts[0].action).toEqual({ label: 'Retry', onClick });
    });
  });

  describe('max toast limit', () => {
    it('keeps only 3 toasts when a 4th is added (drops oldest)', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('toast 1');
        result.current.showToast('toast 2');
        result.current.showToast('toast 3');
        result.current.showToast('toast 4');
      });

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(3);
      expect(toasts[0].message).toBe('toast 2');
      expect(toasts[1].message).toBe('toast 3');
      expect(toasts[2].message).toBe('toast 4');
    });

    it('keeps exactly 3 toasts when a 5th is added', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('toast 1');
        result.current.showToast('toast 2');
        result.current.showToast('toast 3');
        result.current.showToast('toast 4');
        result.current.showToast('toast 5');
      });

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(3);
      expect(toasts[0].message).toBe('toast 3');
      expect(toasts[1].message).toBe('toast 4');
      expect(toasts[2].message).toBe('toast 5');
    });
  });

  describe('dismissToast', () => {
    it('removes a toast by ID', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      let id: string;
      act(() => {
        id = result.current.showToast('to dismiss');
        result.current.showToast('to keep');
      });

      act(() => {
        result.current.dismissToast(id!);
      });

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('to keep');
    });

    it('does not throw for non-existent ID', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('existing');
      });

      expect(() => {
        act(() => {
          result.current.dismissToast('non-existent-id');
        });
      }).not.toThrow();

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(1);
    });
  });

  describe('dismissAllToasts', () => {
    it('empties all toasts', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast('toast 1');
        result.current.showToast('toast 2');
        result.current.showToast('toast 3');
      });

      act(() => {
        result.current.dismissAllToasts();
      });

      const toasts = getLatestToasts();
      expect(toasts).toHaveLength(0);
    });
  });

  describe('showUndoToast', () => {
    it('creates a warning type toast', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showUndoToast('Undo action', jest.fn(), jest.fn());
      });

      const toasts = getLatestToasts();
      expect(toasts[0].type).toBe('warning');
    });

    it('has Undo action label', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showUndoToast('Undo action', jest.fn(), jest.fn());
      });

      const toasts = getLatestToasts();
      expect(toasts[0].action).toBeDefined();
      expect(toasts[0].action.label).toBe('Undo');
    });

    it('has showCountdown set to true', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showUndoToast('Undo action', jest.fn(), jest.fn());
      });

      const toasts = getLatestToasts();
      expect(toasts[0].showCountdown).toBe(true);
    });

    it('has dismissible set to false', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showUndoToast('Undo action', jest.fn(), jest.fn());
      });

      const toasts = getLatestToasts();
      expect(toasts[0].dismissible).toBe(false);
    });

    it('uses default duration of 5000', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showUndoToast('Undo action', jest.fn(), jest.fn());
      });

      const toasts = getLatestToasts();
      expect(toasts[0].duration).toBe(5000);
    });

    it('respects custom duration', () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showUndoToast('Undo action', jest.fn(), jest.fn(), 8000);
      });

      const toasts = getLatestToasts();
      expect(toasts[0].duration).toBe(8000);
    });

    it('sets onExpire callback', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      const onExpire = jest.fn();

      act(() => {
        result.current.showUndoToast('Undo action', jest.fn(), onExpire);
      });

      const toasts = getLatestToasts();
      expect(toasts[0].onExpire).toBe(onExpire);
    });
  });

  describe('error handling', () => {
    it('throws when useToast is used outside ToastProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useToast());
      }).toThrow('useToast must be used within a ToastProvider');

      consoleError.mockRestore();
    });
  });
});
