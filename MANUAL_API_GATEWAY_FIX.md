# Manual Fix for analyze-posts CORS Errors

## Problem

The `/api/analyze-posts` Lambda function exists in code but hasn't been deployed to AWS yet due to TypeScript errors in other Lambda functions blocking the entire backend deployment.

## Quick Solution: Deploy Just This Lambda

### Step 1: Create the Lambda Function

1. Go to AWS Lambda Console: https://console.aws.amazon.com/lambda/
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: `shadowsky-analyze-posts`
5. Runtime: `Node.js 20.x`
6. Click "Create function"

### Step 2: Add the Code

Copy the handler code from `amplify/functions/analyze-posts/handler.ts`:

```typescript
// Paste the entire contents of amplify/functions/analyze-posts/handler.ts
```

### Step 3: Add Environment Variable

1. In the Lambda function, go to "Configuration" → "Environment variables"
2. Add variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `YOUR_ANTHROPIC_API_KEY`

### Step 4: Configure Timeout and Memory

1. Go to "Configuration" → "General configuration"
2. Set:
   - Memory: 1024 MB
   - Timeout: 60 seconds

### Step 5: Add to API Gateway

1. Go to API Gateway Console: https://console.aws.amazon.com/apigateway/
2. Find your API: `shadowsky-api`
3. Click on `/api` resource (or create it if it doesn't exist)
4. Click "Create Resource"
   - Resource name: `analyze-posts`
   - Resource path: `analyze-posts`
5. Click "Create Method" → POST
6. Integration type: Lambda Function
7. Lambda function: Select `shadowsky-analyze-posts`
8. Click "Create method"

### Step 6: Enable CORS

1. Click on the `/api/analyze-posts` resource
2. Click "Enable CORS"
3. Access-Control-Allow-Origin: `https://main.shadowsky.io`
4. Access-Control-Allow-Headers: `Content-Type,Authorization`
5. Access-Control-Allow-Methods: `POST,OPTIONS`
6. Click "Save"

### Step 7: Deploy the API

1. Click "Deploy API"
2. Stage: `prod`
3. Click "Deploy"

### Step 8: Test

Go to https://main.shadowsky.io/analytics and try the AI analysis feature. The CORS errors should be gone!

## Alternative: Use the Express Server Temporarily

Until the Amplify backend is fixed, you could deploy the Express server from `server/api-server.js` to handle this endpoint. See `server/DEPLOYMENT.md` for instructions.
