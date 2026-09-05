/**
 * Anthropic Credential Factory
 *
 * Resolves the bearer token for Claude API calls, in priority order:
 * 1. ANTHROPIC_API_KEY env var (local dev)
 * 2. Workload Identity Federation (keyless production auth)
 * 3. Fails loudly if neither is configured
 *
 * Federation flow (https://platform.claude.com/docs/en/manage-claude/wif-providers/aws):
 *   1. Ask AWS STS for an OIDC token that asserts this task's IAM role
 *      (GetWebIdentityToken, audience https://api.anthropic.com). Uses the
 *      task's ambient credentials; requires sts:GetWebIdentityToken on the
 *      task role and outbound web identity federation enabled on the account.
 *   2. Exchange it at POST /v1/oauth/token (RFC 7523 jwt-bearer grant) for a
 *      short-lived sk-ant-oat01-... access token bound to the federation
 *      rule's service account.
 *   3. Cache the access token and re-run the exchange before it expires. A
 *      fresh STS token is minted for every exchange: STS tokens carry a jti
 *      and Anthropic accepts each one only once.
 *
 * Whatever this returns is sent as `Authorization: Bearer <token>`; that
 * header accepts both API keys and federated access tokens.
 */

const { STSClient, GetWebIdentityTokenCommand } = require("@aws-sdk/client-sts");
const fetch = require("node-fetch");

const FEDERATION_ENV_VARS = [
  "ANTHROPIC_FEDERATION_RULE_ID",
  "ANTHROPIC_ORGANIZATION_ID",
  "ANTHROPIC_SERVICE_ACCOUNT_ID",
];

const TOKEN_ENDPOINT = "https://api.anthropic.com/v1/oauth/token";
const STS_AUDIENCE = "https://api.anthropic.com";
// STS token lifetime. Anthropic caps the minted token at 2x the remaining
// life of the assertion, so keep this comfortably above the rule's lifetime.
const STS_TOKEN_SECONDS = 900;
// Re-exchange this long before the access token expires.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

/** @type {{ token: string, expiresAt: number } | null} */
let cached = null;
/** @type {Promise<string> | null} */
let inflight = null;

/**
 * Check whether Anthropic credentials are available (sync, no I/O).
 */
function anthropicAvailable() {
  if (process.env.ANTHROPIC_API_KEY) return true;
  return FEDERATION_ENV_VARS.every((v) => !!process.env[v]);
}

/**
 * Human-readable auth mode for the startup log.
 */
function anthropicAuthMode() {
  if (process.env.ANTHROPIC_API_KEY) return "static key";
  if (anthropicAvailable()) return "federation";
  return "not configured";
}

/**
 * Resolve a bearer token for the Claude API. Returns the static key when
 * ANTHROPIC_API_KEY is set; otherwise performs (or reuses) a Workload
 * Identity Federation exchange.
 *
 * @param {Object} [deps] - Test overrides
 * @param {(params: { audience: string, durationSeconds: number }) => Promise<string>} [deps.getIdentityToken]
 * @param {typeof fetch} [deps.fetch]
 * @param {() => number} [deps.now]
 * @returns {Promise<string>}
 */
async function getAnthropicApiKey(deps = {}) {
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  const missing = FEDERATION_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Anthropic API not configured: set ANTHROPIC_API_KEY or all of ${FEDERATION_ENV_VARS.join(", ")} (missing: ${missing.join(", ")})`,
    );
  }

  const now = deps.now || Date.now;
  if (cached && now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return cached.token;
  }

  if (!inflight) {
    inflight = exchangeFederationToken(deps)
      .then((result) => {
        cached = result;
        return result.token;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cached token (tests). */
function resetAnthropicCredentialCache() {
  cached = null;
  inflight = null;
}

// ---------------------------------------------------------------------------
// Federation exchange
// ---------------------------------------------------------------------------

/**
 * @param {Parameters<typeof getAnthropicApiKey>[0]} deps
 * @returns {Promise<{ token: string, expiresAt: number }>}
 */
async function exchangeFederationToken(deps) {
  const getIdentityToken = deps.getIdentityToken || getStsWebIdentityToken;
  const doFetch = deps.fetch || fetch;
  const now = deps.now || Date.now;

  const assertion = await getIdentityToken({
    audience: STS_AUDIENCE,
    durationSeconds: STS_TOKEN_SECONDS,
  });

  const body = {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
    federation_rule_id: process.env.ANTHROPIC_FEDERATION_RULE_ID,
    organization_id: process.env.ANTHROPIC_ORGANIZATION_ID,
    service_account_id: process.env.ANTHROPIC_SERVICE_ACCOUNT_ID,
  };
  // Only needed when the rule spans several workspaces; harmless otherwise.
  if (process.env.ANTHROPIC_WORKSPACE_ID) {
    body.workspace_id = process.env.ANTHROPIC_WORKSPACE_ID;
  }

  const response = await doFetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    // Anthropic deliberately returns an opaque 401 for every assertion
    // denial; the real reason is in Console → Workload identity → History.
    throw new Error(
      `Anthropic federation token exchange failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  /** @type {{ access_token?: string, expires_in?: number }} */
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Federation token exchange returned non-JSON: ${text.slice(0, 300)}`);
  }
  if (!data.access_token) {
    throw new Error(`Federation token exchange returned no access_token: ${text.slice(0, 300)}`);
  }

  const expiresIn = Number(data.expires_in) || 600;
  return { token: data.access_token, expiresAt: now() + expiresIn * 1000 };
}

let stsClient = null;

/**
 * Mint an AWS-signed OIDC token asserting the caller's IAM role.
 * GetWebIdentityToken exists only on regional STS endpoints, so the client
 * is pinned to a region.
 *
 * @param {{ audience: string, durationSeconds: number }} params
 * @returns {Promise<string>}
 */
async function getStsWebIdentityToken({ audience, durationSeconds }) {
  if (!stsClient) {
    stsClient = new STSClient({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    });
  }
  const out = await stsClient.send(
    new GetWebIdentityTokenCommand({
      Audience: [audience],
      SigningAlgorithm: "RS256",
      DurationSeconds: durationSeconds,
    }),
  );
  if (!out.WebIdentityToken) {
    throw new Error("STS GetWebIdentityToken returned no token");
  }
  return out.WebIdentityToken;
}

module.exports = {
  FEDERATION_ENV_VARS,
  STS_AUDIENCE,
  anthropicAvailable,
  anthropicAuthMode,
  getAnthropicApiKey,
  resetAnthropicCredentialCache,
};
