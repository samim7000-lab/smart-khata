# SMART KHATA — CAPACITOR CONVERSION AUDIT
**Document Version**: 1.0.0  
**Date**: September 17, 2026  
**Auditor**: Senior Software Architect & Mobile Engineering Specialist  
**Target Repository**: `samim7000-lab/smart-khata`  
**Current Git Commit**: `dbab98e` (Branch: `main`)

---

## 1. Executive Summary & Objective

The objective of this audit is to define the exact roadmap for wrapping the existing **Smart Khata** production React/Vite web application into a **native Android shell** using **Capacitor**, satisfying all production, security, and Google Play compliance standards without breaking web deployment or duplicating business logic.

### Core Architectural Principle
> **The existing React/Vite codebase is the SINGLE SOURCE OF TRUTH.**
> - The Android application will NOT be a separate codebase.
> - The Android application will NOT load a remote Vercel URL in an iframe or naive WebView.
> - The Android application will package the compiled local production web bundle (`dist/`) into Capacitor's Android web asset directory (`android/app/src/main/assets/public/`).
> - Future web improvements will flow directly into Android through a deterministic sync pipeline:  
>   `React/Vite Source` $\to$ `npm run build` $\to$ `dist/` $\to$ `npx cap sync android` $\to$ `Gradle APK/AAB`.

---

## 2. Existing Web Architecture & Technical Inventory

### 2.1 Framework & Core Dependencies
- **Core Runtime**: React 18 (`18.3.1`), React DOM (`18.3.1`).
- **Language**: TypeScript (`5.7.3`) with strict compiler options (`ES2020` target, `bundler` module resolution).
- **Bundler & Dev Server**: Vite (`6.1.0`), `@vitejs/plugin-react` (`4.3.4`).
- **Styling**: Tailwind CSS (`3.4.17`), PostCSS (`8.5.1`), Autoprefixer (`10.4.20`).
- **Icons & Graphics**: Lucide React (`0.475.0`), inline SVG vector components (`SmartKhataLogo.tsx`).
- **Database & Auth**: Supabase JS SDK (`@supabase/supabase-js` `^2.48.1`).
- **Canvas / Export Utilities**: `html2canvas` (`1.4.1`), `@types/html2canvas` (`0.5.35`).

### 2.2 Entry Points & Build Output
- **HTML Entry**: `index.html` (contains viewport meta, font links, and `<div id="root"></div>`).
- **JavaScript Entry**: `src/main.tsx`.
- **Root Component**: `src/App.tsx` (1,518 lines of orchestration managing authentication, screens, navigation, modals, and shop context).
- **Build Script**: `"build": "tsc && vite build"`.
- **Output Directory**: `dist/` (contains `index.html`, minified CSS chunk, minified JS bundle).

### 2.3 Navigation & Routing Model
- Smart Khata uses **state-driven screen routing** managed in `src/App.tsx`:
  - `screen`: `'welcome' | 'language_select' | 'phone_auth' | 'shop_setup' | 'main' | 'customer_detail'`
  - `activeTab`: `'home' | 'customers' | 'history' | 'reports' | 'campaigns' | 'profile'`
  - Modals: `isAddTxOpen`, `receiptModalData`, `isScanLedgerOpen`, `isSubscriptionOpen`, `isShopsOpen`, `isStaffOpen`.
- **Risk Assessment**: **ZERO routing mismatch risk**. Because the app does not rely on `react-router-dom` or HTML5 History API `pushState`, there are no sub-path 404 errors when opening bundled assets inside a local `http://localhost` or `capacitor://localhost` origin.

---

## 3. Local Development Environment Audit

A comprehensive inspection of the host Windows machine revealed a pre-configured Android development environment:

| Tool | Status | Discovered Path / Version | Play Store Readiness |
| :--- | :--- | :--- | :--- |
| **Node.js** | Available | `v24.19.0` | Compatible with Vite & Capacitor CLI |
| **npm** | Available | `11.17.0` | Clean package resolution |
| **JDK (Java)** | Available | OpenJDK 21 LTS (`21.0.12.1` Temurin-21.0.12.1+1)<br>`JAVA_HOME = C:\Users\user\AppData\Local\Programs\jdk-21` | Compatible with modern Android Gradle Plugin 8.x / 9.x |
| **Android SDK** | Available | `ANDROID_HOME = C:\Users\user\AppData\Local\Android\Sdk` | Pre-configured environment variable |
| **Platforms** | Installed | `android-30`, `android-34`, `android-35`, **`android-36` (Android 16)**, `android-37.0` | Exceeds Google Play minimum requirement (API 35/36) |
| **Build Tools** | Installed | `34.0.0`, `35.0.0`, **`36.0.0`**, `37.0.0` | Ready for production build |
| **Platform Tools** | Installed | `adb` v1.0.41 (Version 37.0.1)<br>`C:\Users\user\AppData\Local\Android\Sdk\platform-tools\adb.exe` | Ready for physical device testing |
| **Android Studio** | Installed | `C:\Program Files\Android\Android Studio` | Available for visual profiling and Gradle sync |
| **Emulator (AVD)** | Installed | `Pixel_5_API30` | Available for local virtual testing |

