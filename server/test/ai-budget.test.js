const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  AiBudgetExceededError,
  createAiBudget,
  estimateTokens,
} = require("../utils/ai-budget");

const DAY_MS = 24 * 60 * 60 * 1000;

function makeBudget(overrides = {}) {
  let now = 10 * DAY_MS + 1000;
  const budget = createAiBudget({
    userDailyTokens: 1000,
    globalDailyTokens: 2500,
    maxRequestTokens: 600,
    now: () => now,
    ...overrides,
  });
  return { budget, advance: (ms) => (now += ms) };
}

describe("estimateTokens", () => {
  test("uses ~4 chars per token plus a fixed cost per image", () => {
    assert.equal(estimateTokens(400), 100);
    assert.equal(estimateTokens(0, 2), 3200);
    assert.equal(estimateTokens(1), 1);
  });
});

describe("createAiBudget", () => {
  test("rejects a single request larger than the per-request cap", () => {
    const { budget } = makeBudget();
    assert.throws(
      () => budget.check("u1", 601),
      (err) => err instanceof AiBudgetExceededError && err.scope === "request",
    );
    budget.check("u1", 600);
  });

  test("cuts a user off once their recorded usage reaches the daily cap", () => {
    const { budget } = makeBudget();
    budget.record("u1", 900);
    budget.check("u1", 100);
    assert.throws(
      () => budget.check("u1", 101),
      (err) =>
        err instanceof AiBudgetExceededError &&
        err.scope === "user" &&
        err.retryAfterSeconds > 0,
    );
    // Other users are unaffected.
    budget.check("u2", 500);
  });

  test("trips the global breaker across all users", () => {
    const { budget } = makeBudget();
    budget.record("u1", 1000);
    budget.record("u2", 1000);
    budget.record("u3", 400);
    assert.throws(
      () => budget.check("u4", 200),
      (err) => err instanceof AiBudgetExceededError && err.scope === "global",
    );
  });

  test("resets counters at the UTC day boundary", () => {
    const { budget, advance } = makeBudget();
    budget.record("u1", 1000);
    assert.throws(() => budget.check("u1", 1));
    advance(DAY_MS);
    budget.check("u1", 1);
    assert.equal(budget.stats("u1").userTokensToday, 0);
    assert.equal(budget.stats("u1").globalTokensToday, 0);
  });

  test("prune drops stale per-user entries but keeps today's", () => {
    const { budget, advance } = makeBudget();
    budget.record("old", 10);
    advance(DAY_MS);
    budget.record("fresh", 10);
    budget.prune();
    assert.equal(budget.stats("old").userTokensToday, 0);
    assert.equal(budget.stats("fresh").userTokensToday, 10);
  });
});
