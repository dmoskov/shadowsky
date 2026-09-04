import { describe, expect, it, vi } from "vitest";
import {
  API_SERVICE_AUTH_LXM,
  API_SERVICE_DID,
  createApiAuthHeaders,
  type ServiceAuthAgent,
} from "./api-auth";

function fakeAgent(tokens: string[]) {
  const getServiceAuth = vi.fn(async () => {
    const token = tokens.shift();
    if (!token) throw new Error("PDS refused");
    return { success: true, headers: {}, data: { token } };
  });
  const agent = {
    com: { atproto: { server: { getServiceAuth } } },
  } as unknown as ServiceAuthAgent;
  return { agent, getServiceAuth };
}

describe("createApiAuthHeaders", () => {
  it("returns no headers when logged out", async () => {
    const { agent } = fakeAgent(["t1"]);
    const headers = createApiAuthHeaders({
      getAgent: () => agent,
      getDid: () => null,
    });
    expect(await headers.getHeaders()).toEqual({});
  });

  it("mints a token scoped to the API service and reuses it until near expiry", async () => {
    let clock = 1_000_000_000_000;
    const { agent, getServiceAuth } = fakeAgent(["t1", "t2"]);
    const headers = createApiAuthHeaders({
      getAgent: () => agent,
      getDid: () => "did:plc:alice",
      now: () => clock,
    });

    expect(await headers.getHeaders()).toEqual({ Authorization: "Bearer t1" });
    expect(getServiceAuth).toHaveBeenCalledWith({
      aud: API_SERVICE_DID,
      lxm: API_SERVICE_AUTH_LXM,
      exp: Math.floor(clock / 1000) + 55 * 60,
    });

    // Well within the TTL: cached.
    clock += 30 * 60 * 1000;
    expect(await headers.getHeaders()).toEqual({ Authorization: "Bearer t1" });
    expect(getServiceAuth).toHaveBeenCalledTimes(1);

    // Inside the refresh margin: re-minted.
    clock += 24.5 * 60 * 1000;
    expect(await headers.getHeaders()).toEqual({ Authorization: "Bearer t2" });
    expect(getServiceAuth).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent mints into one PDS call", async () => {
    const { agent, getServiceAuth } = fakeAgent(["t1"]);
    const headers = createApiAuthHeaders({
      getAgent: () => agent,
      getDid: () => "did:plc:alice",
    });
    const results = await Promise.all([
      headers.getHeaders(),
      headers.getHeaders(),
      headers.getHeaders(),
    ]);
    expect(results).toEqual(Array(3).fill({ Authorization: "Bearer t1" }));
    expect(getServiceAuth).toHaveBeenCalledTimes(1);
  });

  it("re-mints for a different account after a switch", async () => {
    let did = "did:plc:alice";
    const { agent, getServiceAuth } = fakeAgent(["alice-token", "bob-token"]);
    const headers = createApiAuthHeaders({
      getAgent: () => agent,
      getDid: () => did,
    });
    expect(await headers.getHeaders()).toEqual({
      Authorization: "Bearer alice-token",
    });
    did = "did:plc:bob";
    expect(await headers.getHeaders()).toEqual({
      Authorization: "Bearer bob-token",
    });
    expect(getServiceAuth).toHaveBeenCalledTimes(2);
  });

  it("falls back to the legacy DID headers when the PDS will not mint", async () => {
    const { agent } = fakeAgent([]);
    const onFallback = vi.fn();
    const headers = createApiAuthHeaders({
      getAgent: () => agent,
      getDid: () => "did:plc:alice",
      onFallback,
    });
    expect(await headers.getHeaders()).toEqual({
      "X-User-DID": "did:plc:alice",
      "X-Bluesky-DID": "did:plc:alice",
    });
    expect(onFallback).toHaveBeenCalledWith(expect.any(Error));
  });

  it("falls back when no agent is available yet", async () => {
    const headers = createApiAuthHeaders({
      getAgent: () => null,
      getDid: () => "did:plc:alice",
    });
    expect(await headers.getHeaders()).toEqual({
      "X-User-DID": "did:plc:alice",
      "X-Bluesky-DID": "did:plc:alice",
    });
  });

  it("reset() discards the cached token", async () => {
    const { agent, getServiceAuth } = fakeAgent(["t1", "t2"]);
    const headers = createApiAuthHeaders({
      getAgent: () => agent,
      getDid: () => "did:plc:alice",
    });
    await headers.getHeaders();
    headers.reset();
    expect(await headers.getHeaders()).toEqual({ Authorization: "Bearer t2" });
    expect(getServiceAuth).toHaveBeenCalledTimes(2);
  });
});
