const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getClientIp, aiUserLimiter } = require("../middleware/rate-limit");

/** Minimal req/res pair for driving Express middleware by hand. */
function fakeExchange({ userId, ip }) {
  const req = {
    headers: { "x-forwarded-for": ip },
    auth: userId ? { userId } : undefined,
  };
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    on() {},
  };
  return { req, res };
}

async function hit(limiter, opts) {
  const { req, res } = fakeExchange(opts);
  let passed = false;
  await limiter(req, res, () => {
    passed = true;
  });
  return { passed, res };
}

test("aiUserLimiter keys on the authenticated user, not the IP", async () => {
  const userId = `did:plc:limit-${Date.now()}`;
  // 20 requests from 20 different IPs all count against the same account.
  for (let i = 0; i < 20; i++) {
    const { passed } = await hit(aiUserLimiter, { userId, ip: `10.0.0.${i}` });
    assert.equal(passed, true, `request ${i + 1} should pass`);
  }
  const { passed, res } = await hit(aiUserLimiter, { userId, ip: "10.0.0.99" });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error.code, "RATE_LIMITED");

  // A different account from one of those same IPs is unaffected.
  const other = await hit(aiUserLimiter, {
    userId: `${userId}-other`,
    ip: "10.0.0.1",
  });
  assert.equal(other.passed, true);
});

test("getClientIp trusts the address appended by the ALB", () => {
  const req = {
    headers: {
      "x-forwarded-for": "203.0.113.99, 198.51.100.24",
    },
  };

  assert.equal(getClientIp(req), "198.51.100.24");
});

test("getClientIp trims whitespace around a single forwarded address", () => {
  const req = {
    headers: {
      "x-forwarded-for": " 198.51.100.24 ",
    },
  };

  assert.equal(getClientIp(req), "198.51.100.24");
});

test("getClientIp falls back to the direct socket address", () => {
  const req = {
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  };

  assert.equal(getClientIp(req), "127.0.0.1");
});
