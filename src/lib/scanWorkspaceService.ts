/**
 * SMART KHATA — PERSISTED SCAN WORKSPACE SERVICE
 *
 * Provides temporary on-device persistence for multi-draft AI ledger scans.
 * Ensures the review batch is preserved when the merchant navigates to WhatsApp (wa.me)
 * and returns, or when the Android OS pauses/resumes the app.
 *
 * PRIVACY & SAFETY INVARIANTS:
 * 1. 24-hour TTL (Time-To-Live) with automatic cleanup.
 * 2. Never stores raw base64 images or authentication secrets.
 * 3. Scoped strictly to the active shopId (cross-shop tenant isolation).
 * 4. Idempotency: drafts mark saveStatus = 'saved' and record transactionId, preventing duplicate DB writes.
 * 5. Persisting a workspace DOES NOT create a financial transaction.
 */

import { Customer, TransactionType } from '../types';
import { GeminiOcrItem } from './geminiUtils';
import { IdentityStatus } from './customerIdentityResolver';

export type BadgeState = 'detected' | 'check' | 'manual';

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
  whatsappStatus: 'pending' | 'sent';
  transactionId?: string;
  receiptId?: string;
}

export interface ScanWorkspace {
  workspaceId: string;
  shopId: string;
  createdAt: string;
  lastUpdatedAt: string;
  drafts: ScanDraft[];
  activeDraftIndex: number;
  status: 'in_progress' | 'completed' | 'abandoned';
}

const WORKSPACE_STORAGE_KEY = 'smart_khata_scan_workspace_v1';
const WORKSPACE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ScanWorkspaceService {
  /**
   * Saves the active scan workspace to local storage.
   */
  public static saveWorkspace(workspace: ScanWorkspace): void {
    try {
      if (!workspace || !workspace.drafts || workspace.drafts.length === 0) {
        this.clearWorkspace();
        return;
      }

      // Check if all drafts are saved; if so, mark completed
      const allSaved = workspace.drafts.every((d) => d.saveStatus === 'saved');
      const sanitized: ScanWorkspace = {
        workspaceId: workspace.workspaceId,
        shopId: workspace.shopId,
        createdAt: workspace.createdAt || new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        drafts: workspace.drafts.map((d) => ({
          ...d,
          // Guarantee clean serializable object
          candidates: (d.candidates || []).slice(0, 5),
        })),
        activeDraftIndex: Math.max(0, Math.min(workspace.activeDraftIndex, workspace.drafts.length - 1)),
        status: allSaved ? 'completed' : workspace.status || 'in_progress',
      };

      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error saving workspace:', e);
    }
  }

  /**
   * Loads the active scan workspace for a specific shop, checking TTL.
   */
  public static loadWorkspace(shopId: string): ScanWorkspace | null {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) return null;

      const workspace: ScanWorkspace = JSON.parse(raw);
      if (!workspace || !workspace.workspaceId || !workspace.drafts) {
        this.clearWorkspace();
        return null;
      }

      // 1. Tenant Isolation: Shop must match
      if (workspace.shopId !== shopId) {
        return null;
      }

      // 2. TTL Expiry Check (24 hours)
      const lastUpdated = new Date(workspace.lastUpdatedAt || workspace.createdAt).getTime();
      if (Date.now() - lastUpdated > WORKSPACE_TTL_MS) {
        console.log('[SCAN-WORKSPACE] Expired workspace cleared (exceeded 24h TTL)');
        this.clearWorkspace();
        return null;
      }

      // 3. Completed workspace cleanup
      if (workspace.status === 'completed') {
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
  public static markDraftSaved(draftId: string, transactionId?: string): void {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) return;

      const workspace: ScanWorkspace = JSON.parse(raw);
      if (!workspace || !workspace.drafts) return;

      const target = workspace.drafts.find((d) => d.id === draftId);
      if (target) {
        target.saveStatus = 'saved';
        target.confirmed = true;
        target.transactionId = transactionId;
      }

      this.saveWorkspace(workspace);
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error marking draft saved:', e);
    }
  }

  /**
   * Marks a specific draft as sent via WhatsApp in the workspace.
   */
  public static markDraftSent(draftId: string): void {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) return;

      const workspace: ScanWorkspace = JSON.parse(raw);
      if (!workspace || !workspace.drafts) return;

      const target = workspace.drafts.find((d) => d.id === draftId);
      if (target) {
        target.whatsappStatus = 'sent';
      }

      this.saveWorkspace(workspace);
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error marking draft sent:', e);
    }
  }

  /**
   * Marks a draft as sent via WhatsApp using its recorded transaction ID.
   */
  public static markDraftSentByTransactionId(txId: string): void {
    try {
      if (!txId) return;
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) return;

      const workspace: ScanWorkspace = JSON.parse(raw);
      if (!workspace || !workspace.drafts) return;

      const target = workspace.drafts.find((d) => d.transactionId === txId);
      if (target) {
        target.whatsappStatus = 'sent';
        this.saveWorkspace(workspace);
      }
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error marking draft sent by tx ID:', e);
    }
  }

  /**
   * Clears the current scan workspace.
   */
  public static clearWorkspace(): void {
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } catch (e) {
      console.warn('[SCAN-WORKSPACE] Error clearing workspace:', e);
    }
  }

  /**
   * Checks if an active uncompleted workspace exists for a shop.
   */
  public static hasActiveWorkspace(shopId: string): boolean {
    const ws = this.loadWorkspace(shopId);
    return Boolean(ws && ws.drafts.some((d) => d.saveStatus !== 'saved'));
  }
}
