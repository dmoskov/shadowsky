import { AtpAgent } from "@atproto/api";
import { vi } from "vitest";

export const createMockAgent = (overrides?: Partial<AtpAgent>): AtpAgent => {
  const mockAgent = {
    session: {
      did: "did:plc:testuser123",
      handle: "testuser.bsky.social",
      email: "test@example.com",
      accessJwt: "mock-access-jwt",
      refreshJwt: "mock-refresh-jwt",
    },
    api: {
      com: {
        atproto: {
          repo: {
            createRecord: vi.fn().mockResolvedValue({
              uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-123",
              cid: "mock-cid",
            }) as any,
            getRecord: vi.fn().mockResolvedValue({
              data: {
                uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-123",
                cid: "mock-cid",
                value: {},
              },
            }) as any,
            listRecords: vi.fn().mockResolvedValue({
              data: {
                records: [],
                cursor: undefined,
              },
            }) as any,
            putRecord: vi.fn().mockResolvedValue({
              uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-123",
              cid: "mock-cid",
            }) as any,
            deleteRecord: vi.fn().mockResolvedValue({}) as any,
          },
        },
      },
      app: {
        bsky: {
          actor: {
            getPreferences: vi.fn().mockResolvedValue({
              data: {
                preferences: [],
              },
            }) as any,
            putPreferences: vi.fn().mockResolvedValue({}) as any,
          },
        },
      },
    },
    ...overrides,
  } as any;

  return mockAgent;
};
