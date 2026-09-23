import { Shop, Customer, GstDocumentType, InvoiceItem, InvoiceRecord, ReceiptItem, TaxType } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

// ====================================================
// 1. INDIAN GST STATE CODES & STATUTORY MAPPINGS
// ====================================================

export interface GstStateInfo {
  code: string;
  name: string;
}

export const INDIAN_GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

// Statutory notice for Composition Dealers
export const COMPOSITION_STATUTORY_DECLARATION =
  'Composition taxable person, not eligible to collect tax on supplies';

/**
 * Resolve state code from state name or code
 */
export const getStateCode = (stateNameOrCode?: string): string | undefined => {
  if (!stateNameOrCode) return undefined;
  const clean = stateNameOrCode.trim();
  if (INDIAN_GST_STATES[clean]) return clean;

  const lower = clean.toLowerCase();
  for (const [code, name] of Object.entries(INDIAN_GST_STATES)) {
    if (name.toLowerCase() === lower || name.toLowerCase().includes(lower)) {
      return code;
    }
  }
  return undefined;
};

/**
 * Resolve state name from state code
 */
export const getStateName = (code?: string): string | undefined => {
  if (!code) return undefined;
  return INDIAN_GST_STATES[code.trim()];
};

/**
 * Extract 2-digit GST state code from 15-character GSTIN
 */
export const getStateCodeFromGstin = (gstin?: string): string | undefined => {
  if (!gstin) return undefined;
  const clean = gstin.trim().toUpperCase();
  if (clean.length >= 2) {
    const code = clean.substring(0, 2);
    if (/^[0-9]{2}$/.test(code) && INDIAN_GST_STATES[code]) {
      return code;
    }
  }
  return undefined;
};

/**
 * Validate 15-character Indian GSTIN format
 * Pattern: 2 digits (State Code) + 5 chars (PAN) + 4 digits + 1 char + 1 char/digit + 'Z' + 1 checksum digit/char
 */
export const validateGstin = (
  gstin?: string
): { isValid: boolean; stateCode?: string; stateName?: string; error?: string } => {
  if (!gstin || !gstin.trim()) {
    return { isValid: false, error: 'GSTIN is empty' };
  }
  const clean = gstin.trim().toUpperCase();
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) {
    return {
      isValid: false,
      error: 'Invalid GSTIN format. Expected: 2-digit state code + PAN + 1 entity + Z + checksum (e.g. 19ABCDE1234F1Z5)',
    };
  }
  const stateCode = clean.substring(0, 2);
  const stateName = INDIAN_GST_STATES[stateCode];
  if (!stateName) {
    return { isValid: false, error: `Invalid GST state code: ${stateCode}` };
  }
  return { isValid: true, stateCode, stateName };
};

// ====================================================
// 2. FINANCIAL YEAR HELPER (1 April – 31 March)
// ====================================================

export interface FinancialYearResult {
  full: string;  // e.g. "2026-27"
  short: string; // e.g. "26-27"
}

export const getFinancialYear = (dateInput?: Date | string): FinancialYearResult => {
  const d = dateInput ? (typeof dateInput === 'string' ? new Date(dateInput) : dateInput) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed: 0 = Jan, 3 = April, 11 = Dec

  let startYear: number;
  let endYear: number;

  if (month >= 3) {
    // April to December -> current year to next year (e.g. Apr 2026 -> 2026-27)
    startYear = year;
    endYear = year + 1;
  } else {
    // January to March -> previous year to current year (e.g. Feb 2026 -> 2025-26)
    startYear = year - 1;
    endYear = year;
  }

  const shortStart = String(startYear).slice(-2);
  const shortEnd = String(endYear).slice(-2);

  return {
    full: `${startYear}-${shortEnd}`,
    short: `${shortStart}-${shortEnd}`,
  };
};

// ====================================================
// 3. DETERMINISTIC DOCUMENT TYPE RESOLVER
// ====================================================

export const resolveDocumentType = (params: {
  gstEnabled: boolean;
  txMode?: string;
  txType?: string;
  isComposition?: boolean;
}): GstDocumentType => {
  const { gstEnabled, txMode, txType, isComposition } = params;

  // Non-GST merchants always receive standard simple receipt
  if (!gstEnabled) {
    return 'receipt';
  }

  // Debt collection / Due payments NEVER recalculate GST
  if (txMode === 'due_payment' || txType === 'payment_received') {
    return 'payment_receipt';
  }

  // Composition taxpayers issue Bill of Supply (0% tax)
  if (isComposition) {
    return 'bill_of_supply';
  }

  // Regular GST sales issue Tax Invoice
  return 'tax_invoice';
};

// ====================================================
// 4. TAX & INVOICE CALCULATOR
// ====================================================

export interface CalculationInput {
  items: (ReceiptItem | InvoiceItem)[];
  fallbackAmount?: number;
  defaultGstRate: number;
  isGstEnabled: boolean;
  isComposition: boolean;
  isInterState: boolean;
  discountAmount?: number;
  priceMode?: 'inclusive' | 'exclusive';
  documentType: GstDocumentType;
}

