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
  priceMode: GstPriceMode = 'inclusive'
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
    // Total is entered final selling amount. Taxable Base = Total / (1 + rate/100)
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

  // Test 2: GST 18% INCLUDED (₹500 total) -> Taxable = 423.73, Tax = 76.27, Total = 500
  const res2 = calculateGst(500, 18, true, 'West Bengal', 'West Bengal', 'inclusive');
  if (res2.baseAmount !== 423.73 || res2.taxAmount !== 76.27 || res2.totalAmount !== 500) return false;

  // Test 3: GST 5% INCLUDED (₹1000 total) -> Taxable = 952.38, Tax = 47.62, Total = 1000
  const res3 = calculateGst(1000, 5, true, 'West Bengal', 'Delhi', 'inclusive');
  if (res3.baseAmount !== 952.38 || res3.taxAmount !== 47.62 || res3.totalAmount !== 1000) return false;

  // Test 4: GST 28% INCLUDED (₹1000 total) -> Taxable = 781.25, Tax = 218.75, Total = 1000
  const res4 = calculateGst(1000, 28, true, 'West Bengal', 'West Bengal', 'inclusive');
  if (res4.baseAmount !== 781.25 || res4.taxAmount !== 218.75 || res4.totalAmount !== 1000) return false;

  console.log('[GST_ENGINE] All 4 GST-Inclusive self-test cases passed cleanly!');
  return true;
};

runGstCalculationSelfTest();
