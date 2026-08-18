import { Transaction, ReceiptDetailsPayload, Customer, Shop } from '../types';
import { formatShopCurrency } from './countryPricing';

/**
 * Embed receipt details JSON string cleanly into transaction note
 */
export function packReceiptNote(userNote: string, details?: ReceiptDetailsPayload): string {
  const cleanNote = userNote.trim();
  if (!details) {
    return cleanNote;
  }
  const jsonStr = JSON.stringify(details);
  return cleanNote ? `${cleanNote} [RECEIPT_JSON:${jsonStr}]` : `[RECEIPT_JSON:${jsonStr}]`;
}

/**
 * Extract user-facing note text and parse structured ReceiptDetailsPayload
 */
export function unpackReceiptNote(tx: Transaction): { noteText: string; details: ReceiptDetailsPayload | null } {
  if (tx.receipt_details) {
    return {
      noteText: (tx.note || '').replace(/\[RECEIPT_JSON:[\s\S]*?\]/g, '').trim(),
      details: tx.receipt_details,
    };
  }

  const rawNote = tx.note || '';
  const match = rawNote.match(/\[RECEIPT_JSON:([\s\S]*?)\]/);
  if (match && match[1]) {
    try {
      const parsed: ReceiptDetailsPayload = JSON.parse(match[1]);
      const noteText = rawNote.replace(/\[RECEIPT_JSON:[\s\S]*?\]/g, '').trim();
      return { noteText, details: parsed };
    } catch (e) {
      console.warn('Failed to parse receipt details JSON:', e);
    }
  }

  return { noteText: rawNote.trim(), details: null };
}

/**
 * Deterministically calculate customer previous balance before a specific transaction
 */
export function calculatePreviousBalance(
  tx: Transaction,
  customer: Customer,
  allTransactions: Transaction[]
): number {
  if (tx.receipt_details?.previous_balance !== undefined) {
    return tx.receipt_details.previous_balance;
  }

  // Filter non-voided transactions for this customer created BEFORE this transaction
  const custTxs = allTransactions.filter((t) => {
    if (t.customer_id !== customer.id || t.is_voided || t.id === tx.id) return false;
    const tTime = new Date(t.created_at).getTime();
    const txTime = new Date(tx.created_at).getTime();
    if (isNaN(tTime) || isNaN(txTime)) return false;
    return tTime < txTime;
  });

  if (custTxs.length === 0) {
    // FIRST TRANSACTION EVER -> MUST BE ZERO!
    return 0;
  }

  // Sum earlier transactions
  let prevBal = 0;
  custTxs.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'credit_given') {
      prevBal += amt;
    } else if (t.type === 'payment_received') {
      prevBal -= amt;
    }
  });

  return Math.round(prevBal * 100) / 100;
}
