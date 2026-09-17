# Smart Khata — Native Android Architecture Document

**Architecture Level**: Enterprise Mobile / Capacitor Hybrid Native  
**Application ID**: `com.smartkhata.app`  
**Target SDK**: API 36 (Android 16)  
**Min SDK**: API 24 (Android 7.0+)  
**Compile SDK**: API 36  

---

## 1. System Overview

Smart Khata on Android is architected as a **native application container** powered by **Capacitor 8**, wrapping the production React 18 / Vite single-page application (SPA).

```
┌─────────────────────────────────────────────────────────────┐
│                 Smart Khata Android Native Shell            │
├─────────────────────────────────────────────────────────────┤
│  Native Layer: BridgeActivity (Java/Android)                │
│  ├── Dynamic StatusBar Plugin (Theme-reactive)             │
│  ├── Native BackButton Navigation Hierarchy                 │
│  ├── Chrome Custom Tabs (Google OAuth / Browser Plugin)     │
│  ├── Android Intent Resolver (Direct WhatsApp wa.me Launch) │
│  └── Native File Provider (Scoped File & Image Pickers)     │
├─────────────────────────────────────────────────────────────┤
│  Embedded Web Layer (android.webkit.WebView)                │
│  ├── Local Assets: file:///android_asset/public/index.html   │
│  ├── React 18 SPA + Tailwind CSS + Lucide Icons             │
│  ├── State-based Screen & Modal Routing (Zero 404 risk)     │
│  └── localStorage (Encrypted / Sandboxed WebStorage)        │
├─────────────────────────────────────────────────────────────┤
│  Backend / Cloud Services                                   │
│  ├── Supabase PostgreSQL + Auth + Real-time RLS             │
│  ├── WhatsApp Deep-link Engine                              │
│  └── Optional Meta Cloud API (Merchant Verified)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Principles

### 2.1 Single Source of Truth
- The web codebase in `src/` is the canonical implementation of all business logic, ledger calculations, receipt generators, and translations.
- The Android container does not duplicate any ledger calculations, database models, or customer validation rules.
- Local asset bundling ensures that once an APK is installed, the user has instant cold launch without waiting for remote server assets to download.

### 2.2 Navigation & Lifecycle Management
- **Address Bar Removal**: The Android app runs inside `BridgeActivity` without Chrome browser UI, URL bars, or browser tabs.
- **Hardware Back Button Hierarchy**:
  1. Dismisses top-level modals (`receiptModalData`, `isAddTxOpen`, `isScanLedgerOpen`, etc.).
  2. If viewing customer details, navigates back to customer ledger list.
  3. If viewing secondary tabs (`reports`, `campaigns`, `history`, `profile`), navigates back to `home`.
  4. If on the home dashboard with no modals, cleanly minimizes/exits the app.
- **Status Bar Integration**:
  - Dynamically switches icon styles (`Style.Light` vs `Style.Dark`) and background colors (`#0f172a` vs `#f8fafc`) according to the active theme.

### 2.3 Authentication Architecture
- **Web**: Standard Supabase OAuth redirect to `window.location.origin`.
- **Android**:
  - Launches Google Sign-In inside Android Chrome Custom Tabs via `@capacitor/browser`.
  - Captures the redirect via intent filter for `com.smartkhata.app://auth-callback`.
  - Extracts the session tokens, restores the Supabase session, and automatically closes the Chrome Custom Tab.
  - Development mode and Phone OTP continue to work seamlessly without browser popups.

### 2.4 WhatsApp Direct Handoff Engine
- Preserves the mobile zero-delay handoff:
  - Validates and normalizes phone number with country calling code.
  - Constructs `https://wa.me/<number>?text=<encodedMessage>`.
  - In Android, `https://wa.me/...` triggers Android's native intent resolver, launching the official WhatsApp app directly with prefilled receipt/reminder text.
  - Does NOT route through `navigator.share()` or generic OS share sheets.
  - Does NOT wait for `html2canvas` image rendering before opening WhatsApp.

---

## 3. Storage & Data Privacy
- Client session tokens and UI preferences (`theme`, `language`) are stored in sandboxed Android WebStorage (`localStorage`).
- Zero private server secrets or service-role keys are bundled in the APK.
- All Supabase requests use the public Anon key with PostgreSQL Row Level Security (RLS) enforcement.
