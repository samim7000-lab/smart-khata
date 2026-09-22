/**
 * SMART KHATA — PERSISTED SCAN WORKSPACE SERVICE
 *
 * Provides temporary on-device persistence for multi-draft AI ledger scans.
 * Ensures the review batch is preserved when the merchant navigates to WhatsApp (wa.me)
 * and returns, or when the Android OS pauses/resumes the app.
 *
 * PRIVACY, SECURITY & SAFETY INVARIANTS:
 * 1. 24-hour TTL (Time-To-Live) with automatic cleanup.
 * 2. Never stores raw base64 images or authentication secrets.
 * 3. Scoped strictly to the active shopId AND userId (cross-shop and cross-account tenant isolation).
 * 4. Idempotency: drafts mark saveStatus = 'saved' and record transactionId, preventing duplicate DB writes.
 * 5. Persisting a workspace DOES NOT create a financial transaction.
 * 6. Completed workspaces are automatically purged from local storage.
 * 7. WhatsApp status semantics: distinguishes 'ready', 'handed_off', 'sent', 'failed'.
 *    Opening wa.me is strictly 'handed_off', NEVER falsely recorded as 'sent'.
 */

import type { Customer, TransactionType } from '../types/index.ts';
import type { IdentityStatus } from './customerIdentityResolver.ts';

export interface GeminiOcrItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export type BadgeState = 'detected' | 'check' | 'manual';

export type WhatsAppStatus = 'ready' | 'handed_off' | 'sent' | 'failed';

export type ScanWorkspaceStage = 'idle' | 'capturing' | 'processing' | 'batch_list' | 'draft_review';

export interface ScanDraft {
  id: string;
  customerName: string;
  phone: string;
  amount: string;
  type: TransactionType;
  productName?: string;
  optionalQuantity?: string | number;
  optionalUnitPrice?: string | number;
  customerAddress?: string;
  optionalNote?: string;
  optionalItems?: GeminiOcrItem[];
  confidence: number;
  matchedCustomer: Customer | null;
  isCreatingNewCust: boolean;
  identityStatus: IdentityStatus;
  resolutionReasons: string[];
  candidates: Customer[];
  nameBadge: BadgeState;
  phoneBadge: BadgeState;
  amountBadge: BadgeState;
  confirmed: boolean;
  saveStatus: 'pending' | 'saved' | 'error';
  whatsappStatus: WhatsAppStatus;
  transactionId?: string;
  receiptId?: string;
}

export interface ScanWorkspace {
  workspaceId: string;
  shopId: string;
  userId: string;
  currentDraftId?: string;
  stage?: ScanWorkspaceStage;
  createdAt: string;
  lastUpdatedAt: string;
  drafts: ScanDraft[];
  activeDraftIndex: number;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface WorkspaceIdentity {
  isValid: boolean;
  userId: string;
  shopId: string;
}

/**
 * CANONICAL WORKSPACE IDENTITY RESOLVER
 * Strict Security Invariant: authenticated user must be the shop owner.
 * Never defaults to 'anon', 'default', or another user's workspace.
 */
export function getCanonicalWorkspaceIdentity(
  shop: { id?: string; owner_id?: string } | null | undefined,
  authenticatedUserId: string | null | undefined
): WorkspaceIdentity {
  if (!shop?.id || !authenticatedUserId) {
    return { isValid: false, userId: '', shopId: '' };
  }
  if (shop.owner_id !== authenticatedUserId) {
    console.warn('[WORKSPACE SECURITY] Tenant invariant violation: shop.owner_id !== authenticatedUserId');
    return { isValid: false, userId: '', shopId: '' };
  }
  return { isValid: true, userId: authenticatedUserId, shopId: shop.id };
}

export interface PendingCameraCapture {
  captureRequestId: string;
  workspaceId?: string;
  userId: string;
  shopId: string;
  createdAt: number;
  status: 'pending' | 'captured' | 'consumed';
}

const PENDING_CAMERA_STORAGE_KEY = 'smart_khata_pending_camera_capture';

const WORKSPACE_KEY_PREFIX = 'smart_khata_scan_workspace_';
const LEGACY_STORAGE_KEY = 'smart_khata_scan_workspace_v1';
const WORKSPACE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ScanWorkspaceService {
  /**
   * Records a pending camera capture request before launching the native camera.
   */
  public static savePendingCameraCapture(capture: {
    captureRequestId: string;
    workspaceId?: string;
    userId: string;
    shopId: string;
  }): void {
    try {
      if (!capture.captureRequestId || !capture.userId || !capture.shopId) return;
      const record: PendingCameraCapture = {
        ...capture,
        createdAt: Date.now(),
        status: 'pending',
      };
      localStorage.setItem(PENDING_CAMERA_STORAGE_KEY, JSON.stringify(record));
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error saving pending camera capture:', e);
    }
  }

  /**
   * Reads an active pending camera capture if not expired (5-minute TTL).
   */
  public static getPendingCameraCapture(): PendingCameraCapture | null {
    try {
      const raw = localStorage.getItem(PENDING_CAMERA_STORAGE_KEY);
      if (!raw) return null;
      const record: PendingCameraCapture = JSON.parse(raw);
      if (Date.now() - record.createdAt > 5 * 60 * 1000) {
        localStorage.removeItem(PENDING_CAMERA_STORAGE_KEY);
        return null;
      }
      return record;
    } catch {
      return null;
    }
  }

  /**
   * Clears the pending camera capture marker after successful handoff or cancellation.
   */
  public static clearPendingCameraCapture(): void {
    try {
      localStorage.removeItem(PENDING_CAMERA_STORAGE_KEY);
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error clearing pending camera capture:', e);
    }
  }

  /**
   * Generates a tenant-scoped storage key strictly combining authenticated userId and shopId.
   */
  public static getStorageKey(shopId: string, userId: string): string {
    if (!shopId || !userId) return '';
    const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanShop = shopId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanUser || !cleanShop) return '';
    return `${WORKSPACE_KEY_PREFIX}${cleanUser}_${cleanShop}`;
  }

