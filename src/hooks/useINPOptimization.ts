/**
 * React hook for INP (Interaction to Next Paint) optimization
 *
 * Provides convenient access to the INP optimization service for:
 * - Long task detection and monitoring
 * - Input prioritization (deferring work during interactions)
 * - Task yielding utilities for long-running operations
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  inpOptimizationService,
  LongTaskEntry,
  TaskPriority,
  type INPOptimizationConfig,
} from "../services/inp-optimization-service";

/**
 * Hook for monitoring long tasks
 *
 * @param options - Configuration options
 * @returns Long task stats and history
 */
export function useLongTaskMonitor(
  options: {
    /** Maximum number of tasks to keep in history */
    maxHistory?: number;
    /** Callback when a long task is detected */
    onLongTask?: (entry: LongTaskEntry) => void;
  } = {},
) {
  const { maxHistory = 20, onLongTask } = options;
  const [longTasks, setLongTasks] = useState<LongTaskEntry[]>([]);
  const [stats, setStats] = useState(() =>
    inpOptimizationService.getLongTaskStats(),
  );

  useEffect(() => {
    // Initialize service if not already
    inpOptimizationService.init();

    const unsubscribe = inpOptimizationService.onLongTask((entry) => {
      setLongTasks((prev) => {
        const updated = [...prev, entry];
        return updated.slice(-maxHistory);
      });
      setStats(inpOptimizationService.getLongTaskStats());
      onLongTask?.(entry);
    });

    // Get initial state
    setLongTasks(
      inpOptimizationService.getLongTaskHistory().slice(-maxHistory),
    );
    setStats(inpOptimizationService.getLongTaskStats());

    return () => {
      unsubscribe();
    };
  }, [maxHistory, onLongTask]);

  const clearHistory = useCallback(() => {
    inpOptimizationService.clearLongTaskHistory();
    setLongTasks([]);
    setStats(inpOptimizationService.getLongTaskStats());
  }, []);

  return {
    longTasks,
    stats,
    clearHistory,
  };
}

/**
 * Hook for tracking user interaction state
 *
 * @returns Current interaction state and time since last interaction
 */
export function useInteractionState() {
  const [isInteracting, setIsInteracting] = useState(false);
  const [timeSinceInteraction, setTimeSinceInteraction] =
    useState<number>(Infinity);

  useEffect(() => {
    // Initialize service if not already
    inpOptimizationService.init();

    const unsubscribe = inpOptimizationService.onInputStateChange(
      (interacting) => {
        setIsInteracting(interacting);
      },
    );

    // Update time since interaction periodically
    const intervalId = setInterval(() => {
      setTimeSinceInteraction(
        inpOptimizationService.getTimeSinceLastInteraction(),
      );
    }, 100);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  return {
    isInteracting,
    timeSinceInteraction,
  };
}

/**
 * Hook for deferring tasks until user is not interacting
 *
 * @returns Functions for deferring and managing tasks
 */
export function useDeferredTasks() {
  const [pendingCount, setPendingCount] = useState(0);
  const taskIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Initialize service if not already
    inpOptimizationService.init();

    // Track pending count changes
    const checkPendingCount = () => {
      setPendingCount(inpOptimizationService.getPendingTaskCount());
    };

    // Check periodically since we don't have a direct event for this
    const intervalId = setInterval(checkPendingCount, 100);

    return () => {
      clearInterval(intervalId);
      // Cancel any tasks we created
      taskIdsRef.current.forEach((id) => {
        inpOptimizationService.cancelDeferredTask(id);
      });
    };
  }, []);

  const deferTask = useCallback(
    <T>(
      execute: () => T | Promise<T>,
      options?: {
        priority?: TaskPriority;
        description?: string;
        cancellable?: boolean;
      },
    ) => {
      const { id, promise } = inpOptimizationService.deferTask(
        execute,
        options,
      );
      taskIdsRef.current.add(id);

      // Remove from our tracking when complete
      promise.finally(() => {
        taskIdsRef.current.delete(id);
        setPendingCount(inpOptimizationService.getPendingTaskCount());
      });

      setPendingCount(inpOptimizationService.getPendingTaskCount());
      return { id, promise };
    },
    [],
  );

  const cancelTask = useCallback((taskId: string) => {
    const cancelled = inpOptimizationService.cancelDeferredTask(taskId);
    if (cancelled) {
      taskIdsRef.current.delete(taskId);
      setPendingCount(inpOptimizationService.getPendingTaskCount());
    }
    return cancelled;
  }, []);

  const cancelAllTasks = useCallback(() => {
    taskIdsRef.current.forEach((id) => {
      inpOptimizationService.cancelDeferredTask(id);
    });
    taskIdsRef.current.clear();
    setPendingCount(0);
  }, []);

  return {
    deferTask,
    cancelTask,
    cancelAllTasks,
    pendingCount,
    TaskPriority,
  };
}