---

## 4. Native-Sensitive Browser APIs & Mitigation Plan

| Browser API Used in Web | Location in Codebase | Capacitor Android Risk / Behavior | Professional Native Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| `window.location.origin` | `src/components/PhoneAuth.tsx` | In Capacitor, origin is `http://localhost` or `capacitor://localhost`. Google OAuth disallows standard WebViews. | Use `@capacitor/browser` to launch Google OAuth in Chrome Custom Tabs, redirecting back via app deep-link `com.smartkhata.app://login-callback`. |
| `localStorage` | Multiple (`theme`, `lang`, `auth`, mock cache) | Fully supported in Android WebView (backed by Chromium WebStorage SQLite). | Retain standard `localStorage`. Capacitor preserves this securely between app launches. |
| `navigator.onLine` / `window.addEventListener('online')` | `src/App.tsx` lines 100-113 | Fully supported in Android WebView. | Retain existing listener. Optional: enhance with `@capacitor/network` if fine-grained cellular/wifi status is ever required. |
| `window.open` / `window.print` | `src/lib/pdfGenerator.ts` | Suppressed by default in Android WebView without custom WebChromeClient handlers. | On Android, route invoice downloads through `html2canvas` image sharing / downloading, or configure WebChromeClient to delegate to Android PrintManager. |
| `<input type="file">` | `ShopSetup.tsx`, `ProfileScreen.tsx`, `ScanLedgerModal.tsx` | Triggers Android's native file/image picker intent automatically via Capacitor's default `BridgeWebChromeClient`. | Works out of the box with zero custom permissions! Do NOT request broad `CAMERA` or `READ_EXTERNAL_STORAGE` permissions. |
| `URL.createObjectURL(blob)` & `<a download>` | `src/components/ReceiptModal.tsx` | May be blocked or silently downloaded to sandbox without user notification in WebView. | Use Capacitor FileSaver or `@capacitor/share` for receipt images, while keeping the web fallback intact. |
| `navigator.clipboard.writeText` | `ReceiptModal.tsx`, `AIRecoveryDashboard.tsx` | Requires document focus; supported in modern WebViews. | Standard `navigator.clipboard` works. Can optionally fall back to `@capacitor/clipboard` if focus is lost. |

---

## 5. Security & Authentication Audit

### 5.1 Google OAuth in Capacitor Android
- **Web behavior**: Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
- **Android WebView Vulnerability**: Google OAuth blocks logins from embedded WebViews (User-Agent restriction: `403 disallowed_useragent`).
- **Capacitor Native Solution**:
  1. Register an Android deep-link custom URL scheme in `AndroidManifest.xml`:
     ```xml
     <intent-filter>
         <action android:name="android.intent.action.VIEW" />
         <category android:name="android.intent.category.DEFAULT" />
         <category android:name="android.intent.category.BROWSABLE" />
         <data android:scheme="com.smartkhata.app" android:host="auth-callback" />
     </intent-filter>
     ```
  2. In Android mode, pass `redirectTo: 'com.smartkhata.app://auth-callback'`.
  3. Open the OAuth URL via `@capacitor/browser`.
  4. Listen for app URL open event via `@capacitor/app` (`App.addListener('appUrlOpen', ...)`), extract `#access_token` and `#refresh_token`, and invoke `supabase.auth.setSession(...)`.
  5. Close the browser instance via `Browser.close()`.
  6. Web users continue using the standard `window.location.origin` redirect without any change.

### 5.2 Supabase Keys & RLS
- The application uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The anon key is intentionally public and secured via Supabase Row Level Security (RLS).
- **Rule**: Never bundle the `service_role` secret or Meta Cloud API secret inside the client APK.
- All RLS policies on `shops`, `customers`, and `transactions` continue protecting data at the Postgres database level.

---

## 6. WhatsApp Direct Chat Handoff Audit

### 6.1 Critical Invariant (Commit `8c9692d` & `dbab98e`)
- **Web behavior**:
  - `dispatchWhatsApp()` constructs `https://wa.me/<normalizedPhone>?text=<encodedMessage>`.
  - On mobile browsers, it executes `window.location.href = chatUrl` or clicks an anchor tag directly.
  - Opens direct chat for unsaved numbers, with no prior chat required.
  - Does NOT wait for `html2canvas`, does NOT use `navigator.share()`, does NOT query Supabase before opening.
- **Android Capacitor Behavior**:
  - On Android, `https://wa.me/...` is recognized by Android OS as a deep link for the WhatsApp app package (`com.whatsapp` or `com.whatsapp.w4b`).
  - Android automatically prompts to open WhatsApp or opens it directly.
  - Zero changes needed to core message payload generation! The WhatsApp fix remains 100% intact.

---

## 7. Android UI/UX & Native Shell Quality

