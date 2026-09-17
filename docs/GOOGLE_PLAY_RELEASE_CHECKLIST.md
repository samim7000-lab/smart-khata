# Google Play Store Release Checklist

Use this pre-flight checklist before submitting any production build to the Google Play Console.

---

## 1. Technical Prerequisites
- [ ] Application ID is verified as `com.smartkhata.app`.
- [ ] `versionCode` is strictly greater than the previous release in `android/app/build.gradle`.
- [ ] `versionName` matches the version in `package.json`.
- [ ] `targetSdkVersion` is set to **36** (Android 16) in `android/variables.gradle`.
- [ ] Debug mode is disabled (`minifyEnabled` or release build type active).
- [ ] Build produced using `npm run mobile:aab` generates `android/app/build/outputs/bundle/release/app-release.aab`.

---

## 2. Permissions & Security Audit
- [ ] `android.permission.INTERNET` is the primary declared permission in `AndroidManifest.xml`.
- [ ] No unauthorized permissions (Camera, Contacts, SMS, Location) exist in merged manifest.
- [ ] No database service role keys or private secrets are present in client code or assets.

---

## 3. Store Listing & Compliance
- [ ] **App Title**: Smart Khata (or localized equivalents: স্মার্ট খাতা / स्मार्ट खाता).
- [ ] **Short Description**: Digital Udhar Ledger & Invoicing for Retailers.
- [ ] **Privacy Policy URL**: Publicly accessible HTTPS link hosted on your website.
- [ ] **Data Safety Form**:
  - Personal Info: Name, Phone Number, Email (for authentication & shop profile).
  - Financial Info: Purchase records, credit/ledger transactions (for business ledger bookkeeping).
- [ ] **Account Deletion**:
  - In-app deletion pathway available in Profile Screen.
  - Web account deletion request URL provided.
- [ ] **Target Audience & Content Rating**:
  - Target audience selected (Business / Utility / 18+).
  - Content rating questionnaire completed.

---

## 4. Testing & Rollout Protocol
- [ ] Tested on physical Android device or emulator via `adb install`.
- [ ] Verified Google Sign-In via Chrome Custom Tabs returns to app correctly.
- [ ] Verified WhatsApp receipt direct handoff opens customer chat.
- [ ] Submitted first to **Internal Testing** track before staging a 10% $\to$ 50% $\to$ 100% production rollout.
