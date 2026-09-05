const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  FEDERATION_ENV_VARS,
  STS_AUDIENCE,
  anthropicAvailable,
  anthropicAuthMode,
  getAnthropicApiKey,
  resetAnthropicCredentialCache,
} = require("../utils/anthropic-client");

const ENV_KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_WORKSPACE_ID", ...FEDERATION_ENV_VARS];

function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const next = responses.shift() || { status: 200, body: { access_token: "oat", expires_in: 600 } };
    return {
      ok: next.status < 400,
      status: next.status,
      text: async () => JSON.stringify(next.body),
    };
  };
  return { fn, calls };
}

describe("anthropic-client", () => {
  const saved = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetAnthropicCredentialCache();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function configureFederation() {
    process.env.ANTHROPIC_FEDERATION_RULE_ID = "fdrl_test";
    process.env.ANTHROPIC_ORGANIZATION_ID = "org-uuid";
    process.env.ANTHROPIC_SERVICE_ACCOUNT_ID = "svac_test";
  }

  test("reports availability and mode", () => {
    assert.equal(anthropicAvailable(), false);
    assert.equal(anthropicAuthMode(), "not configured");
    configureFederation();
    assert.equal(anthropicAvailable(), true);
    assert.equal(anthropicAuthMode(), "federation");
    process.env.ANTHROPIC_API_KEY = "sk-ant-api";
    assert.equal(anthropicAuthMode(), "static key");
  });

  test("a static key wins over federation", async () => {
    configureFederation();
    process.env.ANTHROPIC_API_KEY = "sk-ant-api";
    assert.equal(await getAnthropicApiKey(), "sk-ant-api");
  });

  test("fails loudly naming the missing federation vars", async () => {
    process.env.ANTHROPIC_FEDERATION_RULE_ID = "fdrl_test";
    await assert.rejects(getAnthropicApiKey(), /missing: ANTHROPIC_ORGANIZATION_ID, ANTHROPIC_SERVICE_ACCOUNT_ID/);
  });

  test("mints an STS token and exchanges it with the jwt-bearer grant", async () => {
    configureFederation();
    process.env.ANTHROPIC_WORKSPACE_ID = "wrkspc_test";
    const { fn, calls } = fakeFetch([{ status: 200, body: { access_token: "sk-ant-oat01-x", expires_in: 600 } }]);
    const stsCalls = [];
    const token = await getAnthropicApiKey({
      fetch: fn,
      getIdentityToken: async (params) => {
        stsCalls.push(params);
        return "sts.jwt.1";
      },
    });
    assert.equal(token, "sk-ant-oat01-x");
    assert.deepEqual(stsCalls, [{ audience: STS_AUDIENCE, durationSeconds: 900 }]);
    assert.equal(calls[0].url, "https://api.anthropic.com/v1/oauth/token");
    assert.deepEqual(calls[0].body, {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: "sts.jwt.1",
      federation_rule_id: "fdrl_test",
      organization_id: "org-uuid",
      service_account_id: "svac_test",
      workspace_id: "wrkspc_test",
    });
  });

  test("caches the access token and re-exchanges near expiry with a fresh assertion", async () => {
    configureFederation();
    let clock = 1_000_000;
    let n = 0;
    const { fn, calls } = fakeFetch([
      { status: 200, body: { access_token: "first", expires_in: 600 } },
      { status: 200, body: { access_token: "second", expires_in: 600 } },
    ]);
    const deps = {
      fetch: fn,
      now: () => clock,
      getIdentityToken: async () => `sts.jwt.${++n}`,
    };
    assert.equal(await getAnthropicApiKey(deps), "first");
    clock += 60 * 1000;
    assert.equal(await getAnthropicApiKey(deps), "first");
    assert.equal(calls.length, 1);
    // 8.5 minutes in: inside the 2-minute refresh margin of a 10-minute token.
    clock += 450 * 1000;
    assert.equal(await getAnthropicApiKey(deps), "second");
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.assertion, "sts.jwt.2");
  });

  test("coalesces concurrent exchanges", async () => {
    configureFederation();
    const { fn, calls } = fakeFetch([]);
    const deps = { fetch: fn, getIdentityToken: async () => "sts.jwt" };
    const results = await Promise.all([getAnthropicApiKey(deps), getAnthropicApiKey(deps), getAnthropicApiKey(deps)]);
    assert.deepEqual(results, ["oat", "oat", "oat"]);
    assert.equal(calls.length, 1);
  });

  test("surfaces an exchange denial with the status", async () => {
    configureFederation();
    const { fn } = fakeFetch([{ status: 401, body: { type: "error", error: { message: "Authentication failed" } } }]);
    await assert.rejects(
      getAnthropicApiKey({ fetch: fn, getIdentityToken: async () => "sts.jwt" }),
      /exchange failed \(401\)/,
    );
  });
});
