# AWS Deployment Guide for ShadowSky

## Option 1: AWS Amplify (Recommended - Easiest)

AWS Amplify is the simplest way to deploy a React SPA on AWS. It handles everything automatically including:
- CI/CD from GitHub
- HTTPS/SSL certificates
- CloudFront CDN distribution
- Proper SPA routing (no 404 issues!)
- Preview deployments for branches

### Steps:

1. **Go to AWS Amplify Console**
   - https://console.aws.amazon.com/amplify/
   - Click "New app" → "Host web app"

2. **Connect your GitHub repository**
   - Choose GitHub as the source
   - Authorize AWS to access your GitHub
   - Select the `dmoskov/shadowsky` repository
   - Select the `main` branch

3. **Configure build settings**
   - Amplify should auto-detect Vite, but verify the build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: dist
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

4. **Add redirect rules for SPA**
   - In the Amplify console, go to "Rewrites and redirects"
   - Add this rule:
   ```
   Source: </^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json)$)([^.]+$)/>
   Target: /index.html
   Type: 200 (Rewrite)
   ```

5. **Environment variables**
   - Add any env variables (like `VITE_GA_MEASUREMENT_ID`) in the Environment variables section

6. **Custom domain**
   - Go to "Domain management"
   - Add `shadowsky.io`
   - Follow the DNS configuration instructions

### Total time: ~15-20 minutes
### Cost: ~$0.01 per GB served (very cheap for most apps)

---

## Option 2: S3 + CloudFront (More Control)

This gives you more control but requires more setup.

### Prerequisites:
- AWS CLI installed: `brew install awscli`
- Configure AWS CLI: `aws configure`

### Steps:

1. **Create S3 bucket**
   ```bash
   # Create bucket (use a unique name)
   aws s3 mb s3://shadowsky-app

   # Enable static website hosting
   aws s3 website s3://shadowsky-app \
     --index-document index.html \
     --error-document index.html
   ```

2. **Update bucket policy** 
   Create `bucket-policy.json`:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::shadowsky-app/*"
       }
     ]
   }
   ```
   Apply it:
   ```bash
   aws s3api put-bucket-policy \
     --bucket shadowsky-app \
     --policy file://bucket-policy.json
   ```

3. **Build and deploy script**
   Create `deploy-aws.sh`:
   ```bash
   #!/bin/bash
   
   # Build the app
   npm run build
   
   # Sync to S3
   aws s3 sync dist/ s3://shadowsky-app \
     --delete \
     --cache-control "public, max-age=31536000" \
     --exclude "index.html" \
     --exclude "*.json"
   
   # Upload index.html and JSON files with no cache
   aws s3 cp dist/index.html s3://shadowsky-app/index.html \
     --cache-control "no-cache, no-store, must-revalidate"
   
   aws s3 cp dist/ s3://shadowsky-app/ \
     --recursive \
     --exclude "*" \
     --include "*.json" \
     --cache-control "no-cache, no-store, must-revalidate"
   
   # Copy index.html to handle client-side routing
   aws s3 cp dist/index.html s3://shadowsky-app/error.html
   
   echo "✅ Deployed to S3!"
   ```

4. **Create CloudFront distribution**
   ```bash
   aws cloudfront create-distribution \
     --origin-domain-name shadowsky-app.s3-website-us-east-1.amazonaws.com \
     --default-root-object index.html
   ```

5. **Configure CloudFront for SPA**
   - In CloudFront console, edit the distribution
   - Go to "Error pages"
   - Create custom error response:
     - HTTP Error Code: 403
     - Response Page Path: `/index.html`
     - HTTP Response Code: 200
   - Repeat for 404 errors

6. **Add custom domain**
   - Request ACM certificate for shadowsky.io
   - Add alternate domain names (CNAME) in CloudFront
   - Update DNS to point to CloudFront distribution

### Deployment command:
```bash
chmod +x deploy-aws.sh
./deploy-aws.sh
```

---

## Option 3: AWS Amplify CLI (Automated but more complex)

If you want infrastructure as code:

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize
amplify init

# Add hosting
amplify add hosting
# Choose: Hosting with Amplify Console
# Choose: Manual deployment

# Publish
amplify publish
```

---

## Comparison

| Feature | Amplify Console | S3 + CloudFront | GitHub Pages |
|---------|----------------|-----------------|--------------|
| Setup Time | 15 min | 45 min | 5 min |
| SPA Routing | ✅ Perfect | ✅ Good | ❌ Hacky |
| HTTPS | ✅ Automatic | ✅ Manual | ✅ Automatic |
| Custom Domain | ✅ Easy | ✅ Manual | ✅ Easy |
| CI/CD | ✅ Built-in | ❌ Need GitHub Actions | ✅ Built-in |
| Cost | ~$1-5/month | ~$1-5/month | Free |
| Performance | ⚡ Excellent | ⚡ Excellent | ⚡ Good |
| Preview Deploys | ✅ Yes | ❌ No | ❌ No |

---

## My Recommendation

**Go with AWS Amplify Console** (Option 1) because:
- It's specifically designed for SPAs like yours
- Handles all the routing issues automatically  
- Gives you preview deployments for testing
- Still very cheap (you'll probably stay in free tier)
- Can be set up in 15 minutes tomorrow
- Easy to migrate away if needed

The only reason to choose S3+CloudFront is if you need very specific control over caching or routing rules.

---

## Before You Start Tomorrow

1. Make sure you have an AWS account
2. Have your domain registrar login ready (for DNS changes)
3. Commit the loading state changes we made:

```bash
git add -A
git commit -m "feat: add loading state for better UX on page reload"
git push
```

Good luck with the migration! The app should work much better on AWS than GitHub Pages.