# Security Fix: API Key Protection

## Problem Fixed
The Anthropic API key was exposed in the browser (client-side) with `dangerouslyAllowBrowser: true`, allowing anyone to steal it from DevTools and rack up charges on your account.

## Solution Implemented
Moved all AI features to **backend Amplify Functions** (serverless), keeping the API key secure on the server.

## Changes Made

### 1. Removed Client-Side Anthropic SDK
- ❌ Removed `@anthropic-ai/sdk` from `package.json`
- ❌ Removed `dangerouslyAllowBrowser: true` from `anthropic.ts`
- ✅ API key now stays server-side only

### 2. Created Amplify Functions
Created 5 serverless functions in `amplify/functions/`:

1. **generate-alt-text/** - Generate image alt text
2. **adjust-tone/** - Adjust text tone (professional, casual, etc.)
3. **optimize-thread/** - Optimize thread structure
4. **suggest-hashtags/** - Suggest relevant hashtags
5. **writing-feedback/** - Provide writing feedback

Each function:
- Runs on AWS Lambda (serverless)
- Keeps API key secure
- Has proper CORS configuration
- Returns JSON responses

### 3. Updated Frontend Code
Updated `src/services/anthropic.ts` to call backend APIs:

**Before (INSECURE):**
```typescript
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, // ❌ Exposed in browser!
  dangerouslyAllowBrowser: true,
});
```

**After (SECURE):**
```typescript
const response = await fetch("/api/adjust-tone", {
  method: "POST",
  body: JSON.stringify({ text, tone }),
});
```

### 4. Updated Amplify Configuration
Updated `amplify.yml` with 5 compute functions:
- Each endpoint routes to its Lambda function
- All functions have access to `ANTHROPIC_API_KEY` secret
- Runtime: Node.js 20.x

### 5. Development vs Production

**Development Mode:**
```
Browser → http://localhost:5174/api/adjust-tone
         ↓ (Vite proxy - vite.config.ts:72-75)
         → http://localhost:3002/api/adjust-tone (Express server)
```

**Production Mode:**
```
Browser → https://shadowsky.io/api/adjust-tone
         ↓ (Amplify routing from amplify.yml)
         → Lambda function (amplify/functions/adjust-tone)
```

## Deployment Steps

### 1. Remove OLD API Subdomain
- Remove `api.shadowsky.io` from Amplify custom domains (if you added it)
- All API endpoints now run on same domain as frontend

### 2. Enable Amplify Compute
In Amplify Console:
1. Go to **Hosting → Compute**
2. Enable **Server-side rendering and Compute**

### 3. Add Environment Variable
In Amplify Console → Environment variables:
- Key: `ANTHROPIC_API_KEY`
- Value: `sk-ant-...your-key...`
- Mark as **Secret** ✓

### 4. Deploy
```bash
git add .
git commit -m "fix: move AI features to secure backend endpoints"
git push
```

Amplify will:
1. Build frontend
2. Deploy Lambda functions
3. Route `/api/*` to functions

### 5. Test
Once deployed:
1. Open production site
2. Try tone adjustment feature
3. Check DevTools → Network tab
4. Should see `/api/adjust-tone` call succeed
5. API key is NOT visible anywhere!

## Security Benefits

✅ **API key is server-side only** - Never sent to browser
✅ **No CORS issues** - Same-origin requests
✅ **Serverless** - Auto-scales, pay per use
✅ **Free tier** - 1M requests/month included
✅ **No separate deployment** - All in one Amplify app

## Development Workflow

For local development, continue running the Express server:

```bash
# Terminal 1: Backend
cd server
npm install
npm run dev

# Terminal 2: Frontend
npm run dev
```

The Vite proxy (`vite.config.ts:72-75`) routes `/api/*` to `localhost:3002`.

## Cost

**Amplify Functions:**
- Free tier: 1M requests/month, 400K GB-seconds compute
- After: $0.20 per million requests

Your current usage should stay within free tier.

## Files Changed

### Created:
- `amplify/functions/generate-alt-text/handler.js`
- `amplify/functions/adjust-tone/handler.js`
- `amplify/functions/optimize-thread/handler.js`
- `amplify/functions/suggest-hashtags/handler.js`
- `amplify/functions/writing-feedback/handler.js`
- `AMPLIFY_FUNCTIONS_SETUP.md`
- `server/DEPLOYMENT.md`
- `SECURITY_FIX_SUMMARY.md` (this file)

### Modified:
- `amplify.yml` - Added compute section with 5 functions
- `src/services/anthropic.ts` - Updated all functions to call backend APIs
- `package.json` - Removed `@anthropic-ai/sdk` dependency
- `server/api-server.js` - Fixed CORS configuration

## Verification

After deployment, verify security:

1. **Open DevTools** → Application → Local Storage
2. **Search for** "ANTHROPIC" or "sk-ant"
3. **Should find**: Nothing! ✅

4. **Open DevTools** → Sources
5. **Search** all JS files for "sk-ant"
6. **Should find**: Nothing! ✅

7. **Open DevTools** → Network
8. **Use a feature** (e.g., tone adjustment)
9. **Check request headers** - No API key sent!
10. **Check response** - Feature works! ✅

## Troubleshooting

### Functions not deploying
- Check Amplify build logs for Compute section errors
- Verify `amplify/functions/` directory is in your repo
- Ensure Amplify Compute is enabled

### ANTHROPIC_API_KEY not found
- Check environment variables in Amplify Console
- Redeploy after adding the variable
- Make sure it's marked as "Secret"

### Still seeing API key in browser
- Clear browser cache
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
- Check you're on the latest deployment

## Next Steps

1. ✅ Deploy the changes
2. ✅ Remove `VITE_ANTHROPIC_API_KEY` from your `.env` files (no longer needed!)
3. ✅ Verify security in production
4. ✅ Celebrate secure code! 🎉
