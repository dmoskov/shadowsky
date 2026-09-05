/**
 * Anthropic Credential Factory (Lambda)
 *
 * Resolves Anthropic API credentials in priority order:
 * 1. ANTHROPIC_API_KEY env var (local dev, or pre-federation deployments)
 * 2. Workload Identity Federation (keyless production auth via AWS IAM)
 * 3. Fails loudly if neither is configured
 *
 * Federation flow: sign an STS GetCallerIdentity request with the Lambda
 * execution role, POST the signed proof to Anthropic's token endpoint,
 * cache the temporary API key until near-expiry.
 */

import * as crypto from 'crypto';
import * as https from 'https';

const FEDERATION_ENV_VARS = [
  'ANTHROPIC_FEDERATION_RULE_ID',
  'ANTHROPIC_ORGANIZATION_ID',
  'ANTHROPIC_SERVICE_ACCOUNT_ID',
  'ANTHROPIC_WORKSPACE_ID',
] as const;

const TOKEN_ENDPOINT = 'https://api.anthropic.com/v1/auth/workload-identity-token';
const CACHE_MARGIN_MS = 5 * 60 * 1000;

let _cachedApiKey: string | null = null;
let _cacheExpiry = 0;

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

interface SignedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

interface TokenResponse {
  api_key: string;
  expires_in?: number;
}

export function anthropicAvailable(): boolean {
  if (process.env.ANTHROPIC_API_KEY) return true;
  return FEDERATION_ENV_VARS.every((v) => !!process.env[v]);
}

export async function getAnthropicApiKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  const missing = FEDERATION_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Anthropic API not configured: set ANTHROPIC_API_KEY or all of ${FEDERATION_ENV_VARS.join(', ')} (missing: ${missing.join(', ')})`
    );
  }

  if (_cachedApiKey && Date.now() < _cacheExpiry) {
    return _cachedApiKey;
  }

  const result = await exchangeFederationToken();
  _cachedApiKey = result.api_key;
  _cacheExpiry = Date.now() + (result.expires_in || 3600) * 1000 - CACHE_MARGIN_MS;
  return _cachedApiKey;
}

// ---------------------------------------------------------------------------
// Federation token exchange
// ---------------------------------------------------------------------------

async function exchangeFederationToken(): Promise<TokenResponse> {
  const signedRequest = await createSignedGetCallerIdentityRequest();

  const body = JSON.stringify({
    federation_rule_id: process.env.ANTHROPIC_FEDERATION_RULE_ID,
    organization_id: process.env.ANTHROPIC_ORGANIZATION_ID,
    service_account_id: process.env.ANTHROPIC_SERVICE_ACCOUNT_ID,
    workspace_id: process.env.ANTHROPIC_WORKSPACE_ID,
    aws_sts_request: signedRequest,
  });

  const response = await httpsPost(TOKEN_ENDPOINT, body, {
    'content-type': 'application/json',
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `Federation token exchange failed (${response.statusCode}): ${response.body}`
    );
  }

  const data = JSON.parse(response.body) as TokenResponse;
  if (!data.api_key) {
    throw new Error('Federation token exchange returned no api_key: ' + response.body);
  }
  return data;
}

// ---------------------------------------------------------------------------
// AWS SigV4 signing (Node.js crypto only — no SDK dependency)
// ---------------------------------------------------------------------------

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

async function createSignedGetCallerIdentityRequest(): Promise<SignedRequest> {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const credentials = resolveAwsCredentials();

  const method = 'POST';
  const service = 'sts';
  const host = `sts.${region}.amazonaws.com`;
  const path = '/';
  const body = 'Action=GetCallerIdentity&Version=2011-06-15';
  const contentType = 'application/x-www-form-urlencoded';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const dateStamp = amzDate.slice(0, 8);

  const headerNames = ['content-type', 'host', 'x-amz-date'];
  const headerValues: Record<string, string> = {
    'content-type': contentType,
    'host': host,
    'x-amz-date': amzDate,
  };

  if (credentials.sessionToken) {
    headerNames.push('x-amz-security-token');
    headerValues['x-amz-security-token'] = credentials.sessionToken;
  }
  headerNames.sort();

  const canonicalHeaders = headerNames.map((h) => `${h}:${headerValues[h]}`).join('\n') + '\n';
  const signedHeaders = headerNames.join(';');
  const payloadHash = sha256(body);

  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join(
    '\n'
  );

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join(
    '\n'
  );

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, dateStamp), region), service),
    'aws4_request'
  );
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}${path}`,
    method,
    headers: { ...headerValues, authorization },
    body,
  };
}

// ---------------------------------------------------------------------------
// AWS credential resolution (Lambda runtime provides env vars)
// ---------------------------------------------------------------------------

function resolveAwsCredentials(): AwsCredentials {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
    };
  }
  throw new Error('No AWS credentials available for Anthropic federation token exchange');
}

// ---------------------------------------------------------------------------
// Minimal HTTPS helper
// ---------------------------------------------------------------------------

function httpsPost(
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: { ...headers, 'content-length': String(Buffer.byteLength(body)) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
