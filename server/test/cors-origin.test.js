const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  isAllowedOrigin,
  makeCorsOriginHandler,
  ALLOWED_ORIGINS,
} = require("../utils/cors-origin");

describe("isAllowedOrigin", () => {
  test("allows requests with no origin (curl, native apps, same-origin)", () => {
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin(""), true);
  });

  test("allows every explicitly listed origin", () => {
    for (const origin of ALLOWED_ORIGINS) {
      assert.equal(isAllowedOrigin(origin), true, origin);
    }
  });

  test("allows https subdomains of shadowsky.io and asphodel.is", () => {
    assert.equal(isAllowedOrigin("https://main.shadowsky.io"), true);
    assert.equal(isAllowedOrigin("https://preview-42.asphodel.is"), true);
    assert.equal(isAllowedOrigin("https://a.b.asphodel.is"), true);
  });

  test("rejects http (non-TLS) subdomains", () => {
    assert.equal(isAllowedOrigin("http://main.asphodel.is"), false);
    assert.equal(isAllowedOrigin("http://shadowsky.io"), false);
  });

  test("rejects unrelated and look-alike domains", () => {
    assert.equal(isAllowedOrigin("https://evil.com"), false);
    assert.equal(isAllowedOrigin("https://asphodel.is.evil.com"), false);
    assert.equal(isAllowedOrigin("https://notasphodel.is"), false);
    assert.equal(isAllowedOrigin("https://shadowsky.io.attacker.net"), false);
  });

  test("rejects origins with embedded paths or ports masquerading as allowed hosts", () => {
    assert.equal(isAllowedOrigin("https://evil.com/x.asphodel.is"), false);
    assert.equal(isAllowedOrigin("https://asphodel.is:8443/.."), false);
  });

  test("rejects non-https localhost ports outside the allowed dev set", () => {
    assert.equal(isAllowedOrigin("http://localhost:3000"), false);
    assert.equal(isAllowedOrigin("http://localhost:5173"), true);
  });
});

describe("makeCorsOriginHandler", () => {
  test("invokes callback(null, true) for an allowed origin without logging", () => {
    const lines = [];
    const handler = makeCorsOriginHandler({ log: (l) => lines.push(l) });
    let result;
    handler("https://asphodel.is", (err, allow) => {
      assert.equal(err, null);
      result = allow;
    });
    assert.equal(result, true);
    assert.equal(lines.length, 0);
  });

  test("rejects with callback(null, false) — never an Error — and logs one line", () => {
    const lines = [];
    const handler = makeCorsOriginHandler({ log: (l) => lines.push(l) });
    /** @type {unknown} */
    let calledErr = "unset";
    let result;
    handler("https://evil.com", (err, allow) => {
      calledErr = err;
      result = allow;
    });
    // Passing an Error here would route every rejected bot request through the
    // Express 500 handler with a full stack trace (the original incident).
    assert.equal(calledErr, null);
    assert.equal(result, false);
    assert.equal(lines.length, 1);
    assert.deepEqual(JSON.parse(lines[0]), {
      t: "cors_reject",
      origin: "https://evil.com",
    });
  });
});