/**
 * Hook for processing items in chunks with yielding
 *
 * @returns Function for chunked processing with progress tracking
 */
export function useChunkedProcessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Initialize service if not already
    inpOptimizationService.init();

    return () => {
      // Abort any ongoing processing on unmount
      abortControllerRef.current?.abort();
    };
  }, []);

  const processInChunks = useCallback(
    async <T, R>(
      items: T[],
      processor: (item: T, index: number) => R | Promise<R>,
      options?: {
        chunkSize?: number;
        timeLimitMs?: number;
        yieldOnInteraction?: boolean;
      },
    ): Promise<R[]> => {
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      setIsProcessing(true);
      setProgress({ processed: 0, total: items.length });

      try {
        const results = await inpOptimizationService.processInChunks(
          items,
          processor,
          {
            ...options,
            onProgress: (processed, total) => {
              setProgress({ processed, total });
            },
          },
        );
        return results;
      } finally {
        setIsProcessing(false);
        setProgress(null);
        abortControllerRef.current = null;
      }
    },
    [],
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    processInChunks,
    abort,
    isProcessing,
    progress,
  };
}

/**
 * Hook for running callbacks when idle
 *
 * @returns Function to run callbacks when idle
 */
export function useRunWhenIdle() {
  useEffect(() => {
    // Initialize service if not already
    inpOptimizationService.init();
  }, []);

  const runWhenIdle = useCallback(
    <T>(
      callback: () => T | Promise<T>,
      options?: { timeout?: number },
    ): Promise<T> => {
      return inpOptimizationService.runWhenIdle(callback, options);
    },
    [],
  );

  return runWhenIdle;
}

/**
 * Hook for debouncing functions during user interactions
 *
 * @param fn - Function to debounce
 * @param deps - Dependencies for the function
 * @param options - Debounce options
 * @returns Debounced function
 */
export function useDebounceOnInteraction<
  T extends (...args: Parameters<T>) => ReturnType<T>,
>(fn: T, deps: React.DependencyList, options?: { delayMs?: number }) {
  const fnRef = useRef(fn);

  // Update ref when fn changes
  useEffect(() => {
    fnRef.current = fn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    // Initialize service if not already
    inpOptimizationService.init();
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const debouncedFn = inpOptimizationService.debounceOnInteraction(
        () => fnRef.current(...args),
        options,
      );
      debouncedFn();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options?.delayMs],
  );
}

/**
 * Combined hook for full INP optimization functionality
 *
 * @param config - Optional configuration overrides
 * @returns All INP optimization utilities
 */
export function useINPOptimization(config?: Partial<INPOptimizationConfig>) {
  useEffect(() => {
    // Initialize service with optional config
    if (config) {
      inpOptimizationService.updateConfig(config);
    }
    inpOptimizationService.init();
  }, [config]);

  // Combine all hooks
  const {
    longTasks,
    stats: longTaskStats,
    clearHistory,
  } = useLongTaskMonitor();
  const { isInteracting, timeSinceInteraction } = useInteractionState();
  const { deferTask, cancelTask, cancelAllTasks, pendingCount } =
    useDeferredTasks();
  const {
    processInChunks,
    abort: abortChunkedProcessing,
    isProcessing,
    progress,
  } = useChunkedProcessing();
  const runWhenIdle = useRunWhenIdle();

  // Direct access to service methods
  const yieldToMain = useCallback(
    () => inpOptimizationService.yieldToMain(),
    [],
  );

  return {
    // Long task monitoring
    longTasks,
    longTaskStats,
    clearHistory,

    // Interaction state
    isInteracting,
    timeSinceInteraction,

    // Deferred tasks
    deferTask,
    cancelTask,
    cancelAllTasks,
    pendingTaskCount: pendingCount,
    TaskPriority,

    // Chunked processing
    processInChunks,
    abortChunkedProcessing,
    isProcessing,
    processingProgress: progress,

    // Utilities
    runWhenIdle,
    yieldToMain,

    // Service access
    service: inpOptimizationService,
  };
}

// Re-export types and enums for convenience
export { TaskPriority } from "../services/inp-optimization-service";
export type {
  INPOptimizationConfig,
  LongTaskEntry,
} from "../services/inp-optimization-service";
