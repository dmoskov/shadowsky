/**
 * Resumable Upload Implementation using tus.io Protocol
 *
 * tus (https://tus.io/) is an open protocol for resumable file uploads.
 * This implementation provides:
 * - Chunked uploads for large files
 * - Resume from last successful chunk on failure
 * - Upload progress tracking
 * - Persistent upload state for recovery
 */

import { createLogger } from "../../utils/logger";
import type {
  IResumableUploader,
  ResumableUploadState,
  UploadProgress,
  UploadResult,
} from "./types";

const logger = createLogger("ResumableUploader");

/**
 * Configuration for resumable uploads
 */
export interface ResumableUploaderConfig {
  /** Chunk size in bytes (default: 5MB) */
  chunkSize?: number;
  /** Maximum retry attempts per chunk (default: 3) */
  maxRetries?: number;
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** IndexedDB database name for upload state persistence */
  dbName?: string;
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
}

const DEFAULT_CONFIG: Required<ResumableUploaderConfig> = {
  chunkSize: 5 * 1024 * 1024, // 5MB chunks
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  dbName: "bsky_resumable_uploads_db",
  headers: {},
};

/**
 * IndexedDB-based storage for upload state persistence
 */
class UploadStateStorage {
  private db: IDBDatabase | null = null;
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = "uploads";

