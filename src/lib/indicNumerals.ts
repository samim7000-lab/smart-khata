/**
 * SMART KHATA — INDIC NUMERAL & FINANCIAL AMOUNT NORMALIZER
 * 
 * Safely converts Bengali (বাংলা) and Hindi/Devanagari (देवनागरी) numerals
 * to standard ASCII digits (0-9) and validates financial amounts.
 * 
 * Deterministic only — Zero AI guessing.
 */

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

/**
 * Normalizes all Bengali and Devanagari digits in a string to standard 0-9 digits.
 * Strips currency symbols (₹, ৳, Rs, TK, etc.), commas, and extra whitespace.
 * 
 * Examples:
 *   "১৫০০"   -> "1500"
 *   "১,৫০০"  -> "1500"
 *   "१५००"   -> "1500"
 *   "₹1,500" -> "1500"
 *   "৳ 500"  -> "500"
 */
export function normalizeIndicDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  let str = String(input).trim();
  if (!str) return '';

  // 1. Convert Bengali numerals
  str = str.replace(/[০-৯]/g, (char) => {
    const idx = BENGALI_DIGITS.indexOf(char);
    return idx !== -1 ? String(idx) : char;
  });

  // 2. Convert Devanagari/Hindi numerals
  str = str.replace(/[०-९]/g, (char) => {
    const idx = DEVANAGARI_DIGITS.indexOf(char);
    return idx !== -1 ? String(idx) : char;
  });

  // 3. Remove common currency signs, currency codes, commas, and formatting noise
  // Preserves decimal point '.'
  str = str
    .replace(/[₹৳$€£]/g, '')
    .replace(/\b(rs|inr|bdt|tk|taka|rupees|টাকা|টাহকা|ট)\b/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();

  return str;
}

/**
 * Strict financial amount validator and parser.
 * Returns { isValid: boolean, amount: number, rawNormalized: string }
 * Guaranteed to reject NaN, Infinity, negative amounts, or unparseable input.
 */
export function parseIndicAmount(input: string | number | null | undefined): {
  isValid: boolean;
  amount: number;
  rawNormalized: string;
} {
  const normalized = normalizeIndicDigits(input);
  if (!normalized) {
    return { isValid: false, amount: 0, rawNormalized: '' };
  }

  const parsed = parseFloat(normalized);

  if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
    return { isValid: false, amount: 0, rawNormalized: normalized };
  }

  // Round to 2 decimal places to prevent float precision anomalies (e.g. 1500.0000000000002)
  const rounded = Math.round(parsed * 100) / 100;

  return {
    isValid: true,
    amount: rounded,
    rawNormalized: rounded.toString(),
  };
}