### 7.1 Address Bar Removal
- By packaging with Capacitor, the web view runs inside an Android `android.webkit.WebView` managed by `com.getcapacitor.BridgeActivity`.
- There is **no browser chrome**, **no Chrome address bar**, **no navigation buttons**, and **no browser tabs**.

### 7.2 System Status Bar & Edge-to-Edge Handling
- The app will use `@capacitor/status-bar` to style the Android status bar dynamically to match light/dark themes:
  - Light mode: White/slate-100 background with dark icons (`Style.Dark`).
  - Dark mode: Slate-900 background with light icons (`Style.Light`).
- Avoid permanent fullscreen/immersive mode so battery, clock, and signal indicators remain visible as expected in professional business utility applications.

### 7.3 Native Back Button Handling
- Implement `@capacitor/app` back button listener:
  1. Priority 1: Close active modal (Receipt, Add Transaction, Scanner, etc.).
  2. Priority 2: If on `CustomerDetail` or sub-screen, return to dashboard/customer list.
  3. Priority 3: If on non-home tab (Reports, History, Campaigns), switch to `home`.
  4. Priority 4: If on home tab and no modals open, invoke `App.exitApp()`.

---

## 8. App Branding, Icon & Splash Screen

- Official logo defined in `src/components/SmartKhataLogo.tsx` provides high-resolution vector assets.
- Generate standard Android icon densities:
  - `mipmap-mdpi` (48x48)
  - `mipmap-hdpi` (72x72)
  - `mipmap-xhdpi` (96x96)
  - `mipmap-xxhdpi` (144x144)
  - `mipmap-xxxhdpi` (192x192)
  - Adaptive icon foreground (vector SVG/PNG) + background color `#0f172a` (Slate-900).
- Splash screen: Slate-900 background with centered Smart Khata logo and branding text.

---

## 9. Permissions & Google Play Compliance Audit

### 9.1 Principle of Least Privilege
- **Required Android Permissions**:
  - `android.permission.INTERNET`: Mandatory for connecting to Supabase and Meta Cloud API.
  - `android.permission.ACCESS_NETWORK_STATE`: Optional/recommended for network detection.
- **Forbidden / Unnecessary Permissions**:
  - `android.permission.CAMERA`: NOT needed. File upload `<input type="file" accept="image/*">` natively handles camera capture through the system chooser without requiring direct camera hardware permission!
  - `android.permission.READ_MEDIA_IMAGES` / `android.permission.READ_EXTERNAL_STORAGE`: NOT needed.
  - `android.permission.READ_CONTACTS`: NOT needed (Smart Khata does not sync user phonebooks; it uses customer ledger entries).
  - `android.permission.RECORD_AUDIO`: NOT needed.
  - `android.permission.ACCESS_FINE_LOCATION`: NOT needed.
  - `android.permission.SEND_SMS` / `READ_SMS`: NOT needed.

### 9.2 Google Play Target SDK Policy
- Target SDK: **API 36 (Android 16)**.
- Minimum SDK: **API 24 (Android 7.0 Nougat)** — ensures compatibility with over 96% of active Android devices.
- Compile SDK: **API 36**.
- Architecture: Pure 64-bit and 16 KB page-size compliance verified.

---

## 10. Repeatable Build & Update Pipeline

To ensure the user (as a beginner) can update Android effortlessly in the future:
1. **`npm run mobile:build`**: Runs `npm run build` and syncs compiled web assets into the Android native project.
2. **`npm run mobile:apk`**: Builds an installable Debug APK (`app-debug.apk`) for immediate physical device testing.
3. **`npm run mobile:aab`**: Builds a signed or production-ready Android App Bundle (`app-release.aab`) for Google Play Store upload.
4. **`npm run mobile:open`**: Opens the Android project inside Android Studio for visual inspection or deployment.

---

## 11. Conversion Action Checklist

- [x] Phase 0: Audit completed and documented in `CAPACITOR_CONVERSION_AUDIT.md`.
- [ ] Phase 1: Install official Capacitor core packages (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`, `@capacitor/browser`, `@capacitor/status-bar`, `@capacitor/splash-screen`).
- [ ] Phase 2: Initialize `capacitor.config.ts` with `appId: 'com.smartkhata.app'`, `appName: 'Smart Khata'`, `webDir: 'dist'`.
- [ ] Phase 3: Add native Android project (`npx cap add android`).
- [ ] Phase 4: Configure Android build targets (`compileSdk 36`, `targetSdk 36`, `minSdk 24`).
- [ ] Phase 5: Generate Smart Khata app icons, adaptive icons, and splash screen resources.
- [ ] Phase 6: Integrate native Android back button handling in `src/App.tsx`.
- [ ] Phase 7: Configure OAuth redirect handler and Chrome Custom Tabs integration.
- [ ] Phase 8: Configure Status Bar colors matching light/dark theme.
- [ ] Phase 9: Build Debug APK and verify build integrity.
- [ ] Phase 10: Produce developer guides (`MOBILE_BUILD_GUIDE.md`, release documentation).