export interface CalculationSummary {
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  discountAmount: number;
  grandTotal: number;
  calculatedItems: InvoiceItem[];
  supplyType: 'intra' | 'inter';
}

export const calculateInvoiceSummary = (input: CalculationInput): CalculationSummary => {
  const {
    items,
    fallbackAmount = 0,
    defaultGstRate,
    isGstEnabled,
    isComposition,
    isInterState,
    discountAmount = 0,
    priceMode = 'inclusive',
    documentType,
  } = input;

  const supplyType: 'intra' | 'inter' = isInterState ? 'inter' : 'intra';

  // Rule 1: Payment receipts and non-GST have ZERO tax
  if (documentType === 'payment_receipt' || documentType === 'receipt' || !isGstEnabled) {
    const rawTotal = items.length > 0 ? items.reduce((sum, i) => sum + i.total, 0) : fallbackAmount;
    const finalTotal = Math.max(0, rawTotal - discountAmount);
    return {
      taxableAmount: finalTotal,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
      discountAmount,
      grandTotal: finalTotal,
      calculatedItems: items.map((item) => ({
        id: item.id || `item-${Date.now()}`,
        name: item.name,
        hsn_sac: item.hsn_sac,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_rate: 0,
        taxable_amount: item.total,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total: item.total,
      })),
      supplyType,
    };
  }

  // Rule 2: Composition Dealers issue Bill of Supply at 0% tax
  if (isComposition || documentType === 'bill_of_supply') {
    const rawTotal = items.length > 0 ? items.reduce((sum, i) => sum + i.total, 0) : fallbackAmount;
    const finalTotal = Math.max(0, rawTotal - discountAmount);
    return {
      taxableAmount: finalTotal,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
      discountAmount,
      grandTotal: finalTotal,
      calculatedItems: items.map((item) => ({
        id: item.id || `item-${Date.now()}`,
        name: item.name,
        hsn_sac: item.hsn_sac,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_rate: 0,
        taxable_amount: item.total,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total: item.total,
      })),
      supplyType,
    };
  }

  // Rule 3: Regular Tax Invoice with item-by-item or fallback calculation
  const calculatedItems: InvoiceItem[] = [];
  let sumTaxable = 0;
  let sumCgst = 0;
  let sumSgst = 0;
  let sumIgst = 0;
  let sumTotal = 0;

  if (items.length > 0) {
    items.forEach((item) => {
      const rate = item.gst_rate !== undefined ? item.gst_rate : defaultGstRate;
      let itemTaxable = 0;
      let itemTax = 0;
      let itemTotal = item.total;

      if (rate <= 0) {
        itemTaxable = itemTotal;
        itemTax = 0;
      } else if (priceMode === 'inclusive') {
        itemTaxable = Math.round((itemTotal / (1 + rate / 100)) * 100) / 100;
        itemTax = Math.round((itemTotal - itemTaxable) * 100) / 100;
      } else {
        // Exclusive mode
        itemTaxable = itemTotal;
        itemTax = Math.round(((itemTaxable * rate) / 100) * 100) / 100;
        itemTotal = Math.round((itemTaxable + itemTax) * 100) / 100;
      }

      let itemCgst = 0;
      let itemSgst = 0;
      let itemIgst = 0;

      if (isInterState) {
        itemIgst = itemTax;
      } else {
        itemCgst = Math.round((itemTax / 2) * 100) / 100;
        itemSgst = Math.round((itemTax - itemCgst) * 100) / 100;
      }

      calculatedItems.push({
        id: item.id || `item-${Date.now()}`,
        name: item.name,
        hsn_sac: item.hsn_sac,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_rate: rate,
        taxable_amount: itemTaxable,
        cgst_amount: itemCgst,
        sgst_amount: itemSgst,
        igst_amount: itemIgst,
        total: itemTotal,
      });

      sumTaxable += itemTaxable;
      sumCgst += itemCgst;
      sumSgst += itemSgst;
      sumIgst += itemIgst;
      sumTotal += itemTotal;
    });
  } else {
    // Fallback amount
    const rate = defaultGstRate;
    let base = fallbackAmount;
    let tax = 0;
    let total = fallbackAmount;

    if (rate > 0) {
      if (priceMode === 'inclusive') {
        base = Math.round((fallbackAmount / (1 + rate / 100)) * 100) / 100;
        tax = Math.round((fallbackAmount - base) * 100) / 100;
      } else {
        base = fallbackAmount;
        tax = Math.round(((base * rate) / 100) * 100) / 100;
        total = Math.round((base + tax) * 100) / 100;
      }
    }

    if (isInterState) {
      sumIgst = tax;
    } else {
      sumCgst = Math.round((tax / 2) * 100) / 100;
      sumSgst = Math.round((tax - sumCgst) * 100) / 100;
    }

    sumTaxable = base;
    sumTotal = total;
  }

  // Apply overall discount if any
  const finalGrandTotal = Math.max(0, sumTotal - discountAmount);
  const totalTaxAmount = Math.round((sumCgst + sumSgst + sumIgst) * 100) / 100;

  return {
    taxableAmount: Math.round(sumTaxable * 100) / 100,
    cgstAmount: Math.round(sumCgst * 100) / 100,
    sgstAmount: Math.round(sumSgst * 100) / 100,
    igstAmount: Math.round(sumIgst * 100) / 100,
    totalTaxAmount,
    discountAmount,
    grandTotal: Math.round(finalGrandTotal * 100) / 100,
    calculatedItems,
    supplyType,
  };
};

