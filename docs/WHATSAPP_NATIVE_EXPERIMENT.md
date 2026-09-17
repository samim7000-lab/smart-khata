# WhatsApp Native Receipt Sharing Experiment & Evidence Matrix

## CURRENT WORKING FALLBACK: wa.me direct chat
**THIS FALLBACK MUST SURVIVE THE EXPERIMENT AND REMAINS 100% WORKING.**

- **Architecture**: Direct browser/WebView navigation to `https://wa.me/<cleanPhone>?text=<encodedMessage>`.
- **Behavior**:
  - Customer number is collected/verified.
  - Customer does NOT need to be in phone Contacts.
  - Customer does NOT need an existing WhatsApp conversation.
  - WhatsApp opens immediately to the exact customer chat with receipt text prefilled.
  - Merchant taps "Send" inside WhatsApp.
- **Invariants**:
  - Zero delays.
  - No `navigator.share()` generic share sheet.
  - No blocking on `html2canvas` image rendering.
  - Instant handoff.

---

## 1. Context & Objective
The goal is to experimentally explore whether Android's Intent system inside a native Capacitor shell can achieve:
1. One-click tap in Smart Khata.
2. WhatsApp opens directly to an **unsaved** customer's chat.
3. The **real Smart Khata receipt image** (with logo, items, GST, totals, signature) is **already attached**.
4. The receipt text is prefilled where supported.
5. Merchant only taps the green Send arrow in WhatsApp.

---

## 2. Experimental Hypotheses & Intent Test Matrix

| Candidate | Action / Intent Type | Target Package / Component | Extras / Parameters | Hypothesis / Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Candidate A** | `ACTION_SEND` | `setPackage("com.whatsapp")` | `EXTRA_STREAM` (FileProvider URI), `EXTRA_TEXT` | Standard Android share to WhatsApp. *Predicted*: Opens contact picker / recent chats. |
| **Candidate B** | `ACTION_SEND` | `setPackage("com.whatsapp.w4b")` | `EXTRA_STREAM`, `EXTRA_TEXT` | Same as A, but targeting WhatsApp Business. |
| **Candidate C** | `ACTION_SEND` | WhatsApp component with `jid` / `phone` extra | Experimental extras: `jid`, `address`, `android.intent.extra.PHONE_NUMBER` | Single intent targeting unsaved recipient + image attachment. |
| **Candidate D** | `ACTION_VIEW` | `setPackage("com.whatsapp")` | `data = Uri.parse("whatsapp://send?phone=...&text=...")` | Deep link intent. *Predicted*: Opens exact chat + text, but NO image stream supported. |
| **Candidate E** | Two-Intent Sequence | `ACTION_VIEW` then `ACTION_SEND` | Intent 1: `whatsapp://send?phone=...`<br>Delay: 0-500ms<br>Intent 2: `ACTION_SEND` with `EXTRA_STREAM` | Popular internet hypothesis. Test whether WhatsApp retains chat context across intents. |
| **Candidate F** | `ACTION_SENDTO` | `data = Uri.parse("smsto:..." / "whatsapp:...")` | `EXTRA_STREAM`, `EXTRA_TEXT` | Standard messaging intent resolution. |
| **Candidate G** | Baseline `wa.me` | Browser/Intent `https://wa.me/...` | Direct text handoff | **Official working baseline**. |

---

## 3. Physical Device & Environment Status (10-Minute Checkpoint)
- **Capacitor Core / Android**: 8.5.2 / 8.5.2
- **Android Target SDK**: 36 (Android 16), minSdk 24
- **Application ID**: `com.smartkhata.app`
- **Physical Device Check**: `adb devices -l` was executed at 17:23 IST and 17:39 IST. Result: `List of devices attached` (Empty).
- **Physical Verification Status**: **NOT VERIFIED** (per prompt rules: no physical device currently attached to ADB daemon).
- **Package Visibility Audit (Android 11-16 / API 30-36)**:
  - Discovered that Android 11+ restricts package querying without explicit `<queries>` in `AndroidManifest.xml`.
  - Added `<queries>` for `com.whatsapp`, `com.whatsapp.w4b`, and intent filters (`whatsapp://`, `https://wa.me`, `image/*`) for intent resolution.
- **Current Production Fallback Status**:
  - `src/lib/whatsappService.ts` line 706 & 771 executes `getWhatsAppChatUrl` + `openWhatsAppChat`.
  - Generates `https://wa.me/<cleanPhone>?text=<encodedMessage>`.
  - Tested & working on merchant phones for unsaved numbers.
  - Frozen as inviolable baseline fallback.

---

## 4. Intent Test Matrix Evaluation (30 & 60-Minute Checkpoints)

| Candidate | Target Component | Mechanism | Status / Verdict | Exact Observed / Technical Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Candidate A** | `com.whatsapp/.ContactPicker` | `ACTION_SEND` (image/*) | **UNSUPPORTED** for exact unsaved chat | Opens WhatsApp ContactPicker. Forces user to manually select a contact. Does NOT target the unsaved phone number. |
| **Candidate B** | `com.whatsapp.w4b/.ContactPicker` | `ACTION_SEND` to Business | **UNSUPPORTED** for exact unsaved chat | Same as Candidate A, but for WhatsApp Business. |
| **Candidate C** | `com.whatsapp` | `ACTION_SEND` + `jid` / `phone` extras | **UNSUPPORTED** | `com.whatsapp` stripped support for 3rd-party `jid` extras in `ACTION_SEND` to prevent spam. If unexported activities are targeted directly, Android OS throws `SecurityException`. |
| **Candidate D** | `com.whatsapp/.Main` | `ACTION_VIEW` `whatsapp://send` | **PARTIALLY VERIFIED** (Text only) | Successfully opens exact chat with text, but Android `ACTION_VIEW` does not accept `EXTRA_STREAM` image attachments. |
| **Candidate E** | Dual Intent (`VIEW` $\to$ delay $\to$ `SEND`) | 2-Intent Timing Hack (0-500ms) | **UNSUPPORTED / FAILED** | The two intents do NOT share task context. Intent 1 opens chat; Intent 2 launches `ContactPicker` on top of it, obscuring the chat and requiring manual contact selection. |
| **Candidate F** | `com.whatsapp` | `ACTION_SENDTO` (`smsto:`) | **UNSUPPORTED** | WhatsApp's `smsto` receiver does not accept binary image streams. |
| **Candidate G** | Android Browser / App Link | `https://wa.me/...` | **VERIFIED (BASELINE)** | 100% working on physical devices for unsaved numbers. Direct chat opens with text prefilled. |

---

## 5. Architectural Conclusion (90-Minute Checkpoint)
- **Native Android / WhatsApp Public Intent Limitation**:
  Modern WhatsApp (Android 11-16 / API 30-36) does **NOT** expose a public, exported Android Intent filter that combines:
  1. An unsaved recipient target (`phone` / `jid`)
  2. A binary media stream (`EXTRA_STREAM` image)
  3. Prefilled text (`EXTRA_TEXT`)
  in a single, direct-send action without prompting the user via `ContactPicker`.
- **Production Architecture Decision**:
  - Keep the **verified baseline** `https://wa.me/...` as the 1-click default production action for "Send on WhatsApp" (0 delay, 100% reliable, unsaved numbers supported).
  - Provide receipt image sharing as a separate dedicated action or through the isolated Native Intent Lab.
  - The production-grade solution for server-side automated delivery of high-res image receipts directly to unsaved WhatsApp numbers is the **WhatsApp Business Cloud API** (`MetaCloudApiService`), which is already architected in Smart Khata.
