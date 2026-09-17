/**
 * SMART KHATA — CONFIRMED RECEIPT QUEUE ARCHITECTURE
 *
 * Provides a reliable, persistent queue for confirmed transaction receipts.
 * Designed to cleanly decouple transaction confirmation from receipt delivery:
 * 1. Immediate path (active today): Merchant clicks "Send on WhatsApp" to open wa.me direct chat.
 * 2. Asynchronous path (future-ready): Background worker / WhatsApp Cloud API / Webhook queue
 *    can process pending items without altering the immediate merchant flow.
 */

export interface QueuedReceipt {
  id: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  phone: string;
  receiptText: string;
  shopId: string;
  amount: number;
  type: 'credit_given' | 'payment_received' | string;
  status: 'pending' | 'dispatched' | 'cancelled';
  createdAt: string;
  dispatchedAt?: string;
  error?: string;
}

const QUEUE_STORAGE_KEY = 'smart_khata_receipt_queue_v1';

class ReceiptQueueManager {
  private getQueue(): QueuedReceipt[] {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[RECEIPT-QUEUE] Error reading queue from storage:', e);
      return [];
    }
  }

  private saveQueue(queue: QueuedReceipt[]): void {
    try {
      // Keep up to 200 most recent records to prevent unlimited storage growth
      const trimmed = queue.slice(-200);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[RECEIPT-QUEUE] Error saving queue to storage:', e);
    }
  }

  /**
   * Adds a confirmed transaction receipt to the outbound queue.
   */
  public enqueueReceipt(payload: Omit<QueuedReceipt, 'id' | 'createdAt' | 'status'>): QueuedReceipt {
    const queue = this.getQueue();
    const item: QueuedReceipt = {
      ...payload,
      id: `rcpt-queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    queue.push(item);
    this.saveQueue(queue);
    console.log(`[RECEIPT-QUEUE] Enqueued receipt ${item.id} for ${item.customerName} (${item.phone})`);
    return item;
  }

  /**
   * Retrieves pending receipts, optionally filtered by shop ID.
   */
  public getPendingReceipts(shopId?: string): QueuedReceipt[] {
    const queue = this.getQueue();
    return queue.filter((item) => item.status === 'pending' && (!shopId || item.shopId === shopId));
  }

  /**
   * Marks a receipt as dispatched (e.g. after successful WhatsApp navigation or Cloud API call).
   */
  public markReceiptDispatched(id: string): void {
    const queue = this.getQueue();
    const item = queue.find((i) => i.id === id);
    if (item) {
      item.status = 'dispatched';
      item.dispatchedAt = new Date().toISOString();
      this.saveQueue(queue);
      console.log(`[RECEIPT-QUEUE] Marked receipt ${id} as dispatched`);
    }
  }

  /**
   * Marks a receipt as cancelled.
   */
  public cancelReceipt(id: string): void {
    const queue = this.getQueue();
    const item = queue.find((i) => i.id === id);
    if (item) {
      item.status = 'cancelled';
      this.saveQueue(queue);
    }
  }

  /**
   * Returns overview metrics of the outbound receipt queue.
   */
  public getQueueStats(shopId?: string): { pending: number; dispatched: number; total: number } {
    const queue = shopId ? this.getQueue().filter((i) => i.shopId === shopId) : this.getQueue();
    const pending = queue.filter((i) => i.status === 'pending').length;
    const dispatched = queue.filter((i) => i.status === 'dispatched').length;
    return { pending, dispatched, total: queue.length };
  }

  /**
   * Cleans up already dispatched and cancelled receipts older than 7 days.
   */
  public pruneOldReceipts(): void {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const queue = this.getQueue().filter((item) => {
      if (item.status === 'pending') return true;
      const createdTime = new Date(item.createdAt).getTime();
      return createdTime > sevenDaysAgo;
    });
    this.saveQueue(queue);
  }
}

export const receiptQueueService = new ReceiptQueueManager();