  /**
   * Saves the active scan workspace to local storage.
   */
  public static saveWorkspace(workspace: ScanWorkspace): void {
    try {
      if (!workspace || !workspace.drafts || workspace.drafts.length === 0) {
        this.clearWorkspace(workspace?.shopId, workspace?.userId);
        return;
      }

      if (!workspace.shopId || !workspace.userId) {
        console.warn('[SCAN-WORKSPACE] Missing required shopId or userId for saving workspace');
        return;
      }

      const key = this.getStorageKey(workspace.shopId, workspace.userId);
      if (!key) return;

      // Check if all drafts are saved; if so, immediately purge completed workspace
      const allSaved = workspace.drafts.every((d) => d.saveStatus === 'saved');
      if (allSaved) {
        console.log(`[SCAN-WORKSPACE] All drafts saved. Purging completed workspace for shop: ${workspace.shopId}`);
        localStorage.removeItem(key);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return;
      }

      const sanitized: ScanWorkspace = {
        workspaceId: workspace.workspaceId,
        shopId: workspace.shopId,
        userId: workspace.userId,
        currentDraftId: workspace.currentDraftId,
        stage: workspace.stage || 'batch_list',
        createdAt: workspace.createdAt || new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        drafts: workspace.drafts.map((d) => ({
          ...d,
          // Guarantee clean serializable object without circular refs
          candidates: (d.candidates || []).slice(0, 5),
        })),
        activeDraftIndex: Math.max(0, Math.min(workspace.activeDraftIndex, workspace.drafts.length - 1)),
        status: workspace.status || 'in_progress',
      };

      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error saving workspace:', e);
    }
  }

  /**
   * Loads the active scan workspace for a specific shop and user, enforcing TTL and isolation.
   */
  public static loadWorkspace(shopId: string, userId: string): ScanWorkspace | null {
    try {
      if (!shopId || !userId) return null;

      const key = this.getStorageKey(shopId, userId);
      if (!key) return null;

      let raw = localStorage.getItem(key);

      // Legacy migration fallback if new key is absent
      if (!raw) {
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      }

      if (!raw) return null;

      const workspace: ScanWorkspace = JSON.parse(raw);
      if (!workspace || !workspace.workspaceId || !workspace.drafts) {
        localStorage.removeItem(key);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return null;
      }

      // 1. Tenant Isolation: Shop must match strictly
      if (workspace.shopId !== shopId) {
        return null;
      }

      // 2. User Isolation: If user is known, must not belong to another user
      if (userId && workspace.userId && workspace.userId !== userId) {
        console.warn('[SCAN-WORKSPACE] Access denied: workspace belongs to different user');
        return null;
      }

      // 3. TTL Expiry Check (24 hours)
      const lastUpdated = new Date(workspace.lastUpdatedAt || workspace.createdAt).getTime();
      if (Date.now() - lastUpdated > WORKSPACE_TTL_MS) {
        console.log('[SCAN-WORKSPACE] Expired workspace cleared (exceeded 24h TTL)');
        localStorage.removeItem(key);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return null;
      }

      // 4. Completed workspace cleanup
      if (workspace.status === 'completed' || workspace.drafts.every((d) => d.saveStatus === 'saved')) {
        localStorage.removeItem(key);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return null;
      }

      return workspace;
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error reading workspace from storage:', e);
      return null;
    }
  }

