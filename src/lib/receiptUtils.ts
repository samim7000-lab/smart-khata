import { Transaction, ReceiptDetailsPayload, Customer, Shop } from '../types';
import { formatShopCurrency } from './countryPricing';

/**
 * Clean any internal structured metadata or RECEIPT_JSON tags from note string
 */
export function cleanNoteString(rawNote?: string): string {
  if (!rawNote) return '';
  return rawNote
    .replace(/\[?RECEIPT_JSON:[\s\S]*?\]?/gi, '')
    .replace(/\{"mode":[\s\S]*?\}/gi, '')
    .trim();
}

/**
 * Embed receipt details JSON string cleanly into transaction note
 */
export function packReceiptNote(userNote: string, details?: ReceiptDetailsPayload): string {
  const cleanNote = cleanNoteString(userNote);
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
  const noteText = cleanNoteString(tx.note);

  if (tx.receipt_details) {
    return {
      noteText,
      details: tx.receipt_details,
    };
  }

  const rawNote = tx.note || '';
  const match = rawNote.match(/\[?RECEIPT_JSON:([\s\S]*?)\]?/i);
  if (match && match[1]) {
    try {
      const parsed: ReceiptDetailsPayload = JSON.parse(match[1]);
      return { noteText, details: parsed };
    } catch (e) {
      console.warn('Failed to parse receipt details JSON from note tag:', e);
    }
  } else {
    // Attempt parsing rawNote if it looks like raw JSON
    const trimmed = rawNote.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed: ReceiptDetailsPayload = JSON.parse(trimmed);
        return { noteText, details: parsed };
      } catch {}
    }
  }

  return { noteText, details: null };
}

/**
 * Return clean human-facing note text for a transaction, stripped of all internal metadata tags
 */
export function getCleanTransactionNote(tx: Transaction): string {
  return unpackReceiptNote(tx).noteText;
}

/**
 * Reconstruct a canonical, unified ReceiptDetailsPayload for a transaction
 * Guarantees that live transactions and historical transactions render IDENTICALLY.
 */
export function getCanonicalReceiptDetails(
  tx: Transaction,
  customer?: Customer,
  shop?: Shop
): ReceiptDetailsPayload {
  const { noteText, details } = unpackReceiptNote(tx);
  if (details) {
    return details;
  }

  const isCredit = tx.type === 'credit_given';
  const isPurePayment = tx.type === 'payment_received';
  const txAmt = Number(tx.amount) || 0;
  const hasTax = Boolean(tx.tax_amount && tx.tax_amount > 0);
  const isGstEnabled = Boolean(hasTax || (shop && shop.gst_enabled));

  const docType = isPurePayment
    ? (isGstEnabled ? 'payment_receipt' : 'receipt')
    : isGstEnabled
      ? (shop?.gst_registration_type === 'composition' ? 'bill_of_supply' : 'tax_invoice')
      : 'receipt';

  return {
    mode: isPurePayment ? 'due_payment' : (isCredit ? 'credit_sale' : 'cash_sale'),
    items: [
      {
        id: 'canonical-item',
        name: noteText || (isCredit ? 'General Goods Purchase' : 'Payment Clearance'),
        quantity: 1,
        unit_price: tx.base_amount || txAmt,
        total: txAmt,
      },
    ],
    subtotal: tx.base_amount || txAmt,
    taxable_amount: tx.base_amount || txAmt,
    discount_amount: 0,
    paid_amount: isPurePayment ? txAmt : 0,
    new_due_amount: isCredit ? txAmt : 0,
    gst_enabled: isGstEnabled,
    document_type: docType,
    customer_address: customer?.address || customer?.state,
    customer_gstin: customer?.gstin,
    customer_state: customer?.state,
    cgst_amount: tx.cgst_amount || 0,
    sgst_amount: tx.sgst_amount || 0,
    igst_amount: tx.igst_amount || 0,
    supplier_gstin: shop?.gst_number,
    receipt_number: `INV-${tx.id.replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6)}`,
  };
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
