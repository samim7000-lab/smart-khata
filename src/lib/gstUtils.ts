import { TaxType } from '../types';

export interface GstCalculationResult {
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxType: TaxType;
}

export const ALLOWED_GST_RATES = [0, 5, 12, 18, 28];

export const calculateGst = (
  enteredAmount: number,
  gstRate: number,
  isGstEnabled: boolean,
  shopState?: string,
  customerState?: string
): GstCalculationResult => {
  const cleanAmount = Math.max(0, enteredAmount);

  if (!isGstEnabled || !gstRate || gstRate <= 0) {
    return {
      baseAmount: cleanAmount,
      taxAmount: 0,
      totalAmount: cleanAmount,
      gstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxType: 'none',
    };
  }

  const normShopState = (shopState || '').trim().toLowerCase();
  const normCustState = (customerState || '').trim().toLowerCase();

  // If both states are known and match -> Intra-state (CGST + SGST)
  // If either state is unknown or they differ -> Inter-state (IGST)
  const isSameState = normShopState !== '' && normCustState !== '' && normShopState === normCustState;
  const taxType: TaxType = isSameState ? 'intra' : 'inter';

  const rawTax = (cleanAmount * gstRate) / 100;
  const taxAmount = Math.round(rawTax * 100) / 100;
  const baseAmount = cleanAmount;
  const totalAmount = Math.round((baseAmount + taxAmount) * 100) / 100;

  if (taxType === 'intra') {
    const halfTax = Math.round((taxAmount / 2) * 100) / 100;
    return {
      baseAmount,
      taxAmount,
      totalAmount,
      gstRate,
      cgstAmount: halfTax,
      sgstAmount: Math.round((taxAmount - halfTax) * 100) / 100,
      igstAmount: 0,
      taxType: 'intra',
    };
  }

  return {
    baseAmount,
    taxAmount,
    totalAmount,
    gstRate,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: taxAmount,
    taxType: 'inter',
  };
};

// Automated Calculation Tests
export const runGstCalculationSelfTest = (): boolean => {
  // Test 1: Disabled GST
  const res1 = calculateGst(1000, 18, false, 'West Bengal', 'West Bengal');
  if (res1.taxAmount !== 0 || res1.totalAmount !== 1000 || res1.taxType !== 'none') return false;

  // Test 2: Intra-State 18% GST (WB to WB)
  const res2 = calculateGst(1000, 18, true, 'West Bengal', 'West Bengal');
  if (res2.taxType !== 'intra' || res2.taxAmount !== 180 || res2.cgstAmount !== 90 || res2.sgstAmount !== 90) return false;

  // Test 3: Inter-State 18% GST (WB to Delhi)
  const res3 = calculateGst(1000, 18, true, 'West Bengal', 'Delhi');
  if (res3.taxType !== 'inter' || res3.taxAmount !== 180 || res3.igstAmount !== 180 || res3.cgstAmount !== 0) return false;

  console.log('[GST_ENGINE] Self-test passed cleanly!');
  return true;
};

runGstCalculationSelfTest();
