# Apple Developer Account Setup for Universal Links

This guide walks through creating an Apple Developer account and obtaining the credentials needed for Universal Links configuration.

## Prerequisites

- A valid Apple ID (create one at [appleid.apple.com](https://appleid.apple.com) if needed)
- $99 USD annual fee for Apple Developer Program membership
- A device capable of two-factor authentication

## Step 1: Enroll in Apple Developer Program

### 1.1 Start Enrollment

1. Go to [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll)
2. Click "Start Your Enrollment"
3. Sign in with your Apple ID

### 1.2 Choose Entity Type

Select one of the following:

- **Individual/Sole Proprietor**: For personal apps or single-person businesses
- **Organization**: For companies (requires D-U-N-S Number)

For ShadowSky, recommend **Organization** enrollment if you have a company entity.

### 1.3 Complete Enrollment

1. Fill in required information (name, address, phone)
2. For Organizations: Provide your D-U-N-S Number
   - Don't have one? Request free at [dnb.com/duns-number](https://www.dnb.com/duns-number.html) (takes 1-2 weeks)
3. Review and accept the Apple Developer Agreement
4. Pay the $99 annual fee

**Processing Time**: Individual enrollments typically complete within 24-48 hours. Organizations may take 2-4 weeks due to verification.

## Step 2: Find Your Team ID

Once enrolled:

1. Sign in to [developer.apple.com/account](https://developer.apple.com/account)
2. Navigate to **Membership** in the left sidebar
3. Your **Team ID** is displayed (10-character alphanumeric, e.g., `A1B2C3D4E5`)

![Team ID Location](https://developer.apple.com/help/account/images/team-id-location.png)

## Step 3: Create an App ID (Bundle Identifier)

### 3.1 Navigate to Identifiers

1. In [developer.apple.com/account](https://developer.apple.com/account), go to **Certificates, IDs & Profiles**
2. Click **Identifiers** in the left sidebar
3. Click the **+** button to create a new identifier

### 3.2 Register an App ID

1. Select **App IDs** and click Continue
2. Select **App** as the type and click Continue
3. Fill in the details:
   - **Description**: ShadowSky (or your app name)
   - **Bundle ID**: Choose **Explicit**
   - **Bundle Identifier**: `io.shadowsky.app` (recommended format)

   > **Note**: The Bundle ID should follow reverse domain notation. For ShadowSky, options include:
   >
   > - `io.shadowsky.app` (recommended if you own shadowsky.io)
   > - `com.shadowsky.app` (alternative)

### 3.3 Enable Capabilities

Check the following capabilities:

- [x] **Associated Domains** (required for Universal Links)
- [x] **Push Notifications** (for future APNs support)

4. Click **Continue** then **Register**

## Step 4: Configure Associated Domains (Universal Links)

### 4.1 Your App Credentials

After completing the above steps, you'll have:

| Credential | Example Value                 | Your Value         |
| ---------- | ----------------------------- | ------------------ |
| Team ID    | `A1B2C3D4E5`                  | \***\*\_\_\_\*\*** |
| Bundle ID  | `io.shadowsky.app`            | \***\*\_\_\_\*\*** |
| App ID     | `A1B2C3D4E5.io.shadowsky.app` | \***\*\_\_\_\*\*** |

### 4.2 apple-app-site-association File

Create this file to be served at `https://shadowsky.io/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.io.shadowsky.app",
        "paths": [
          "/profile/*",
          "/post/*",
          "/hashtag/*",
          "/search/*",
          "/lists/*",
          "/messages/*",
          "/notifications",
          "/settings/*"
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["TEAM_ID.io.shadowsky.app"]
  }
}
```

Replace `TEAM_ID` with your actual Team ID.

### 4.3 Hosting Requirements

The `apple-app-site-association` file must be:

- Served over HTTPS (no redirects)
- Served with `Content-Type: application/json`
- Located at either:
  - `https://shadowsky.io/.well-known/apple-app-site-association`
  - `https://shadowsky.io/apple-app-site-association`

## Step 5: Xcode Project Configuration

When building the iOS app:

### 5.1 Set Bundle Identifier

1. Open the Xcode project
2. Select the target
3. In **Signing & Capabilities**, set:
   - **Team**: Select your development team
   - **Bundle Identifier**: `io.shadowsky.app`

### 5.2 Add Associated Domains

1. In **Signing & Capabilities**, click **+ Capability**
2. Add **Associated Domains**
3. Add the domain: `applinks:shadowsky.io`

## Next Steps After Setup

Once you have your Team ID and Bundle ID:

1. Update the blocked task "Configure Universal Links and App Links infrastructure" with your credentials
2. Deploy the `apple-app-site-association` file to your domain
3. Configure the iOS app with Associated Domains capability

## Timeline Estimate

| Step                                | Duration                   |
| ----------------------------------- | -------------------------- |
| Apple ID creation (if needed)       | Immediate                  |
| Developer enrollment (Individual)   | 24-48 hours                |
| Developer enrollment (Organization) | 2-4 weeks                  |
| D-U-N-S Number (if needed)          | 1-2 weeks                  |
| App ID creation                     | Immediate after enrollment |

## Troubleshooting

### Universal Links Not Working

1. Verify the `apple-app-site-association` file is accessible:
   ```bash
   curl -I https://shadowsky.io/.well-known/apple-app-site-association
   ```
2. Validate the JSON at [branch.io/resources/aasa-validator](https://branch.io/resources/aasa-validator/)
3. Ensure no redirects occur when accessing the file

### Enrollment Issues

- **Organization verification delayed**: Contact Apple Developer Support
- **D-U-N-S not found**: Wait 2-3 weeks after requesting before enrolling

## References

- [Apple Developer Program Enrollment](https://developer.apple.com/programs/enroll/)
- [Universal Links Documentation](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
- [Associated Domains Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_developer_associated-domains)
