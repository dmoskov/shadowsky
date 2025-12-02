# AWS Amplify WebSocket Configuration Guide

This guide explains how to configure the AWS Amplify Console to control WebSocket availability in different environments.

## Overview

The application uses the `VITE_WS_URL` environment variable to determine if WebSockets should be enabled:

- **Variable Set**: WebSockets are ENABLED (use for Sandbox)
- **Variable Unset**: WebSockets are DISABLED (use for Production)

## Configuration Steps

### 1. Access Amplify Console

1. Log in to the AWS Console.
2. Navigate to **AWS Amplify**.
3. Select your application (`BSKY` or similar).

### 2. Configure Production (Disable WebSockets)

1. In the left sidebar, click on **Environment variables**.
2. Look for `VITE_WS_URL`.
3. If it exists for the `main` (or production) branch:
   - Click **Manage variables**.
   - Locate the `VITE_WS_URL` entry.
   - **Remove** the value for the production branch or delete the variable entirely if it's not needed for any other environment.
   - Click **Save**.

### 3. Configure Sandbox (Enable WebSockets)

1. In the **Environment variables** section.
2. Ensure `VITE_WS_URL` is set for your sandbox branch (e.g., `dev` or `sandbox`).
3. Set the value to your WebSocket server URL.
   - Example: `wss://your-sandbox-websocket-url.com`
   - Note: If using a local backend with a tunnel, use that URL.

## Verification

### Production

After redeploying production:

1. Open the application in a browser.
2. Open Developer Tools (F12) -> Console.
3. You should see: `🔌 [WebSocket] VITE_WS_URL not configured, WebSocket disabled`

### Sandbox

After redeploying sandbox:

1. Open the application in a browser.
2. Open Developer Tools (F12) -> Console.
3. You should see: `🔌 [WebSocket] Initializing service` and `✅ [WebSocket] Connected`
