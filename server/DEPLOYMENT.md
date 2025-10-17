# Backend API Server Deployment Guide

## Current Issue
The backend API server (`server/api-server.js`) needs to be deployed to `api.shadowsky.io` separately from your Amplify frontend.

## Quick Fix Options

### Option 1: Railway.app (Easiest - Free Tier)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Initialize:**
   ```bash
   cd server
   railway login
   railway init
   ```

3. **Add Environment Variables:**
   ```bash
   railway variables set ANTHROPIC_API_KEY="your-key-here"
   railway variables set NODE_ENV=production
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Add Custom Domain:**
   - Go to Railway dashboard → Settings → Domains
   - Add custom domain: `api.shadowsky.io`
   - Railway will give you a CNAME record
   - Add this CNAME to your DNS:
     ```
     api.shadowsky.io → CNAME → your-project.railway.app
     ```

### Option 2: Render.com (Free Tier)

1. **Go to https://render.com**
2. **Create New Web Service**
3. **Connect GitHub repo**
4. **Configure:**
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
   - Environment Variables:
     - `ANTHROPIC_API_KEY`: your-key
     - `NODE_ENV`: production

5. **Add Custom Domain:**
   - Go to Settings → Custom Domain
   - Add `api.shadowsky.io`
   - Add the CNAME record to your DNS

### Option 3: Fly.io (Free Tier)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login and Launch:**
   ```bash
   cd server
   fly auth login
   fly launch
   ```

3. **Set Secrets:**
   ```bash
   fly secrets set ANTHROPIC_API_KEY="your-key-here"
   ```

4. **Add Custom Domain:**
   ```bash
   fly certs create api.shadowsky.io
   ```

## DNS Configuration (After Deployment)

Once you deploy to any service above, update your DNS:

**In your domain registrar (e.g., Cloudflare, Route53, Namecheap):**

```
Type:  CNAME
Name:  api
Value: your-service.railway.app (or render.com or fly.io)
TTL:   Auto or 300
```

**Important:** Remove `api.shadowsky.io` from Amplify if you added it there!

## Environment Variables Required

Make sure these are set on your deployment platform:

```env
ANTHROPIC_API_KEY=sk-ant-...your-key...
NODE_ENV=production
PORT=3002
```

## Verify Deployment

Once deployed, test the endpoint:

```bash
curl https://api.shadowsky.io/api/generate-alt-text \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"data:image/png;base64,iVBORw0KGg..."}'
```

Should return: `{"altText":"..."}`

## Troubleshooting

### CORS errors persist
1. Make sure you deployed the updated `api-server.js` with new CORS config
2. Check browser console for actual origin being sent
3. Verify `shadowsky.io` is in the allowed origins

### SSL certificate issues
- Give DNS propagation 5-15 minutes
- Most platforms auto-provision Let's Encrypt certificates
- Check certificate status in platform dashboard

### 502/503 errors
- Check logs on your deployment platform
- Verify `ANTHROPIC_API_KEY` is set
- Ensure server is listening on correct PORT

## Cost Estimates

- **Railway:** Free tier (500hrs/month, $5/month after)
- **Render:** Free tier (750hrs/month)
- **Fly.io:** Free tier (3 shared VMs)

All should handle your current traffic for free.
