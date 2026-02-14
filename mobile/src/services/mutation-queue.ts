/**
 * Offline Mutation Queue for Mobile
 *
 * AsyncStorage-based queue for storing user mutations (likes, follows, reposts)
 * when connectivity issues occur. Auto-retries when connection is restored.
 *
 * This is a stability feature, not full offline support.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, AppStateStatus} from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';


import { createLogger } from '../utils/logger';

const logger = createLogger('MutationQueue');
const QUEUE_KEY = '@BskyMutationQueue';
const MAX_RETRIES = 3;

// Mutation types supported
export type MutationType =
  | 'like'
  | 'unlike'
  | 'repost'
  | 'deleteRepost'
  | 'follow'
  | 'unfollow';

export interface QueuedMutation {
  id: string;
  type: MutationType;
  targetUri: string; // Post URI or actor DID
  targetCid?: string; // For likes/reposts that need CID
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
}

export interface MutationQueueStats {
  pendingCount: number;
  failedCount: number;
  oldestAge: number | null;
}

class MutationQueue {
  private static instance: MutationQueue;
  private queue: QueuedMutation[] = [];
  private isProcessing = false;
  private isInitialized = false;
  private listeners: Set<() => void> = new Set();
  private appStateSubscription: any = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private processingTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): MutationQueue {
    if (!MutationQueue.instance) {
      MutationQueue.instance = new MutationQueue();
    }
    return MutationQueue.instance;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load queue from AsyncStorage
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        logger.log(`Loaded ${this.queue.length} mutations from storage`);
      }

      // Set up AppState listener
      this.setupAppStateListener();

      // Set up NetInfo listener
      this.setupNetInfoListener();

      // Set up periodic processing (every 30 seconds when active)
      this.setupPeriodicProcessing();

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize:', error);
      throw error;
    }
  }

  private setupAppStateListener(): void {
    if (this.appStateSubscription) return;

    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          logger.log('App became active, processing queue...');
          this.processQueue();
        }
      }
    );
  }

  private setupNetInfoListener(): void {
    if (this.netInfoUnsubscribe) return;

    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        logger.log('Network restored, processing queue...');
        this.processQueue();
      }
    });
  }

  private setupPeriodicProcessing(): void {
    if (this.processingTimer) return;

    this.processingTimer = setInterval(() => {
      if (AppState.currentState === 'active') {
        this.processQueue();
      }
    }, 30000); // 30 seconds
  }

  // Subscribe to queue changes
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }

  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      logger.error('Failed to persist queue:', error);
    }
  }

  // Add a mutation to the queue
  async enqueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const id = `${mutation.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const queuedMutation: QueuedMutation = {
      id,
      type: mutation.type,
      targetUri: mutation.targetUri,
      targetCid: mutation.targetCid,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: mutation.maxRetries || MAX_RETRIES,
      status: 'pending',
    };

    this.queue.push(queuedMutation);
    await this.persistQueue();
    this.notifyListeners();

    logger.log(`Enqueued mutation: ${mutation.type}`, {
      targetUri: mutation.targetUri,
      targetCid: mutation.targetCid,
    });

    // Try to process immediately if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  // Get queue statistics
  async getStats(): Promise<MutationQueueStats> {
    const pendingCount = this.queue.filter(m => m.status === 'pending').length;
    const failedCount = this.queue.filter(m => m.status === 'failed').length;

    const pendingMutations = this.queue.filter(m => m.status === 'pending');
    const oldestAge = pendingMutations.length > 0
      ? Date.now() - Math.min(...pendingMutations.map(m => m.timestamp))
      : null;

    return {
      pendingCount,
      failedCount,
      oldestAge,
    };
  }

  // Process queue
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      logger.log('Already processing, skipping');
      return;
    }

    const pendingMutations = this.queue.filter(m => m.status === 'pending');
    if (pendingMutations.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.notifyListeners();

    logger.log(`Processing ${pendingMutations.length} mutations...`);

    try {
      // Sort by timestamp (FIFO)
      pendingMutations.sort((a, b) => a.timestamp - b.timestamp);

      for (const mutation of pendingMutations) {
        await this.processMutation(mutation);
      }
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  private async processMutation(mutation: QueuedMutation): Promise<void> {
    // Update status to processing
    mutation.status = 'processing';
    await this.persistQueue();
    this.notifyListeners();

    try {
      // Execute the mutation
      await this.executeMutation(mutation);

      // Success - remove from queue
      this.queue = this.queue.filter(m => m.id !== mutation.id);
      await this.persistQueue();
      this.notifyListeners();

      logger.log(`Successfully processed mutation: ${mutation.type}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if it's a transient error (network, 429, 5xx)
      const isTransient = this.isTransientError(error);

      if (isTransient && mutation.retryCount < mutation.maxRetries) {
        // Transient error - keep in queue for retry
        mutation.status = 'pending';
        mutation.retryCount++;
        mutation.error = errorMessage;
        await this.persistQueue();
        this.notifyListeners();

        logger.log(`Transient error processing ${mutation.type}, will retry (${mutation.retryCount}/${mutation.maxRetries}):`,
          errorMessage
        );
      } else {
        // Permanent error or too many retries - mark as failed
        mutation.status = 'failed';
        mutation.error = errorMessage;
        await this.persistQueue();
        this.notifyListeners();

        logger.error(`Failed to process mutation ${mutation.type}:`,
          errorMessage
        );
      }
    }
  }

  private isTransientError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network errors
      if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
        return true;
      }

      // Check for HTTP error codes
      // 429 = rate limited, 5xx = server error
      if (message.includes('429') || /5\d{2}/.test(message)) {
        return true;
      }
    }

    return false;
  }

  // Execute a mutation - this needs to be set externally
  private mutationExecutor: ((mutation: QueuedMutation) => Promise<void>) | null = null;

  setMutationExecutor(executor: (mutation: QueuedMutation) => Promise<void>): void {
    this.mutationExecutor = executor;
  }

  private async executeMutation(mutation: QueuedMutation): Promise<void> {
    if (!this.mutationExecutor) {
      throw new Error('Mutation executor not set');
    }
    await this.mutationExecutor(mutation);
  }

  // Retry failed mutations (reset retryCount)
  async retryFailed(): Promise<void> {
    const failedMutations = this.queue.filter(m => m.status === 'failed');

    failedMutations.forEach(m => {
      m.status = 'pending';
      m.retryCount = 0;
      m.error = undefined;
    });

    if (failedMutations.length > 0) {
      await this.persistQueue();
      this.notifyListeners();
      logger.log(`Retrying ${failedMutations.length} failed mutations`);
      await this.processQueue();
    }
  }

  // Clear completed entries (successful mutations are already removed)
  async clearCompleted(): Promise<void> {
    // In this implementation, completed mutations are removed immediately
    // This is a no-op but kept for API compatibility
  }

  // Clear all mutations
  async clearAll(): Promise<void> {
    this.queue = [];
    await this.persistQueue();
    this.notifyListeners();
    logger.log('Cleared all mutations');
  }

  // Clear only failed mutations
  async clearFailed(): Promise<void> {
    this.queue = this.queue.filter(m => m.status !== 'failed');
    await this.persistQueue();
    this.notifyListeners();
    logger.log('Cleared failed mutations');
  }

  // Check if queue is currently processing
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  // Get all mutations (for debugging)
  getAllMutations(): QueuedMutation[] {
    return [...this.queue];
  }

  // Cleanup on destroy
  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
  }
}

export const mutationQueue = MutationQueue.getInstance();
