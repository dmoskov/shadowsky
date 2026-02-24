/**
 * Tests for useDMQueue hook
 *
 * Coverage targets:
 * 1. Initial state values (stats zero, isProcessing false, isInitialized eventually true)
 * 2. sendMessage enqueues via dmQueueDB and updates optimisticMessages
 * 3. retryMessage delegates to dmQueueDB.retryMessage
 * 4. getOptimisticMessages merges server + optimistic messages sorted by sentAt
 * 5. getOptimisticMessages marks server messages with _isOptimistic: false
 * 6. sendMessage throws when not authenticated
 * 7. Filters out optimistic messages with "sent" status
 * 8. Queue initialization calls dmQueueDB.init and sets up executor
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OptimisticDM } from "../services/dm-queue";
import type { DmMessage } from "../services/dm-service";

// --- Mocks ---

const mockAgent = { session: { accessJwt: "test-jwt" } };

vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    session: {
      did: "did:plc:testuser123",
      handle: "test.bsky.social",
      accessJwt: "jwt",
      refreshJwt: "rjwt",
    },
    agent: mockAgent,
  })),
}));

const mockEnqueueResult: OptimisticDM = {
  _localId: "local-1",
  _status: "sending",
  _retryCount: 0,
  _createdAt: Date.now(),
  conversationId: "conv-1",
  text: "Hello",
  senderDid: "did:plc:testuser123",
};

vi.mock("../services/dm-queue", () => ({
  dmQueueDB: {
    init: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn().mockResolvedValue({
      _localId: "local-1",
      _status: "sending",
      _retryCount: 0,
      _createdAt: Date.now(),
      conversationId: "conv-1",
      text: "Hello",
      senderDid: "did:plc:testuser123",
    }),
    retryMessage: vi.fn().mockResolvedValue(undefined),
    getStats: vi
      .fn()
      .mockResolvedValue({ pendingCount: 0, failedCount: 0, retryingCount: 0 }),
    isQueueProcessing: vi.fn().mockReturnValue(false),
    subscribe: vi.fn().mockReturnValue(() => {}),
    setMessageExecutor: vi.fn(),
    processQueue: vi.fn(),
    getMessagesForConversation: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../services/dm-service", () => ({
  dmService: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocks are set up
import { useAuth } from "../contexts/AuthContext";
import { dmQueueDB } from "../services/dm-queue";
import { useDMQueue } from "./useDMQueue";

describe("useDMQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply default mock implementations that clearAllMocks may strip
    vi.mocked(dmQueueDB.init).mockResolvedValue(undefined);
    vi.mocked(dmQueueDB.enqueue).mockResolvedValue({
      ...mockEnqueueResult,
      _createdAt: Date.now(),
    });
    vi.mocked(dmQueueDB.retryMessage).mockResolvedValue(undefined);
    vi.mocked(dmQueueDB.getStats).mockResolvedValue({
      pendingCount: 0,
      failedCount: 0,
      retryingCount: 0,
    });
    vi.mocked(dmQueueDB.isQueueProcessing).mockReturnValue(false);
    vi.mocked(dmQueueDB.subscribe).mockReturnValue(() => {});
    vi.mocked(dmQueueDB.getMessagesForConversation).mockResolvedValue([]);

    vi.mocked(useAuth).mockReturnValue({
      session: {
        did: "did:plc:testuser123",
        handle: "test.bsky.social",
        accessJwt: "jwt",
        refreshJwt: "rjwt",
      },
      agent: mockAgent,
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct initial state with zero stats and isProcessing false", () => {
    const { result } = renderHook(() => useDMQueue());

    expect(result.current.stats).toEqual({
      pendingCount: 0,
      failedCount: 0,
      retryingCount: 0,
    });
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.optimisticMessages).toBeInstanceOf(Map);
    expect(result.current.optimisticMessages.size).toBe(0);
  });

  it("should initialize the queue and eventually set isInitialized to true", async () => {
    const { result } = renderHook(() => useDMQueue());

    // Initially not yet initialized (async init)
    // After microtasks flush, it should become true
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(dmQueueDB.init).toHaveBeenCalledTimes(1);
    expect(dmQueueDB.setMessageExecutor).toHaveBeenCalledTimes(1);
    expect(dmQueueDB.getStats).toHaveBeenCalled();
  });

  it("should call dmQueueDB.enqueue and update optimisticMessages when sendMessage is called", async () => {
    const { result } = renderHook(() => useDMQueue());

    // Wait for initialization
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    let dm: OptimisticDM | undefined;
    await act(async () => {
      dm = await result.current.sendMessage("conv-1", "Hello");
    });

    expect(dmQueueDB.enqueue).toHaveBeenCalledWith(
      "conv-1",
      "Hello",
      "did:plc:testuser123",
    );
    expect(dm).toBeDefined();
    expect(dm!._localId).toBe("local-1");
    expect(dm!.text).toBe("Hello");

    // The optimisticMessages map should now contain the message for conv-1
    expect(result.current.optimisticMessages.has("conv-1")).toBe(true);
    const messages = result.current.optimisticMessages.get("conv-1");
    expect(messages).toHaveLength(1);
    expect(messages![0]._localId).toBe("local-1");
  });

  it("should call dmQueueDB.retryMessage when retryMessage is called", async () => {
    const { result } = renderHook(() => useDMQueue());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await act(async () => {
      await result.current.retryMessage("local-42");
    });

    expect(dmQueueDB.retryMessage).toHaveBeenCalledWith("local-42");
  });

  it("should merge server messages with optimistic ones sorted by sentAt", async () => {
    const now = Date.now();
    const optimisticDM: OptimisticDM = {
      _localId: "local-2",
      _status: "sending",
      _retryCount: 0,
      _createdAt: now + 5000,
      conversationId: "conv-1",
      text: "Optimistic message",
      senderDid: "did:plc:testuser123",
    };

    vi.mocked(dmQueueDB.enqueue).mockResolvedValue(optimisticDM);

    const { result } = renderHook(() => useDMQueue());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // Send a message to populate optimisticMessages
    await act(async () => {
      await result.current.sendMessage("conv-1", "Optimistic message");
    });

    const serverMessages: DmMessage[] = [
      {
        id: "server-msg-1",
        rev: "rev1",
        text: "Server message 1",
        sentAt: new Date(now - 10000).toISOString(),
        sender: { did: "did:plc:otheruser" },
      },
      {
        id: "server-msg-2",
        rev: "rev2",
        text: "Server message 2",
        sentAt: new Date(now).toISOString(),
        sender: { did: "did:plc:testuser123" },
      },
    ];

    const combined = result.current.getOptimisticMessages(
      serverMessages,
      "conv-1",
    );

    // Should have 3 messages: 2 server + 1 optimistic
    expect(combined).toHaveLength(3);

    // Should be sorted by sentAt ascending
    const sentAts = combined.map((m) => new Date(m.sentAt).getTime());
    for (let i = 1; i < sentAts.length; i++) {
      expect(sentAts[i]).toBeGreaterThanOrEqual(sentAts[i - 1]);
    }

    // The optimistic message should be last (latest timestamp)
    expect(combined[2]._isOptimistic).toBe(true);
    expect(combined[2].text).toBe("Optimistic message");
    expect(combined[2]._localId).toBe("local-2");
    expect(combined[2]._status).toBe("sending");
  });

  it("should mark server messages with _isOptimistic false", async () => {
    const { result } = renderHook(() => useDMQueue());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    const serverMessages: DmMessage[] = [
      {
        id: "server-msg-1",
        rev: "rev1",
        text: "Hello from server",
        sentAt: new Date().toISOString(),
        sender: { did: "did:plc:otheruser" },
      },
      {
        id: "server-msg-2",
        rev: "rev2",
        text: "Another server message",
        sentAt: new Date().toISOString(),
        sender: { did: "did:plc:testuser123" },
      },
    ];

    const combined = result.current.getOptimisticMessages(
      serverMessages,
      "conv-no-optimistic",
    );

    expect(combined).toHaveLength(2);
    for (const msg of combined) {
      expect(msg._isOptimistic).toBe(false);
    }
  });

  it("should throw when sendMessage is called without authentication", async () => {
    // Override useAuth to return null session
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      agent: null,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useDMQueue());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await expect(
      act(async () => {
        await result.current.sendMessage("conv-1", "Should fail");
      }),
    ).rejects.toThrow("Not authenticated");

    expect(dmQueueDB.enqueue).not.toHaveBeenCalled();
  });

  it("should filter out optimistic messages with 'sent' status from merged results", async () => {
    const now = Date.now();

    // Return a message that has already been marked as "sent"
    const sentOptimisticDM: OptimisticDM = {
      _localId: "local-sent",
      _status: "sent",
      _retryCount: 0,
      _createdAt: now + 1000,
      conversationId: "conv-1",
      text: "Already sent",
      senderDid: "did:plc:testuser123",
    };

    // Return a message that is still pending
    const pendingOptimisticDM: OptimisticDM = {
      _localId: "local-pending",
      _status: "sending",
      _retryCount: 0,
      _createdAt: now + 2000,
      conversationId: "conv-1",
      text: "Still pending",
      senderDid: "did:plc:testuser123",
    };

    // First enqueue returns the sent message, second returns the pending one
    vi.mocked(dmQueueDB.enqueue)
      .mockResolvedValueOnce(sentOptimisticDM)
      .mockResolvedValueOnce(pendingOptimisticDM);

    const { result } = renderHook(() => useDMQueue());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // Send both messages to populate state
    await act(async () => {
      await result.current.sendMessage("conv-1", "Already sent");
    });
    await act(async () => {
      await result.current.sendMessage("conv-1", "Still pending");
    });

    const serverMessages: DmMessage[] = [
      {
        id: "server-1",
        rev: "rev1",
        text: "Server msg",
        sentAt: new Date(now).toISOString(),
        sender: { did: "did:plc:otheruser" },
      },
    ];

    const combined = result.current.getOptimisticMessages(
      serverMessages,
      "conv-1",
    );

    // The "sent" message should be filtered out, leaving server msg + pending msg = 2
    expect(combined).toHaveLength(2);

    const optimisticInResult = combined.filter((m) => m._isOptimistic);
    expect(optimisticInResult).toHaveLength(1);
    expect(optimisticInResult[0].text).toBe("Still pending");
    expect(optimisticInResult[0]._status).toBe("sending");
  });

  it("should set up the message executor during initialization", async () => {
    renderHook(() => useDMQueue());

    await waitFor(() => {
      expect(dmQueueDB.setMessageExecutor).toHaveBeenCalledTimes(1);
    });

    // Verify the executor was set with a function
    const executorCall = vi.mocked(dmQueueDB.setMessageExecutor).mock.calls[0];
    expect(typeof executorCall[0]).toBe("function");
  });

  it("should subscribe to queue changes after initialization", async () => {
    renderHook(() => useDMQueue());

    await waitFor(() => {
      expect(dmQueueDB.subscribe).toHaveBeenCalled();
    });

    // subscribe should have been called with a callback function
    const subscribeCalls = vi.mocked(dmQueueDB.subscribe).mock.calls;
    expect(subscribeCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of subscribeCalls) {
      expect(typeof call[0]).toBe("function");
    }
  });
});
