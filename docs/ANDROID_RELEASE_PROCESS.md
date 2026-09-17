# Smart Khata — Android Release & Versioning Process

This document outlines the release engineering lifecycle for generating, signing, and updating Smart Khata Android builds.

---

## 1. Versioning Strategy

Smart Khata enforces a deterministic, two-part versioning model:

1. **`versionName`** (User-Visible Semantic Version):
   - Defined in `package.json` and mirrored to `android/app/build.gradle`.
   - Format: `MAJOR.MINOR.PATCH` (e.g. `1.0.0`, `1.0.1`, `1.1.0`).
2. **`versionCode`** (Internal Monotonically Increasing Integer):
   - Defined in `android/app/build.gradle`.
   - Must strictly increase by +1 for every Google Play release.
   - **Google Play Rule**: Play Console permanently rejects any build with a `versionCode` equal to or lower than a previous upload.

### Version Increment Rule
Before publishing an update to Google Play:
1. Increment `"version": "1.0.1"` in `package.json`.
2. In `android/app/build.gradle`:
   - Increment `versionCode 2`
   - Update `versionName "1.0.1"`

---

## 2. Release Signing Security & Keystore Policy

> [!CAUTION]
> **NEVER COMMIT KEYSTORES OR PASSWORDS TO GIT!**
> Keystores (`*.keystore`, `*.jks`) and property files containing passwords are listed in `.gitignore`.

### 2.1 Generating a Production Upload Keystore
To generate a release signing key locally using JDK 21:
```bash
keytool -genkey -v -keystore smartkhata-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias smartkhata -storepass YourSecurePassword -keypass YourSecurePassword
```
Store `smartkhata-upload-key.jks` in a secure location (e.g. password manager or encrypted vault).

### 2.2 Google Play App Signing
- Google Play manages the final app signing key.
- The local keystore is used exclusively as an **Upload Key**.
- If the upload key is ever lost, it can be reset through Google Play Console support.

---

## 3. Build Commands & Artifact Outputs

| Build Target | NPM Command | Output File | Intended Use |
| :--- | :--- | :--- | :--- |
| **Debug APK** | `npm run mobile:apk` | `android/app/build/outputs/apk/debug/app-debug.apk` | Physical USB testing, internal QA |
| **Release AAB** | `npm run mobile:aab` | `android/app/build/outputs/bundle/release/app-release.aab` | Google Play Console (Production / Testing) |

---

## 4. Rollback & Disaster Recovery
- In Google Play Console, if an issue is discovered in production:
  1. Do NOT delete the release.
  2. Promote a previous tested release or build a hotfix release with an incremented `versionCode` (e.g. `versionCode 3`).
  3. Release to the **Internal Testing** track first to verify fix integrity before staging rollout to Production.
