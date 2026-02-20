# TestFlight Setup Guide

This guide covers setting up TestFlight for internal beta testing of ShadowSky (Asphodel).

## Prerequisites

- Apple Developer Program membership (active)
- EAS CLI installed and authenticated (`npx eas-cli login`)
- EAS project initialized (`npx eas-cli init`)
- iOS credentials configured (`npx eas-cli credentials`)
- App registered in App Store Connect (ASC App ID: `6738274061`)

## Architecture

```
EAS Build (testflight profile)
  → Builds .ipa with store distribution
  → Auto-submits to App Store Connect via EAS Submit
  → TestFlight processes the build
  → Internal testers receive notification
  → Testers install via TestFlight app
```

## Build Profiles

### TestFlight Profile (`eas.json`)

The `testflight` build profile is configured for TestFlight distribution:

- **distribution**: `store` (required for TestFlight)
- **autoSubmit**: `true` (automatically uploads to App Store Connect after build)
- **autoIncrement**: `true` (automatically increments build number)
- **channel**: `testflight` (separate OTA update channel)
- **resourceClass**: `m-large` (faster builds)
- **Sentry**: Source maps enabled for crash reporting

## Building for TestFlight

### Quick Start

```bash
cd mobile

# Build and auto-submit to TestFlight
npm run build:testflight
```

This single command will:
1. Build the iOS app on EAS servers
2. Automatically submit the `.ipa` to App Store Connect
3. App Store Connect processes the build (takes ~15-30 min)
4. Internal testers are notified automatically

### Manual Submit

If auto-submit is disabled or you need to resubmit:

```bash
# Submit the latest build manually
npm run submit:testflight

# Or submit a specific build
npx eas-cli submit --platform ios --profile testflight --id BUILD_ID
```

### OTA Updates (No Rebuild Required)

For JavaScript-only changes, push updates without a full rebuild:

```bash
npm run update:testflight -- "Description of changes"
```

## App Store Connect Configuration

### 1. Add Internal Testers

Internal testers must be App Store Connect users with at least the **App Manager**, **Developer**, or **Marketing** role.

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access**
3. Add team members with appropriate roles
4. They will automatically have access to internal TestFlight builds

**Internal tester limits**: Up to 100 internal testers (Apple Developer Program members only).

### 2. Create Test Groups

#### Internal Testers Group

1. Go to App Store Connect → **My Apps** → **Asphodel**
2. Select **TestFlight** tab
3. Under **Internal Testing**, click **+** to create a group
4. Name: `ShadowSky Internal`
5. Add testers from your App Store Connect team
6. Enable **Automatic Distribution** for this group

#### Recommended Groups

| Group Name | Purpose | Auto-Distribute |
|---|---|---|
| `ShadowSky Internal` | Core team testing | Yes |
| `ShadowSky QA` | Dedicated QA testers | Yes |
| `ShadowSky Stakeholders` | Product/design review | No (manual) |

### 3. Enable Automatic Distribution

For internal test groups:
1. Select the test group
2. Toggle **Automatic Distribution** ON
3. New builds will be distributed to this group immediately after processing

### 4. Beta App Information

Configure in App Store Connect → TestFlight → **Test Information**:

| Field | Value |
|---|---|
| **Beta App Description** | ShadowSky is an alternative client for Bluesky (AT Protocol) with advanced features including AI-powered analytics, bookmark collections, scheduled posts, and customizable feeds. This beta build is for internal testing. |
| **Feedback Email** | dustin.moskovitz@gmail.com |
| **Marketing URL** | https://shadowsky.io |
| **Privacy Policy URL** | https://shadowsky.io/privacy |
| **Beta App Review Contact** | |
| - First Name | Dustin |
| - Last Name | Moskovitz |
| - Email | dustin.moskovitz@gmail.com |

### 5. Test Information (Per Build)

Each build uploaded to TestFlight can have test notes. Add them via:
- App Store Connect UI → TestFlight → Select Build → **What to Test**
- Or include in the EAS submit metadata

Example test notes:
```
What to Test:
- AT Protocol login with existing Bluesky account
- Feed browsing and scrolling performance
- Post composition and publishing
- Notification delivery
- Bookmark and draft management
- Widget functionality

Known Issues:
- [List any known issues for this build]
```

## Pre-Submission Testing Checklist

Before distributing a TestFlight build, verify:

### Critical Path
- [ ] App launches without crash on iPhone and iPad
- [ ] AT Protocol authentication works (login/logout)
- [ ] Feed loads and scrolls smoothly
- [ ] Post composition works (text, images, links)
- [ ] No placeholder content or broken screens
- [ ] All native modules are functional

### Core Features
- [ ] Push notifications received and tappable
- [ ] Search works (users and posts)
- [ ] Profile view loads correctly
- [ ] DMs/messaging functional
- [ ] Bookmarks save and load
- [ ] Share extension works
- [ ] Deep links open correct screens

### Performance
- [ ] App does not exhibit excessive memory usage
- [ ] No UI jank during scrolling
- [ ] Images load progressively
- [ ] App resumes from background correctly

### Device Compatibility
- [ ] iPhone (standard size)
- [ ] iPhone (Max/Plus size)
- [ ] iPad (if supportsTablet is true)
- [ ] iOS 15.1+ (minimum deployment target)

## Troubleshooting

### Build fails with credential errors

```bash
# Reset iOS credentials
npx eas-cli credentials --platform ios
# Choose "Remove credentials" then set up new ones
```

### Build succeeds but TestFlight shows "Processing"

- App Store Connect processing takes 15-30 minutes
- Check status at: App Store Connect → TestFlight → Builds
- If stuck > 1 hour, check for compliance issues in email

### Testers don't receive notification

1. Verify tester is in an active test group
2. Verify **Automatic Distribution** is enabled
3. Check tester accepted the TestFlight invitation email
4. Tester must have TestFlight app installed

### "Missing Compliance" warning

If the build shows "Missing Compliance" in App Store Connect:
- The app uses standard HTTPS encryption
- Set the export compliance to "No" for encryption other than standard HTTPS
- This can be automated in `app.config.ts` by adding `ITSAppUsesNonExemptEncryption: false` to `infoPlist`

### Build number conflicts

The `autoIncrement` setting handles this automatically. If you need to set manually:

```bash
npx eas-cli build:version:set --platform ios
```

## Version Strategy

| Channel | Version | Build Number | Purpose |
|---|---|---|---|
| development | 0.7.0 | auto | Dev client with debugging |
| preview | 0.7.0 | auto | Ad-hoc testing on specific devices |
| testflight | 0.7.0 | auto-increment | Internal beta via TestFlight |
| production | 0.7.0 | auto | App Store release |

## Security Notes

- TestFlight builds are signed with your App Store distribution certificate
- Internal testers must be members of your App Store Connect team
- Builds expire after 90 days
- TestFlight builds cannot be distributed outside your organization (for internal testing)
- External TestFlight testing requires App Review (not configured here)