  constructor(private readonly dbName: string) {}

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, {
            keyPath: "uploadId",
          });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
    });
  }

  async save(state: ResumableUploadState): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);

      const request = store.put(state);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(uploadId: string): Promise<ResumableUploadState | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);

      const request = store.get(uploadId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(uploadId: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);

      const request = store.delete(uploadId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getByStatus(
    status: ResumableUploadState["status"],
  ): Promise<ResumableUploadState[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index("status");

      const request = index.getAll(status);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getOlderThan(maxAgeMs: number): Promise<ResumableUploadState[]> {
    if (!this.db) await this.init();

    const cutoff = Date.now() - maxAgeMs;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index("createdAt");

      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Generate a unique upload ID
 */
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Resumable uploader implementation using tus.io protocol
 */
export class ResumableUploader implements IResumableUploader {
  private readonly config: Required<ResumableUploaderConfig>;
  private readonly storage: UploadStateStorage;
  private readonly activeUploads = new Map<string, AbortController>();
  private initialized = false;

  constructor(config: ResumableUploaderConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storage = new UploadStateStorage(this.config.dbName);
  }

  /**
   * Initialize the uploader (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.storage.init();
      this.initialized = true;
    }
  }

  /**
   * Start or resume an upload
   */
  async upload(
    file: Blob | string,
    uploadUrl: string,
    metadata: Record<string, string>,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult> {
    await this.ensureInitialized();

    const uploadId = generateUploadId();
    const abortController = new AbortController();
    this.activeUploads.set(uploadId, abortController);

    try {
      // Get file blob
      const blob = typeof file === "string" ? await this.uriToBlob(file) : file;
      const totalSize = blob.size;

      // Create initial state
      const state: ResumableUploadState = {
        uploadId,
        fileUri: typeof file === "string" ? file : URL.createObjectURL(file),
        uploadUrl,
        offset: 0,
        totalSize,
        metadata,
        status: "pending",
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        retryCount: 0,
      };

      await this.storage.save(state);

      // Create upload on server
      logger.log(
        `[${uploadId}] Creating tus upload for ${this.formatBytes(totalSize)}`,
      );

      const createResponse = await this.createTusUpload(
        uploadUrl,
        totalSize,
        metadata,
        abortController.signal,
      );

      if (!createResponse.uploadLocation) {
        throw new Error("Server did not return upload location");
      }

      // Update state with upload location
      state.uploadUrl = createResponse.uploadLocation;
      state.status = "uploading";
      await this.storage.save(state);

      // Start uploading chunks
      const result = await this.uploadChunks(
        blob,
        state,
        abortController.signal,
        onProgress,
      );

      // Cleanup on success
      this.activeUploads.delete(uploadId);
      await this.storage.delete(uploadId);

      return result;
    } catch (error) {
      this.activeUploads.delete(uploadId);

      // Update state on error
      const state = await this.storage.get(uploadId);
      if (state) {
        state.status = "failed";
        state.error = error instanceof Error ? error.message : String(error);
        await this.storage.save(state);
      }

      logger.error(`[${uploadId}] Upload failed:`, error);

      return {
        success: false,
        uploadId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Resume a paused or failed upload
   */
  async resume(
    uploadId: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult> {
    await this.ensureInitialized();

    const state = await this.storage.get(uploadId);
    if (!state) {
      return {
        success: false,
        uploadId,
        error: "Upload not found",
      };
    }

    if (state.status === "completed") {
      return {
        success: true,
        uploadId,
      };
    }

    const abortController = new AbortController();
    this.activeUploads.set(uploadId, abortController);

    try {
      // Get current offset from server
      const serverOffset = await this.getServerOffset(
        state.uploadUrl,
        abortController.signal,
      );

      // Update state
      state.offset = serverOffset;
      state.status = "uploading";
      state.lastActivityAt = Date.now();
      await this.storage.save(state);

      // Get file blob
      const blob = await this.uriToBlob(state.fileUri);

      // Resume uploading
      const result = await this.uploadChunks(
        blob,
        state,
        abortController.signal,
        onProgress,
      );

      // Cleanup on success
      this.activeUploads.delete(uploadId);
      await this.storage.delete(uploadId);

      return result;
    } catch (error) {
      this.activeUploads.delete(uploadId);

      // Update state on error
      state.status = "failed";
      state.error = error instanceof Error ? error.message : String(error);
      state.retryCount++;
      await this.storage.save(state);

      logger.error(`[${uploadId}] Resume failed:`, error);

      return {
        success: false,
        uploadId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Pause an in-progress upload
   */
  async pause(uploadId: string): Promise<void> {
    await this.ensureInitialized();

    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
    }

    const state = await this.storage.get(uploadId);
    if (state && state.status === "uploading") {
      state.status = "paused";
      state.lastActivityAt = Date.now();
      await this.storage.save(state);
    }
  }

  /**
   * Cancel an upload
   */
  async cancel(uploadId: string): Promise<void> {
    await this.ensureInitialized();

    // Abort if in progress
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
    }

    // Try to delete from server
    const state = await this.storage.get(uploadId);
    if (state?.uploadUrl) {
      try {
        await fetch(state.uploadUrl, {
          method: "DELETE",
          headers: {
            "Tus-Resumable": "1.0.0",
            ...this.config.headers,
          },
        });
      } catch {
        // Ignore delete errors
      }
    }

    // Remove from local storage
    await this.storage.delete(uploadId);

    logger.log(`[${uploadId}] Upload cancelled`);
  }

  /**
   * Get the current state of an upload
   */
  async getUploadState(uploadId: string): Promise<ResumableUploadState | null> {
    await this.ensureInitialized();
    return this.storage.get(uploadId);
  }

  /**
   * Get all pending/paused uploads
   */
  async getPendingUploads(): Promise<ResumableUploadState[]> {
    await this.ensureInitialized();

    const pending = await this.storage.getByStatus("pending");
    const paused = await this.storage.getByStatus("paused");
    const uploading = await this.storage.getByStatus("uploading");

    return [...pending, ...paused, ...uploading];
  }

  /**
   * Clean up completed/failed uploads older than specified time
   */
  async cleanupOldUploads(maxAgeMs: number): Promise<void> {
    await this.ensureInitialized();

    const oldUploads = await this.storage.getOlderThan(maxAgeMs);

    for (const upload of oldUploads) {
      if (upload.status === "completed" || upload.status === "failed") {
        await this.storage.delete(upload.uploadId);
        logger.log(`[${upload.uploadId}] Cleaned up old upload`);
      }
    }
  }

  /**
   * Create a new tus upload on the server
   */
  private async createTusUpload(
    uploadUrl: string,
    totalSize: number,
    metadata: Record<string, string>,
    signal: AbortSignal,
  ): Promise<{ uploadLocation: string | null }> {
    // Encode metadata as tus expects
    const metadataHeader = Object.entries(metadata)
      .map(([key, value]) => `${key} ${btoa(value)}`)
      .join(",");

    const response = await fetch(uploadUrl, {
      method: "POST",
      signal,
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": totalSize.toString(),
        "Upload-Metadata": metadataHeader,
        "Content-Type": "application/offset+octet-stream",
        ...this.config.headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create upload: ${response.status} ${response.statusText}`,
      );
    }

    return {
      uploadLocation: response.headers.get("Location"),
    };
  }

  /**
   * Get the current upload offset from the server
   */
  private async getServerOffset(
    uploadUrl: string,
    signal: AbortSignal,
  ): Promise<number> {
    const response = await fetch(uploadUrl, {
      method: "HEAD",
      signal,
      headers: {
        "Tus-Resumable": "1.0.0",
        ...this.config.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload offset: ${response.status}`);
    }

    const offset = response.headers.get("Upload-Offset");
    return offset ? parseInt(offset, 10) : 0;
  }

  /**
   * Upload file in chunks with retry logic
   */
  private async uploadChunks(
    blob: Blob,
    state: ResumableUploadState,
    signal: AbortSignal,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult> {
    const { chunkSize, maxRetries, retryDelay } = this.config;
    const uploadStartTime = Date.now();
    let bytesUploaded = state.offset;

    while (bytesUploaded < state.totalSize) {
      if (signal.aborted) {
        throw new Error("Upload cancelled");
      }

      const start = bytesUploaded;
      const end = Math.min(start + chunkSize, state.totalSize);
      const chunk = blob.slice(start, end);

      let attempt = 0;
      let success = false;

      while (!success && attempt < maxRetries) {
        try {
          const response = await this.uploadChunk(
            state.uploadUrl,
            chunk,
            bytesUploaded,
            signal,
          );

          if (!response.ok) {
            throw new Error(`Chunk upload failed: ${response.status}`);
          }

          // Get updated offset from response
          const newOffset = response.headers.get("Upload-Offset");
          if (newOffset) {
            bytesUploaded = parseInt(newOffset, 10);
          } else {
            bytesUploaded = end;
          }

          // Update state
          state.offset = bytesUploaded;
          state.lastActivityAt = Date.now();
          await this.storage.save(state);

          // Report progress
          const elapsed = (Date.now() - uploadStartTime) / 1000;
          const speed = bytesUploaded / elapsed;
          const remaining = (state.totalSize - bytesUploaded) / speed;

          onProgress?.({
            bytesUploaded,
            totalBytes: state.totalSize,
            percentage: Math.round((bytesUploaded / state.totalSize) * 100),
            speed,
            estimatedTimeRemaining: Math.round(remaining),
          });

          success = true;
          logger.log(
            `[${state.uploadId}] Uploaded ${this.formatBytes(bytesUploaded)}/${this.formatBytes(state.totalSize)}`,
          );
        } catch (error) {
          attempt++;

          if (attempt >= maxRetries) {
            throw error;
          }

          logger.warn(
            `[${state.uploadId}] Chunk upload failed, retrying (${attempt}/${maxRetries}):`,
            error,
          );

          await this.sleep(retryDelay * attempt);
        }
      }
    }

    // Mark as completed
    state.status = "completed";
    state.lastActivityAt = Date.now();
    await this.storage.save(state);

    logger.log(`[${state.uploadId}] Upload completed successfully`);

    return {
      success: true,
      uploadId: state.uploadId,
      remoteUrl: state.uploadUrl,
    };
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(
    uploadUrl: string,
    chunk: Blob,
    offset: number,
    signal: AbortSignal,
  ): Promise<Response> {
    return fetch(uploadUrl, {
      method: "PATCH",
      signal,
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": offset.toString(),
        "Content-Type": "application/offset+octet-stream",
        "Content-Length": chunk.size.toString(),
        ...this.config.headers,
      },
      body: chunk,
    });
  }

  /**
   * Convert URI to Blob
   */
  private async uriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return response.blob();
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
