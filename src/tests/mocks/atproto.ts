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
            }),
            getRecord: vi.fn().mockResolvedValue({
              data: {
                uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-123",
                cid: "mock-cid",
                value: {},
              },
            }),
            listRecords: vi.fn().mockResolvedValue({
              data: {
                records: [],
                cursor: undefined,
              },
            }),
            putRecord: vi.fn().mockResolvedValue({
              uri: "at://did:plc:testuser123/com.shadowsky.draft/draft-123",
              cid: "mock-cid",
            }),
            deleteRecord: vi.fn().mockResolvedValue({}),
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
            }),
            putPreferences: vi.fn().mockResolvedValue({}),
          },
        },
      },
    },
    ...overrides,
  } as AtpAgent;

  return mockAgent;
};
