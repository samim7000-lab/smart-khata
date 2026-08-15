import { TaxType, GstPriceMode } from '../types';

export interface GstCalculationResult {
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxType: TaxType;
  priceMode: GstPriceMode;
}

export const ALLOWED_GST_RATES = [0, 5, 12, 18, 28];

export const calculateGst = (
  enteredAmount: number,
  gstRate: number,
  isGstEnabled: boolean,
  shopState?: string,
  customerState?: string,
  priceMode: GstPriceMode = 'exclusive'
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
      priceMode,
    };
  }

  const normShopState = (shopState || '').trim().toLowerCase();
  const normCustState = (customerState || '').trim().toLowerCase();
  const isSameState = normShopState !== '' && normCustState !== '' && normShopState === normCustState;
  const taxType: TaxType = isSameState ? 'intra' : 'inter';

  let baseAmount = 0;
  let taxAmount = 0;
  let totalAmount = 0;

  if (priceMode === 'inclusive') {
    // Total is entered amount. Base = Total / (1 + rate/100)
    totalAmount = cleanAmount;
    baseAmount = Math.round((totalAmount / (1 + gstRate / 100)) * 100) / 100;
    taxAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
  } else {
    // Exclusive mode: Base is entered amount. Total = Base + Tax
    baseAmount = cleanAmount;
    taxAmount = Math.round(((baseAmount * gstRate) / 100) * 100) / 100;
    totalAmount = Math.round((baseAmount + taxAmount) * 100) / 100;
  }

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
      priceMode,
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
    priceMode,
  };
};

// Automated Calculation Tests
export const runGstCalculationSelfTest = (): boolean => {
  // Test 1: Disabled GST
  const res1 = calculateGst(1000, 18, false, 'West Bengal', 'West Bengal');
  if (res1.taxAmount !== 0 || res1.totalAmount !== 1000 || res1.taxType !== 'none') return false;

  // Test 2: Intra-State 18% GST Exclusive (WB to WB)
  const res2 = calculateGst(1000, 18, true, 'West Bengal', 'West Bengal', 'exclusive');
  if (res2.taxType !== 'intra' || res2.taxAmount !== 180 || res2.cgstAmount !== 90 || res2.sgstAmount !== 90) return false;

  // Test 3: Inter-State 18% GST Exclusive (WB to Delhi)
  const res3 = calculateGst(1000, 18, true, 'West Bengal', 'Delhi', 'exclusive');
  if (res3.taxType !== 'inter' || res3.taxAmount !== 180 || res3.igstAmount !== 180 || res3.cgstAmount !== 0) return false;

  // Test 4: GST Inclusive 2% (₹400 total) -> Base = 392.16, Tax = 7.84, Total = 400
  const res4 = calculateGst(400, 2, true, 'West Bengal', 'West Bengal', 'inclusive');
  if (res4.baseAmount !== 392.16 || res4.taxAmount !== 7.84 || res4.totalAmount !== 400) return false;

  // Test 5: GST Exclusive 2% (₹400 base) -> Base = 400, Tax = 8, Total = 408
  const res5 = calculateGst(400, 2, true, 'West Bengal', 'West Bengal', 'exclusive');
  if (res5.baseAmount !== 400 || res5.taxAmount !== 8 || res5.totalAmount !== 408) return false;

  console.log('[GST_ENGINE] Self-test passed cleanly including inclusive & exclusive price modes!');
  return true;
};

runGstCalculationSelfTest();
