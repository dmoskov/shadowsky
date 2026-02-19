# Apple Developer Account Setup for iOS Distribution

This guide covers setting up Apple Developer credentials for:

- Universal Links configuration
- TestFlight beta distribution
- App Store distribution via EAS Build

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
   - **Bundle Identifier**: `io.asphodel.app` (recommended format)

   > **Note**: The Bundle ID should follow reverse domain notation. For ShadowSky, options include:
   >
   > - `io.asphodel.app` (recommended if you own asphodel.io)
   > - `com.asphodel.app` (alternative)

### 3.3 Enable Capabilities

Check the following capabilities:

- [x] **Associated Domains** (required for Universal Links)
- [x] **Push Notifications** (for future APNs support)

4. Click **Continue** then **Register**

## Step 4: Create Distribution Certificate

A distribution certificate is required for TestFlight and App Store distribution.

### 4.1 Generate a Certificate Signing Request (CSR)

On your Mac:

1. Open **Keychain Access** (Applications > Utilities > Keychain Access)
2. From the menu bar: **Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority**
3. Fill in:
   - **User Email Address**: Your Apple Developer email
   - **Common Name**: Your name or company name (e.g., "ShadowSky Distribution")
   - **CA Email Address**: Leave blank
   - **Request is**: Select **Saved to disk**
4. Click **Continue** and save the `.certSigningRequest` file

### 4.2 Create the Distribution Certificate

