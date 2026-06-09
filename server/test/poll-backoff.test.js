const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  nextBackoff,
  computePollDelay,
  BACKOFF_CAP_MS,
} = require("../utils/poll-backoff");

const POLL_INTERVAL = 15000;

describe("nextBackoff", () => {
  test("first 429 doubles the poll interval", () => {
    assert.equal(nextBackoff(0, POLL_INTERVAL), 30000);
    assert.equal(nextBackoff(undefined, POLL_INTERVAL), 30000);
  });

  test("subsequent 429s double the previous backoff", () => {
    assert.equal(nextBackoff(30000, POLL_INTERVAL), 60000);
    assert.equal(nextBackoff(60000, POLL_INTERVAL), 120000);
    assert.equal(nextBackoff(120000, POLL_INTERVAL), 240000);
  });

  test("caps at 5 minutes", () => {
    assert.equal(nextBackoff(240000, POLL_INTERVAL), BACKOFF_CAP_MS);
    assert.equal(nextBackoff(BACKOFF_CAP_MS, POLL_INTERVAL), BACKOFF_CAP_MS);
    assert.equal(nextBackoff(BACKOFF_CAP_MS * 10, POLL_INTERVAL), BACKOFF_CAP_MS);
  });

  test("growth sequence from cold start reaches cap in 5 steps", () => {
    let backoff = 0;
    const sequence = [];
    for (let i = 0; i < 6; i++) {
      backoff = nextBackoff(backoff, POLL_INTERVAL);
      sequence.push(backoff);
    }
    assert.deepEqual(sequence, [30000, 60000, 120000, 240000, 300000, 300000]);
  });
});

describe("computePollDelay", () => {
  test("returns the poll interval unchanged when not backing off", () => {
    assert.equal(computePollDelay(0, POLL_INTERVAL), POLL_INTERVAL);
    assert.equal(computePollDelay(undefined, POLL_INTERVAL), POLL_INTERVAL);
  });

  test("applies no jitter when random source returns midpoint", () => {
    assert.equal(computePollDelay(60000, POLL_INTERVAL, () => 0.5), 60000);
  });

  test("jitter spans exactly ±20% of the backoff", () => {
    assert.equal(computePollDelay(60000, POLL_INTERVAL, () => 0), 48000);
    assert.equal(computePollDelay(60000, POLL_INTERVAL, () => 1), 72000);
  });

  test("delay always stays within ±20% bounds with real randomness", () => {
    for (let i = 0; i < 1000; i++) {
      const delay = computePollDelay(60000, POLL_INTERVAL);
      assert.ok(delay >= 48000, `delay ${delay} below -20% bound`);
      assert.ok(delay <= 72000, `delay ${delay} above +20% bound`);
    }
  });

  test("returns an integer (setTimeout-safe)", () => {
    const delay = computePollDelay(33333, POLL_INTERVAL, () => 0.123);
    assert.equal(delay, Math.round(delay));
  });
});
