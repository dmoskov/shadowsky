/**
 * Tests for useDebounce hook
 * This hook delays value updates to prevent excessive operations
 */

import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    
    expect(result.current).toBe('initial')
  })

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )
    
    expect(result.current).toBe('initial')
    
    // Change value
    rerender({ value: 'updated', delay: 500 })
    
    // Value should not change immediately
    expect(result.current).toBe('initial')
    
    // Advance timer
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    // Now value should be updated
    expect(result.current).toBe('updated')
  })

  it('should cancel pending updates when value changes again', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    )
    
    // First update
    rerender({ value: 'first', delay: 500 })
    
    // Advance timer partially
    act(() => {
      jest.advanceTimersByTime(300)
    })
    
    // Still initial value
    expect(result.current).toBe('initial')
    
    // Second update (should cancel first)
    rerender({ value: 'second', delay: 500 })
    
    // Advance timer to complete first delay
    act(() => {
      jest.advanceTimersByTime(200)
    })
    
    // Should still be initial (first update cancelled)
    expect(result.current).toBe('initial')
    
    // Complete second delay
    act(() => {
      jest.advanceTimersByTime(300)
    })
    
    // Should now be second value
    expect(result.current).toBe('second')
  })

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 1000 }
      }
    )
    
    rerender({ value: 'updated', delay: 1000 })
    
    // Advance less than delay
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe('initial')
    
    // Complete delay
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe('updated')
  })

  it('should work with different types', () => {
    // Number
    const { result: numberResult } = renderHook(() => useDebounce(42, 100))
    expect(numberResult.current).toBe(42)
    
    // Object
    const obj = { foo: 'bar' }
    const { result: objectResult } = renderHook(() => useDebounce(obj, 100))
    expect(objectResult.current).toBe(obj)
    
    // Array
    const arr = [1, 2, 3]
    const { result: arrayResult } = renderHook(() => useDebounce(arr, 100))
    expect(arrayResult.current).toBe(arr)
  })

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 0 }
      }
    )
    
    rerender({ value: 'updated', delay: 0 })
    
    // Even with 0 delay, setTimeout is used
    expect(result.current).toBe('initial')
    
    // Run timers
    act(() => {
      jest.runAllTimers()
    })
    
    expect(result.current).toBe('updated')
  })

  it('should clean up timer on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    
    const { unmount } = renderHook(() => useDebounce('value', 500))
    
    unmount()
    
    expect(clearTimeoutSpy).toHaveBeenCalled()
    
    clearTimeoutSpy.mockRestore()
  })
})