1. Go to [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
2. Click **+** to create a new certificate
3. Under **Software**, select:
   - **Apple Distribution** (recommended - works for App Store and TestFlight)
   - Or **iOS Distribution (App Store Connect and Ad Hoc)** for iOS-only
4. Click **Continue**
5. Upload the `.certSigningRequest` file you created
6. Click **Continue**, then **Download**

### 4.3 Install the Certificate

1. Double-click the downloaded `.cer` file
2. Keychain Access will open and install the certificate
3. Verify installation:
   - In Keychain Access, go to **My Certificates**
   - Look for "Apple Distribution: [Your Name/Company]"
   - Expand it to see the private key attached

### 4.4 Export for EAS Build (p12 format)

For EAS Build to use your certificate:

1. In Keychain Access, find your "Apple Distribution" certificate
2. Right-click the certificate and select **Export**
3. Choose **Personal Information Exchange (.p12)** format
4. Set a strong password (you'll need this for EAS)
5. Save the `.p12` file securely

> **Important**: Store the `.p12` file and password securely. Never commit them to git.

## Step 5: Create Provisioning Profile

### 5.1 Development Profile (for testing)

1. Go to [developer.apple.com/account/resources/profiles](https://developer.apple.com/account/resources/profiles)
2. Click **+** to create a new profile
3. Select **iOS App Development** and click **Continue**
4. Select your App ID (`io.asphodel.app`) and click **Continue**
5. Select your distribution certificate and click **Continue**
6. Select devices for testing (or select all)
7. Name: `ShadowSky Development`
8. Click **Generate** and **Download**

### 5.2 Distribution Profile (for TestFlight/App Store)

1. Click **+** to create another profile
2. Select **App Store Connect** and click **Continue**
3. Select your App ID (`io.asphodel.app`) and click **Continue**
4. Select your Apple Distribution certificate and click **Continue**
5. Name: `ShadowSky Distribution`
6. Click **Generate** and **Download**

### 5.3 Verify Profiles

You now have two provisioning profiles:

| Profile Type | Name                   | Use Case                    |
| ------------ | ---------------------- | --------------------------- |
| Development  | ShadowSky Development  | Local testing, debug builds |
| Distribution | ShadowSky Distribution | TestFlight, App Store       |

## Step 6: Configure EAS Build Credentials

EAS Build can manage Apple credentials automatically or manually.

### Option A: Automatic (Recommended)

EAS can create and manage certificates automatically:

```bash
# First time setup - EAS will prompt for Apple credentials
eas credentials

# Or let it configure during first build
eas build --platform ios --profile preview
```

EAS will:

1. Prompt for your Apple ID and password
2. Create/select certificates and profiles automatically
3. Store credentials securely on Expo servers

### Option B: Manual Configuration

If you prefer to use your existing certificates:

1. **Export credentials from Keychain** (Step 4.4 above)

2. **Configure in eas.json**:

```json
{
  "build": {
    "preview": {
      "ios": {
        "credentialsSource": "local"
      }
    },
    "production": {
      "ios": {
        "credentialsSource": "local"
      }
    }
  }
}
```

3. **Create credentials.json** (don't commit this!):

```json
{
  "ios": {
    "provisioningProfilePath": "./secrets/ShadowSky_Distribution.mobileprovision",
    "distributionCertificate": {
      "path": "./secrets/distribution.p12",
      "password": "YOUR_P12_PASSWORD"
    }
  }
}
```

4. **Add to .gitignore**:

```
# Apple credentials
credentials.json
secrets/
*.mobileprovision
*.p12
*.cer
```

### Option C: Using EAS Secret Store

For CI/CD, store credentials as EAS secrets:

```bash
# Upload distribution certificate
eas secret:create --name APPLE_DIST_CERT_P12 --value "$(base64 -i ./distribution.p12)"
eas secret:create --name APPLE_DIST_CERT_PASSWORD --value "your-p12-password"

# Upload provisioning profile
eas secret:create --name APPLE_PROVISIONING_PROFILE --value "$(base64 -i ./profile.mobileprovision)"
```

## Step 7: Configure App Store Connect

For TestFlight distribution:

### 7.1 Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps** > **+** > **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: ShadowSky
   - **Primary Language**: English (or your preference)
   - **Bundle ID**: Select `io.asphodel.app`
   - **SKU**: `shadowsky-ios` (unique identifier)
4. Click **Create**

### 7.2 TestFlight Configuration

1. In App Store Connect, select your app
2. Go to **TestFlight** tab
3. Under **General Information**, add:
   - Test Information (what testers should test)
   - Beta App Description
   - Contact email and phone
4. Under **App Store Connect Users**, add internal testers

### 7.3 App Store Connect API Key (for automated uploads)

For CI/CD automated uploads:

1. Go to **Users and Access** > **Integrations** > **App Store Connect API**
2. Click **+** to generate a new key
3. Name: `EAS Build`
4. Access: **App Manager** or **Admin**
5. Click **Generate**
6. Download the `.p8` file (only available once!)
7. Note the **Key ID** and **Issuer ID**

Store these for EAS:

```bash
eas secret:create --name APPLE_API_KEY_ID --value "XXXXXXXXXX"
eas secret:create --name APPLE_API_KEY_ISSUER_ID --value "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
eas secret:create --name APPLE_API_KEY_P8 --value "$(cat ./AuthKey_XXXXXXXXXX.p8)"
```

## Step 8: Configure Associated Domains (Universal Links)

### 8.1 Your App Credentials

After completing the above steps, you'll have:

| Credential | Example Value                | Your Value         |
| ---------- | ---------------------------- | ------------------ |
| Team ID    | `A1B2C3D4E5`                 | \***\*\_\_\_\*\*** |
| Bundle ID  | `io.asphodel.app`            | \***\*\_\_\_\*\*** |
| App ID     | `A1B2C3D4E5.io.asphodel.app` | \***\*\_\_\_\*\*** |

### 8.2 apple-app-site-association File

Create this file to be served at `https://shadowsky.io/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.io.asphodel.app",
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
    "apps": ["TEAM_ID.io.asphodel.app"]
  }
}
```

Replace `TEAM_ID` with your actual Team ID.

### 8.3 Hosting Requirements

The `apple-app-site-association` file must be:

- Served over HTTPS (no redirects)
- Served with `Content-Type: application/json`
- Located at either:
  - `https://shadowsky.io/.well-known/apple-app-site-association`
  - `https://shadowsky.io/apple-app-site-association`

## Step 9: Xcode Project Configuration

When building the iOS app:

### 9.1 Set Bundle Identifier

1. Open the Xcode project
2. Select the target
3. In **Signing & Capabilities**, set:
   - **Team**: Select your development team
   - **Bundle Identifier**: `io.asphodel.app`

### 9.2 Add Associated Domains

1. In **Signing & Capabilities**, click **+ Capability**
2. Add **Associated Domains**
3. Add the domain: `applinks:shadowsky.io`

## Quick Start Checklist

For users with an existing Apple Developer account but no certificates (Option 2):

- [ ] Generate CSR from Keychain Access (Step 4.1)
- [ ] Create Apple Distribution certificate (Step 4.2)
- [ ] Install certificate in Keychain (Step 4.3)
- [ ] Create App ID with bundle `io.asphodel.app` (Step 3)
- [ ] Create Distribution provisioning profile (Step 5.2)
- [ ] Create app in App Store Connect (Step 7.1)
- [ ] Run `eas credentials` to configure EAS Build (Step 6)
- [ ] Generate App Store Connect API key for CI/CD (Step 7.3)

## Next Steps After Setup

Once you have your credentials configured:

1. Run `eas build --platform ios --profile preview` to test the build
2. Upload to TestFlight for beta testing
3. Deploy the `apple-app-site-association` file to your domain
4. Configure the iOS app with Associated Domains capability

## Credential Summary

After completing this guide, you'll have:

| Credential               | Location                            | Purpose                    |
| ------------------------ | ----------------------------------- | -------------------------- |
| Team ID                  | Apple Developer Portal > Membership | Identifies your team       |
| Bundle ID                | `io.asphodel.app`                   | App identifier             |
| Distribution Certificate | Keychain / EAS                      | Signs app for distribution |
| Provisioning Profile     | Apple Developer Portal / EAS        | Links certificate to app   |
| App Store Connect App    | App Store Connect                   | TestFlight & App Store     |
| API Key (.p8)            | App Store Connect                   | Automated uploads          |

## Troubleshooting

### Certificate Issues

- **"No valid signing identity"**: Export certificate with private key as .p12
- **Certificate expired**: Create new certificate, update provisioning profile
- **Wrong certificate type**: Use "Apple Distribution" not "iOS Development"

### Provisioning Profile Issues

- **Profile doesn't include certificate**: Regenerate profile after creating certificate
- **App ID mismatch**: Ensure bundle ID matches exactly

### EAS Build Issues

- **Credentials not found**: Run `eas credentials` to configure
- **Authentication failed**: Check Apple ID credentials, may need app-specific password

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
- [EAS Build iOS Credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