// ====================================================
// 5. ATOMIC INVOICE NUMBER ALLOCATOR (RPC + FALLBACK)
// ====================================================

export const formatInvoiceNumber = (series: string, shortFy: string, seqNum: number): string => {
  const cleanSeries = (series || 'INV').trim().toUpperCase();
  const padded = String(seqNum).padStart(6, '0');
  return `${cleanSeries}/${shortFy}/${padded}`;
};

/**
 * Allocate consecutive sequential invoice number
 * Uses PostgreSQL atomic RPC when online & authenticated.
 * Falls back to locally synchronized monotonic counter when offline.
 */
export const allocateInvoiceNumber = async (
  shop: Shop,
  financialYear?: FinancialYearResult,
  series?: string
): Promise<string> => {
  const fy = financialYear || getFinancialYear();
  const invoiceSeries = (series || shop.invoice_series || 'INV').trim().toUpperCase();

  // Try server RPC
  if (isSupabaseConfigured && supabase && !shop.id.startsWith('shop-temp-')) {
    try {
      const { data, error } = await supabase.rpc('get_next_invoice_number', {
        p_shop_id: shop.id,
        p_financial_year: fy.full,
        p_series: invoiceSeries,
      });

      if (!error && data && data.invoice_number) {
        console.log(`[INVOICE-ENGINE] Server allocated invoice number: ${data.invoice_number}`);
        return data.invoice_number;
      }
      if (error) {
        console.warn('[INVOICE-ENGINE] RPC call returned error, proceeding to resilient local fallback:', error.message);
      }
    } catch (err: any) {
      console.warn('[INVOICE-ENGINE] Exception during RPC call, using resilient fallback:', err.message);
    }
  }

  // Resilient Local Monotonic Counter Fallback
  const storageKey = `sk_inv_seq_${shop.id}_${fy.full}_${invoiceSeries}`;
  let currentSeq = 1;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        currentSeq = parsed + 1;
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(currentSeq));
    }
  } catch (storageErr) {
    console.warn('[INVOICE-ENGINE] LocalStorage counter unavailable:', storageErr);
  }

  const generated = formatInvoiceNumber(invoiceSeries, fy.short, currentSeq);
  console.log(`[INVOICE-ENGINE] Fallback generated invoice number: ${generated}`);
  return generated;
};

// ====================================================
// 6. INVOICE RECORD PERSISTENCE
// ====================================================

export const persistInvoiceRecord = async (
  invoice: InvoiceRecord
): Promise<{ success: boolean; data?: any; error?: string }> => {
  if (!isSupabaseConfigured || !supabase || invoice.shop_id.startsWith('shop-temp-')) {
    return { success: true };
  }

  try {
    const payload: any = {
      shop_id: invoice.shop_id,
      customer_id: invoice.customer_id,
      transaction_id: invoice.transaction_id,
      document_type: invoice.document_type,
      financial_year: invoice.financial_year,
      invoice_series: invoice.invoice_series,
      invoice_number: invoice.invoice_number,
      supply_type: invoice.supply_type,
      place_of_supply: invoice.place_of_supply,
      reverse_charge: invoice.reverse_charge || false,
      supplier_legal_name: invoice.supplier_legal_name,
      supplier_address: invoice.supplier_address,
      supplier_gstin: invoice.supplier_gstin,
      supplier_state: invoice.supplier_state,
      supplier_state_code: invoice.supplier_state_code,
      recipient_name: invoice.recipient_name,
      recipient_address: invoice.recipient_address,
      recipient_gstin: invoice.recipient_gstin,
      recipient_state: invoice.recipient_state,
      recipient_state_code: invoice.recipient_state_code,
      taxable_amount: invoice.taxable_amount,
      cgst_amount: invoice.cgst_amount,
      sgst_amount: invoice.sgst_amount,
      igst_amount: invoice.igst_amount,
      total_tax_amount: invoice.total_tax_amount,
      discount_amount: invoice.discount_amount,
      grand_total: invoice.grand_total,
      items: invoice.items,
      notes: invoice.notes,
      status: invoice.status || 'issued',
    };

    const { data, error } = await supabase.from('invoices').insert(payload).select().single();
    if (error) {
      console.warn('[INVOICE-ENGINE] Invoices table insert failed (schema may need v19 migration):', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    console.warn('[INVOICE-ENGINE] Invoices table exception:', err.message);
    return { success: false, error: err.message };
  }
};