  /**
   * Marks a specific draft as saved in the workspace with its database transaction ID.
   */
  public static markDraftSaved(draftId: string, transactionId?: string, shopId?: string, userId?: string): void {
    try {
      this.updateMatchingDraft(
        draftId,
        (draft) => {
          draft.saveStatus = 'saved';
          draft.confirmed = true;
          if (transactionId) draft.transactionId = transactionId;
        },
        shopId,
        userId
      );
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error marking draft saved:', e);
    }
  }

  /**
   * Semantically updates the WhatsApp status of a draft:
   * 'ready' -> Draft ready to send
   * 'handed_off' -> wa.me deep link opened (merchant still needs to tap send in WhatsApp)
   * 'sent' -> Verified outbound send via Meta Cloud API
   * 'failed' -> Error opening WhatsApp
   */
  public static markDraftWhatsAppStatus(
    txId: string,
    status: WhatsAppStatus,
    shopId?: string,
    userId?: string
  ): void {
    try {
      if (!txId) return;
      this.updateMatchingDraft(
        txId,
        (draft) => {
          draft.whatsappStatus = status;
        },
        shopId,
        userId,
        true // match by txId
      );
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error updating WhatsApp status:', e);
    }
  }

  /**
   * Alias for backward compatibility. Opening wa.me sets status to 'handed_off', NOT 'sent'.
   */
  public static markDraftSentByTransactionId(txId: string, shopId?: string, userId?: string): void {
    this.markDraftWhatsAppStatus(txId, 'handed_off', shopId, userId);
  }

  /**
   * Clears the active scan workspace for a specific shop and user.
   */
  public static clearWorkspace(shopId?: string, userId?: string): void {
    try {
      if (shopId && userId) {
        const key = this.getStorageKey(shopId, userId);
        if (key) localStorage.removeItem(key);
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error clearing workspace:', e);
    }
  }

  /**
   * Clears all scan workspaces for a given user on logout or account deletion.
   * Prevents any cross-user leakage on shared devices.
   */
  public static clearAllUserWorkspaces(userId?: string): void {
    try {
      const keysToRemove: string[] = [];
      const userPattern = userId ? userId.replace(/[^a-zA-Z0-9_-]/g, '') : '';

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k === LEGACY_STORAGE_KEY) {
          keysToRemove.push(k);
        } else if (k.startsWith(WORKSPACE_KEY_PREFIX)) {
          if (!userPattern || k.includes(`_${userPattern}_`)) {
            keysToRemove.push(k);
          }
        }
      }

      keysToRemove.forEach((k) => localStorage.removeItem(k));
      console.log(`[SCAN-WORKSPACE] Cleared ${keysToRemove.length} workspaces for user isolation.`);
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error during clearAllUserWorkspaces:', e);
    }
  }

  /**
   * Checks if an active uncompleted workspace exists for a shop and user.
   */
  public static hasActiveWorkspace(shopId: string, userId: string): boolean {
    if (!shopId || !userId) return false;
    const ws = this.loadWorkspace(shopId, userId);
    return Boolean(ws && ws.drafts.some((d) => d.saveStatus !== 'saved'));
  }

  /**
   * Internal helper to find and mutate a draft across local storage keys.
   */
  private static updateMatchingDraft(
    identifier: string,
    mutator: (d: ScanDraft) => void,
    shopId?: string,
    userId?: string,
    matchByTxId: boolean = false
  ): void {
    // If specific shopId provided, inspect that key first
    const candidateKeys: string[] = [];
    if (shopId && userId) {
      const targetKey = this.getStorageKey(shopId, userId);
      if (targetKey) candidateKeys.push(targetKey);
    }
    // Also scan any active workspace keys if not found
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(WORKSPACE_KEY_PREFIX) || k === LEGACY_STORAGE_KEY)) {
        if (!candidateKeys.includes(k)) candidateKeys.push(k);
      }
    }

    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const ws: ScanWorkspace = JSON.parse(raw);
        if (!ws || !ws.drafts) continue;

        const target = ws.drafts.find((d) => (matchByTxId ? d.transactionId === identifier : d.id === identifier));
        if (target) {
          mutator(target);
          this.saveWorkspace(ws);
          return;
        }
      } catch {
        // Continue
      }
    }
  }
}
