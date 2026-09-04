const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  SERVICE_AUTH_LXM,
  DEFAULT_SERVICE_DID,
  looksLikeServiceAuthToken,
  verifyServiceAuthToken,
} = require("../middleware/atproto-service-auth");
const { authenticateRequest } = require("../middleware/cognito-auth");

const USER_DID = "did:plc:testuser000000000000000";

/** Mint a service token the way a PDS would, signed by `keypair`. */
async function mintToken(keypair, overrides = {}) {
  const { createServiceJwt } = await import("@atproto/xrpc-server");
  return createServiceJwt({
    iss: USER_DID,
    aud: DEFAULT_SERVICE_DID,
    lxm: SERVICE_AUTH_LXM,
    keypair,
    ...overrides,
  });
}

/** Signing-key resolver that returns the test keypair's did:key. */
function resolverFor(keypair) {
  return async () => keypair.did();
}

describe("verifyServiceAuthToken", () => {
  let keypair;

  beforeEach(async () => {
    const { Secp256k1Keypair } = await import("@atproto/crypto");
    keypair = await Secp256k1Keypair.create();
  });

  test("accepts a token signed by the issuer's key for this service", async () => {
    const token = await mintToken(keypair);
    const result = await verifyServiceAuthToken(token, {
      getSigningKey: resolverFor(keypair),
    });
    assert.equal(result.did, USER_DID);
  });

  test("rejects a token minted for a different audience", async () => {
    const token = await mintToken(keypair, { aud: "did:web:other.example" });
    await assert.rejects(
      verifyServiceAuthToken(token, { getSigningKey: resolverFor(keypair) }),
      /audience/,
    );
  });

  test("rejects a token scoped to a different lexicon method", async () => {
    const token = await mintToken(keypair, { lxm: "app.bsky.feed.getFeed" });
    await assert.rejects(
      verifyServiceAuthToken(token, { getSigningKey: resolverFor(keypair) }),
      /lexicon method/,
    );
  });

  test("rejects an expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - 120;
    const token = await mintToken(keypair, { iat: past - 60, exp: past });
    await assert.rejects(
      verifyServiceAuthToken(token, { getSigningKey: resolverFor(keypair) }),
      /expired/,
    );
  });

  test("rejects a token whose signature does not match the issuer's key", async () => {
    const { Secp256k1Keypair } = await import("@atproto/crypto");
    const attacker = await Secp256k1Keypair.create();
    // Signed by the attacker, but the DID document says `keypair`.
    const token = await mintToken(attacker);
    await assert.rejects(
      verifyServiceAuthToken(token, { getSigningKey: resolverFor(keypair) }),
      /signature/,
    );
  });
});

describe("looksLikeServiceAuthToken", () => {
  test("is true for a JWT issued by a DID", async () => {
    const { Secp256k1Keypair } = await import("@atproto/crypto");
    const keypair = await Secp256k1Keypair.create();
    assert.equal(looksLikeServiceAuthToken(await mintToken(keypair)), true);
  });

  test("is false for a Cognito-style JWT and for garbage", () => {
    const cognito = [
      Buffer.from('{"alg":"RS256"}').toString("base64url"),
      Buffer.from(
        '{"iss":"https://cognito-idp.us-west-1.amazonaws.com/x","sub":"abc"}',
      ).toString("base64url"),
      "sig",
    ].join(".");
    assert.equal(looksLikeServiceAuthToken(cognito), false);
    assert.equal(looksLikeServiceAuthToken("not.a.jwt.at.all"), false);
    assert.equal(looksLikeServiceAuthToken("x.y.z"), false);
  });
});

describe("authenticateRequest", () => {
  const originalFlag = process.env.ALLOW_UNSIGNED_DID_AUTH;
  let keypair;

  beforeEach(async () => {
    const { Secp256k1Keypair } = await import("@atproto/crypto");
    keypair = await Secp256k1Keypair.create();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ALLOW_UNSIGNED_DID_AUTH;
    } else {
      process.env.ALLOW_UNSIGNED_DID_AUTH = originalFlag;
    }
  });

  test("authenticates a valid service-auth bearer token as the issuer DID", async () => {
    const token = await mintToken(keypair);
    const auth = await authenticateRequest(
      { headers: { authorization: `Bearer ${token}` } },
      { getSigningKey: resolverFor(keypair) },
    );
    assert.equal(auth.authenticated, true);
    assert.equal(auth.method, "did");
    assert.equal(auth.did, USER_DID);
    assert.equal(auth.unsigned, undefined);
  });

  test("does not fall back to the unsigned header when a bad token is presented", async () => {
    delete process.env.ALLOW_UNSIGNED_DID_AUTH;
    const { Secp256k1Keypair } = await import("@atproto/crypto");
    const attacker = await Secp256k1Keypair.create();
    const token = await mintToken(attacker);
    const auth = await authenticateRequest(
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-user-did": USER_DID,
        },
      },
      { getSigningKey: resolverFor(keypair) },
    );
    assert.equal(auth.authenticated, false);
    assert.match(auth.error, /Invalid service-auth token/);
  });

  test("honors the legacy unsigned header only while the flag allows it", async () => {
    delete process.env.ALLOW_UNSIGNED_DID_AUTH;
    const legacy = await authenticateRequest({
      headers: { "x-user-did": USER_DID },
      originalUrl: "/api/v1/writing-feedback",
    });
    assert.equal(legacy.authenticated, true);
    assert.equal(legacy.unsigned, true);

    process.env.ALLOW_UNSIGNED_DID_AUTH = "false";
    const rejected = await authenticateRequest({
      headers: { "x-user-did": USER_DID },
      originalUrl: "/api/v1/writing-feedback",
    });
    assert.equal(rejected.authenticated, false);
    assert.match(rejected.error, /no longer accepted/);
  });

  test("rejects requests with no credentials at all", async () => {
    const auth = await authenticateRequest({ headers: {} });
    assert.equal(auth.authenticated, false);
  });
});
