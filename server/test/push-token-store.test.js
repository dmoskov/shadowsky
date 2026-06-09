const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  InMemoryPushTokenStore,
  toItem,
  fromItem,
} = require("../utils/push-token-store");

describe("InMemoryPushTokenStore", () => {
  test("set/get/delete/list/count round-trip", async () => {
    const store = new InMemoryPushTokenStore();
    const record = {
      did: "did:plc:abc",
      handle: "user.bsky.social",
      pushToken: "tok123",
      platform: "ios",
      registeredAt: "2026-06-09T00:00:00.000Z",
      updatedAt: "2026-06-09T00:00:00.000Z",
    };

    assert.equal(await store.get("did:plc:abc"), null);
    assert.equal(await store.count(), 0);

    await store.set("did:plc:abc", record);
    assert.deepEqual(await store.get("did:plc:abc"), record);
    assert.equal(await store.count(), 1);
    assert.deepEqual(await store.list(), [record]);

    assert.equal(await store.delete("did:plc:abc"), true);
    assert.equal(await store.delete("did:plc:abc"), false);
    assert.equal(await store.count(), 0);
  });
});

describe("DynamoDB marshalling", () => {
  test("toItem/fromItem round-trip a flat record", () => {
    const record = {
      did: "did:plc:abc",
      handle: "user.bsky.social",
      pushToken: "tok123",
    };
    assert.deepEqual(fromItem(toItem(record)), record);
  });

  test("toItem drops undefined and null fields", () => {
    const item = toItem({
      did: "did:plc:abc",
      handle: undefined,
      deviceId: null,
    });
    assert.deepEqual(Object.keys(item), ["did"]);
  });
});
