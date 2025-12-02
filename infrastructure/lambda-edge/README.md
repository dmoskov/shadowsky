# Lambda@Edge for ShadowSky OG Meta Tags

This Lambda@Edge function provides dynamic Open Graph meta tags for social media link previews.

## How It Works

When a crawler (Discord, Slack, Twitter, etc.) requests a thread or profile URL:
1. The Lambda@Edge function intercepts the request at CloudFront
2. It detects the crawler via User-Agent
3. Fetches post/profile data from the Bluesky API
4. Returns HTML with proper OG meta tags

For regular users, requests pass through to the SPA normally.

## Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 20+
- CDK CLI (`npm install -g aws-cdk`)

### Steps

1. **Install dependencies:**
   ```bash
   cd infrastructure/lambda-edge
   npm install
   ```

2. **Build the Lambda function:**
   ```bash
   npm run build
   ```

3. **Deploy to us-east-1 (required for Lambda@Edge):**
   ```bash
   npm run deploy
   ```

4. **Note the Lambda Version ARN** from the deployment output

5. **Attach to Amplify CloudFront Distribution:**
   - Go to AWS Console → CloudFront
   - Find your Amplify distribution (check Amplify Console → Hosting → Domain)
   - Create a new behavior or edit the default behavior
   - Under "Function associations":
     - Event type: **Viewer Request**
     - Function type: **Lambda@Edge**
     - Function ARN: Use the version ARN from step 4

## API Gateway Alternative

If you can't configure Lambda@Edge on the Amplify CloudFront distribution, use the API Gateway endpoint instead:

**Share URLs:**
- Thread: `https://[api-gateway-url]/og/thread/{handle}/{postId}`
- Profile: `https://[api-gateway-url]/og/profile/{handle}`

These endpoints return HTML with OG tags for crawlers and redirect browsers to the main site.

## Supported Crawlers

- Twitter/X (Twitterbot)
- Facebook (facebookexternalhit)
- Discord (Discordbot)
- Slack (Slackbot)
- LinkedIn (LinkedInBot)
- WhatsApp
- Telegram (TelegramBot)
- Google (Googlebot)
- Bing (bingbot)
- Pinterest
- Reddit (redditbot)
- And more...

## Testing

Test with curl using a crawler User-Agent:
```bash
# Test thread OG tags
curl -H "User-Agent: Discordbot" "https://your-api-url/og/thread/handle/postId"

# Test profile OG tags
curl -H "User-Agent: Twitterbot" "https://your-api-url/og/profile/handle"
```

## OG Tags Generated

### For Threads
- `og:title` - Author name and handle
- `og:description` - Post text (truncated)
- `og:image` - Post image or author avatar
- `og:url` - Canonical URL
- `twitter:card` - summary_large_image if post has images

### For Profiles
- `og:title` - Display name and handle
- `og:description` - Bio or follower/post counts
- `og:image` - Profile avatar
- `og:url` - Canonical URL
- `twitter:card` - summary
