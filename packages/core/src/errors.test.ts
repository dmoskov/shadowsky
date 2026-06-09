import { afterEach, describe, expect, it } from "vitest";
import {
  ATProtoError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  SessionExpiredError,
  categorizeError,
  isAuthenticationError,
  isRateLimitError,
  isSessionExpiredError,
  mapATProtoError,
  setOnlineChecker,
} from "./errors";

afterEach(() => {
  setOnlineChecker(() => true);
});

describe("error classes", () => {
  it("carry status and error codes", () => {
    expect(new SessionExpiredError().status).toBe(401);
    expect(new AuthenticationError().status).toBe(401);
    expect(new RateLimitError().status).toBe(429);
    expect(new NetworkError().status).toBe(0);
    expect(new RateLimitError("slow down", 30).retryAfter).toBe(30);
  });

  it("are instanceof ATProtoError", () => {
    expect(new RateLimitError()).toBeInstanceOf(ATProtoError);
    expect(new SessionExpiredError()).toBeInstanceOf(ATProtoError);
  });
});

describe("type guards", () => {
  it("match instances, status codes, and error strings", () => {
    expect(isRateLimitError(new RateLimitError())).toBe(true);
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ error: "RateLimitExceeded" })).toBe(true);
    expect(isRateLimitError({ status: 500 })).toBe(false);

    expect(isAuthenticationError({ status: 401 })).toBe(true);
    expect(isSessionExpiredError({ error: "SessionExpired" })).toBe(true);
    expect(
      isSessionExpiredError({ status: 401, message: "session expired" }),
    ).toBe(true);
    expect(isSessionExpiredError({ status: 401, message: "nope" })).toBe(false);
  });
});

describe("mapATProtoError", () => {
  it("passes through existing ATProtoErrors", () => {
    const err = new RateLimitError();
    expect(mapATProtoError(err)).toBe(err);
  });

  it("maps 429 to RateLimitError with retry-after header", () => {
    const mapped = mapATProtoError({
      status: 429,
      message: "too many",
      headers: { "retry-after": 60 },
    });
    expect(mapped).toBeInstanceOf(RateLimitError);
    expect((mapped as RateLimitError).retryAfter).toBe(60);
  });

  it("maps 401 to SessionExpiredError when the message mentions session", () => {
    expect(
      mapATProtoError({ status: 401, message: "session revoked" }),
    ).toBeInstanceOf(SessionExpiredError);
    expect(
      mapATProtoError({ status: 401, message: "bad credentials" }),
    ).toBeInstanceOf(AuthenticationError);
  });

  it("maps response status 0 to NetworkError", () => {
    // Note: a top-level `status: 0` is falsy and treated as missing by the
    // `status || response.status` fallback; only response.status reaches the
    // status === 0 check. Long-standing behavior, preserved in the migration.
    expect(
      mapATProtoError({ response: { status: 0 }, message: "x" }),
    ).toBeInstanceOf(NetworkError);
  });

  it("uses the injected online checker for connectivity errors", () => {
    setOnlineChecker(() => false);
    expect(mapATProtoError({ status: 500, message: "x" })).toBeInstanceOf(
      NetworkError,
    );
    setOnlineChecker(() => true);
    const mapped = mapATProtoError({ status: 500, message: "x" });
    expect(mapped).toBeInstanceOf(ATProtoError);
    expect(mapped).not.toBeInstanceOf(NetworkError);
  });
});

describe("categorizeError", () => {
  it("categorizes by error shape", () => {
    expect(categorizeError({ status: 401 })).toBe("auth");
    expect(categorizeError({ status: 429 })).toBe("rate-limit");
    expect(categorizeError(new NetworkError())).toBe("network");
    expect(categorizeError({ status: 400 })).toBe("validation");
    expect(categorizeError({ status: 500 })).toBe("unknown");
  });

  it("categorizes anything as network when the platform reports offline", () => {
    setOnlineChecker(() => false);
    expect(categorizeError({ status: 500 })).toBe("network");
  });
});
