# Smart Khata — 10-Year Google Play Maintainability Guide

This document establishes the maintenance discipline required to keep Smart Khata compliant with Google Play policies, Android OS updates, and security standards over the long term.

---

## 1. Annual Android Target API Policy Review

Google Play requires that all existing apps and updates target an API level within one or two years of the latest Android version (typically enforced by August 31 of each calendar year):

| Target Year | Google Play Minimum Target SDK Requirement | Smart Khata Status |
| :--- | :--- | :--- |
| **2024** | Target API 34 (Android 14) | Exceeded |
| **2025** | Target API 35 (Android 15) | Exceeded |
| **2026** | Target API 36 (Android 16) | **Compliant** (`targetSdkVersion 36`) |
| **Future (2027+)** | Target API 37+ | Review annually every July |

### How to Update Target SDK in the Future:
1. Open `android/variables.gradle`.
2. Update:
   ```groovy
   compileSdkVersion = 37 // or next API level
   targetSdkVersion = 37
   ```
3. Run `npm run mobile:apk` to verify compilation.

---

## 2. Dependency & SDK Health Review

Every 6 to 12 months, perform a routine maintenance check:
1. **Node & NPM Dependencies**:
   - Run `npm outdated` to check for security updates.
   - Upgrade Capacitor plugins via `npm i @capacitor/core@latest @capacitor/android@latest @capacitor/app@latest`.
   - Run `npm run mobile:sync` to propagate native plugin changes.
2. **Android Gradle Plugin & Gradle**:
   - Check Android Studio recommendations for Gradle updates.
   - Verify compatibility before updating major Gradle versions.

---

## 3. Data Safety & Privacy Policy Compliance

Google Play enforces strict Data Safety declarations in the Play Console:
1. **Financial Info**: Smart Khata manages customer purchase ledger entries, dues, and transaction histories. The Play Console Data Safety section must declare:
   - Financial Info (Purchase history, credit/due amounts) collected for app functionality.
   - User account data (Name, Phone number, Email) collected for account management.
2. **Account Deletion Requirement**:
   - Google Play requires apps offering account creation to provide both an in-app account deletion path and a public web deletion URL.
   - Smart Khata implements soft/recoverable and permanent account deletion under Shop Profile settings.

---

## 4. Permissions Least Privilege Discipline

- Periodically inspect `android/app/src/main/AndroidManifest.xml`.
- **Golden Rule**: Never add broad permissions (such as `CAMERA`, `READ_CONTACTS`, `ACCESS_FINE_LOCATION`, `READ_EXTERNAL_STORAGE`) unless a core business feature strictly requires it and user consent is collected at runtime.
- Smart Khata relies on the system file chooser for uploads, which requires **zero extra runtime permissions**.
