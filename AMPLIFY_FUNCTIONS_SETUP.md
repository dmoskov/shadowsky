# Amplify Functions Setup - Alt Text Generation

## Overview

The alt-text generation feature now uses **Amplify Functions** (serverless), keeping everything in one deployment. No separate backend server needed!

## Architecture

- **Frontend:** Static React app (Vite build)
- **Backend:** Amplify Function at `/api/generate-alt-text`
- **Development:** Vite proxy routes `/api/*` to `localhost:3002` (Express server in `server/`)
- **Production:** Amplify routes `/api/*` to serverless function

## Files Created

```
amplify/
└── functions/
    └── generate-alt-text/
        ├── handler.js        # Lambda function code
        └── package.json      # Dependencies
```

## Setup Steps in Amplify Console

### 1. Enable Amplify Compute

In the Amplify Console:
1. Go to your app → **Hosting → Compute**
2. Enable **Server-side rendering and Compute** (if not already enabled)
3. This allows the `compute:` section in `amplify.yml` to work

### 2. Add Environment Variable

1. Go to **Environment variables**
2. Add secret:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...your-key...`
   - Mark as **Secret** ✓

### 3. Deploy

Push your changes:
```bash
git add .
git commit -m "Add Amplify function for alt-text generation"
git push
```

Amplify will:
1. Build your frontend
2. Deploy the serverless function
3. Route `/api/generate-alt-text` to the function

### 4. Test

Once deployed, test in production:
1. Open browser DevTools → Console
2. Upload an image in composer
3. Click "Generate alt text"
4. Should work without CORS errors!

## Local Development

For local development, you still need the Express server:

```bash
# Terminal 1: Start backend server
cd server
npm install
npm run dev

# Terminal 2: Start frontend
npm run dev
```

The Vite dev server (port 5174) proxies `/api/*` requests to the Express server (port 3002).

## How It Works

### Development Mode
```
Browser → http://localhost:5174/api/generate-alt-text
         ↓ (Vite proxy)
         → http://localhost:3002/api/generate-alt-text (Express)
```

### Production Mode
```
Browser → https://shadowsky.io/api/generate-alt-text
         ↓ (Amplify routing)
         → Lambda function (amplify/functions/generate-alt-text)
```

## Why This Approach?

**Q: Why not put the API key in the frontend?**
A: Security! The API key would be visible in browser DevTools and your bundled JS files.

**Q: Why use Amplify Functions instead of a separate server?**
A: Simplicity! Everything deploys together, no separate infrastructure to manage.

**Q: Can I still use the Express server in production?**
A: Yes, but it requires separate deployment. Amplify Functions are easier for your use case.

## Troubleshooting

### Function not deploying
- Check Amplify build logs for errors in the Compute section
- Verify `amplify.yml` syntax is correct
- Ensure `amplify/functions/` directory exists in your repo

### ANTHROPIC_API_KEY not found
- Check environment variables in Amplify Console
- Make sure it's marked as a secret
- Redeploy after adding the variable

### 404 on /api/generate-alt-text
- Verify Amplify Compute is enabled
- Check that the function deployed successfully in build logs
- Try clearing cache and redeploying

### Still getting CORS errors
- Remove `api.shadowsky.io` from Amplify custom domains if you added it
- The function should be on the same domain as your frontend
- Check browser console for the actual error message

## Cost

Amplify Functions pricing:
- **Free tier:** 1 million requests/month, 400,000 GB-seconds compute
- **After free tier:** $0.20 per million requests

Your current usage should stay well within free tier limits.
