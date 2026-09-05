const { test, describe, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { aiDenylist, blockedDids } = require("../middleware/ai-denylist");

function run(req) {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let passed = false;
  aiDenylist(req, res, () => {
    passed = true;
  });
  return { passed, res };
}

describe("aiDenylist", () => {
  const original = process.env.AI_BLOCKED_DIDS;
  afterEach(() => {
    if (original === undefined) delete process.env.AI_BLOCKED_DIDS;
    else process.env.AI_BLOCKED_DIDS = original;
  });

  test("passes everyone when the list is empty", () => {
    delete process.env.AI_BLOCKED_DIDS;
    assert.equal(blockedDids().size, 0);
    assert.equal(run({ auth: { userId: "did:plc:alice" } }).passed, true);
  });

  test("blocks listed DIDs with 403 and lets others through", () => {
    process.env.AI_BLOCKED_DIDS = " did:plc:mallory, did:plc:eve ,";
    const blocked = run({
      auth: { userId: "did:plc:mallory" },
      originalUrl: "/api/v1/writing-feedback",
    });
    assert.equal(blocked.passed, false);
    assert.equal(blocked.res.statusCode, 403);
    assert.equal(blocked.res.body.error.code, "AI_ACCESS_BLOCKED");
    assert.equal(run({ auth: { userId: "did:plc:alice" } }).passed, true);
  });
});
