# Android Signing Setup Guide

This guide explains how to set up Android app signing and generate the credentials needed for App Links (deep linking).

## Prerequisites

- Java Development Kit (JDK) 11 or later installed
- Android Studio (recommended) or command-line tools
- Access to Google Play Console (for production apps)

## Step 1: Choose a Package Name

The package name uniquely identifies your Android app. For ShadowSky, use:

```
io.shadowsky.app
```

Package name requirements:
- Must be unique on Google Play Store
- Use reverse domain notation (e.g., `io.shadowsky.app`)
- Can only contain lowercase letters, numbers, and underscores
- Cannot start with a number

## Step 2: Generate a Release Keystore

A keystore contains your signing keys. You'll create one for signing release builds.

### Option A: Using keytool (Command Line)

```bash
# Create a new keystore
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore shadowsky-release.keystore \
  -alias shadowsky \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=ShadowSky, OU=Mobile, O=ShadowSky, L=San Francisco, ST=California, C=US"
```

**Important:** Replace `YOUR_STORE_PASSWORD` and `YOUR_KEY_PASSWORD` with secure passwords.

### Option B: Using Android Studio

1. Open Android Studio
2. Go to **Build > Generate Signed Bundle/APK**
3. Select **APK** and click **Next**
4. Click **Create new...** under Key store path
5. Fill in the form:
   - Key store path: Choose where to save (e.g., `shadowsky-release.keystore`)
   - Password: Create a strong password
   - Alias: `shadowsky`
   - Key password: Create a strong password
   - Validity: 25+ years (10000 days)
   - Certificate info: Fill in organization details
6. Click **OK** to generate

### Security Best Practices

- **NEVER commit the keystore file to version control**
- Store the keystore password securely (e.g., in a password manager)
- Back up the keystore file in a secure location
- Losing the keystore means you cannot update your app

## Step 3: Extract the SHA-256 Fingerprint

The fingerprint is needed for the `assetlinks.json` file.

### From Your Keystore

```bash
keytool -list -v \
  -keystore shadowsky-release.keystore \
  -alias shadowsky \
  -storepass YOUR_STORE_PASSWORD
```

Look for the line starting with `SHA256:` in the output:

```
Certificate fingerprints:
	 SHA1: AB:CD:EF:...
	 SHA256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
```

### From Google Play Console (Production)

If using Google Play App Signing (recommended for production):

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Navigate to **Setup > App Integrity** (or **Release > Setup > App signing**)
4. Find **App signing key certificate**
5. Copy the **SHA-256 certificate fingerprint**

Note: Google Play App Signing generates a different key than your upload key. Use the **app signing certificate** fingerprint, not the upload certificate.

## Step 4: Create assetlinks.json

Once you have the package name and fingerprint, create the `assetlinks.json` file:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.shadowsky.app",
    "sha256_cert_fingerprints": [
      "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
    ]
  }
}]
```

This file must be hosted at:
```
https://shadowsky.io/.well-known/assetlinks.json
```

### Multiple Fingerprints

You can include multiple fingerprints for different environments:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.shadowsky.app",
    "sha256_cert_fingerprints": [
      "PRODUCTION_FINGERPRINT_HERE",
      "DEBUG_FINGERPRINT_HERE"
    ]
  }
}]
```

## Step 5: Verify Setup

### Test assetlinks.json

Use Google's verification tool:
```
https://developers.google.com/digital-asset-links/tools/generator
```

Or test with curl:
```bash
curl -I https://shadowsky.io/.well-known/assetlinks.json
```

Requirements:
- Must return HTTP 200
- Must have `Content-Type: application/json`
- Must be accessible without redirects
- HTTPS is required

### Debug Fingerprint (Development)

For local development/testing, get your debug keystore fingerprint:

```bash
# macOS/Linux
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android

# Windows
keytool -list -v \
  -keystore %USERPROFILE%\.android\debug.keystore \
  -alias androiddebugkey \
  -storepass android
```

## Summary of Credentials Needed

| Credential | Example Value | Where to Use |
|------------|---------------|--------------|
| Package Name | `io.shadowsky.app` | AndroidManifest.xml, assetlinks.json |
| Alias | `shadowsky` | Build configuration |
| SHA-256 Fingerprint | `AA:BB:CC:...` | assetlinks.json |

## Next Steps

After generating your keystore and fingerprint:

1. Update the blocked Asana task with:
   - Package name: `io.shadowsky.app` (or your chosen name)
   - SHA-256 fingerprint from your release keystore

2. The fingerprint will be added to `assetlinks.json` and deployed to enable App Links

3. Configure your Android app's `AndroidManifest.xml` to handle the deep link intents

## Resources

- [Android App Links Overview](https://developer.android.com/training/app-links)
- [Digital Asset Links Specification](https://developers.google.com/digital-asset-links/v1/getting-started)
- [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
