/**
 * SMART KHATA — CANONICAL CUSTOMER IDENTITY RESOLUTION ENGINE
 * 
 * Production-grade, deterministic, multilingual customer resolver.
 * 
 * CORE FINANCIAL SAFETY PRINCIPLE:
 * A false customer match is more dangerous than asking the shopkeeper one extra question.
 * AI OCR extracts identity signals; the application identity layer determines candidates;
 * the merchant confirms before any transaction is saved.
 */

import type { Customer } from '../types/index.ts';

export type IdentityStatus =
  | 'EXACT_PHONE_AND_NAME'
  | 'EXACT_PHONE'
  | 'PHONE_CONFLICT'
  | 'EXACT_NAME'
  | 'STRONG_MATCH'
  | 'AMBIGUOUS'
  | 'NO_MATCH';

export interface ResolutionSignals {
  phoneExact: boolean;
  phoneConflict: boolean;
  nameExact: boolean;
  translitExact: boolean;
  phoneticExact: boolean;
  nameSimilarity: number;
  translitSimilarity: number;
}

export interface CustomerResolutionResult {
  status: IdentityStatus;
  matchedCustomer: Customer | null;
  candidates: Customer[];
  reasons: string[];
  signals: ResolutionSignals;
}

export interface ResolveCustomerIdentityOptions {
  extractedName: string;
  extractedPhone: string;
  shopId: string;
  customers: Customer[];
}

// --------------------------------------------------------------------------
// 1. PHONE NORMALIZATION
// --------------------------------------------------------------------------

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

/**
 * Normalizes any phone number into canonical national digits.
 * Converts Indic numerals, removes formatting noise, strips standard country
 * codes (+91, +880, +1) and leading zero, returning canonical 10-digit national number.
 */
export function normalizePhoneNumber(phone: string | null | undefined): {
  canonical: string;
  rawDigits: string;
  isValid: boolean;
} {
  if (!phone) return { canonical: '', rawDigits: '', isValid: false };

  let raw = String(phone).trim();

  // Convert Bengali digits
  raw = raw.replace(/[০-৯]/g, (ch) => BENGALI_DIGITS[ch] || ch);
  // Convert Devanagari digits
  raw = raw.replace(/[०-९]/g, (ch) => DEVANAGARI_DIGITS[ch] || ch);

  const rawDigits = raw.replace(/\D/g, '');
  if (!rawDigits) return { canonical: '', rawDigits: '', isValid: false };

  let local = rawDigits;

  // Strip international calling codes for IN (+91), BD (+880), US/CA (+1)
  if (local.startsWith('880') && local.length === 13) {
    local = local.slice(3);
  } else if (local.startsWith('91') && local.length === 12) {
    local = local.slice(2);
  } else if (local.startsWith('1') && local.length === 11) {
    local = local.slice(1);
  }

  // Strip leading zero (e.g. 01711223344 -> 1711223344)
  if (local.startsWith('0') && local.length === 11) {
    local = local.slice(1);
  }

  // A valid national mobile number in IN / BD is 10 digits
  const canonical = local.length >= 10 ? local.slice(-10) : local;
  const isValid = canonical.length >= 10;

  return { canonical, rawDigits, isValid };
}

// --------------------------------------------------------------------------
// 2. NAME NORMALIZATION
// --------------------------------------------------------------------------

const HONORIFICS_REGEX =
  /^(mr|mrs|ms|md|mohd|dr|shree|sri|babu|dada|da|uncle|bhai|kaka|মোর?ঃ?|ডাঃ?|বাবু|দা|কাকা|ভাই|श्री|श्रीमती|डा)\.?\s+/i;

/**
 * Normalizes a customer name: Unicode NFC, lowercase, strips punctuation & honorifics.
 */
export function normalizeCustomerName(name: string | null | undefined): string {
  if (!name) return '';
  let str = String(name).normalize('NFC').trim().toLowerCase();

  // Remove quotes, brackets, parens, symbols
  str = str.replace(/[.,/#!$%^&*;:{}=\-_`~()"'[\]]/g, ' ');

  // Strip leading common honorifics
  str = str.replace(HONORIFICS_REGEX, '');

  // Collapse whitespace
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

// --------------------------------------------------------------------------
// 3. CROSS-SCRIPT TRANSLITERATION (Bengali / Hindi -> Latin)
// --------------------------------------------------------------------------

const BENGALI_CHAR_MAP: Record<string, string> = {
  // Vowels
  'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri',
  'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
  // Vowel signs (kar)
  'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri',
  'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
  // Consonants
  'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
  'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
  'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
  'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
  'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
  'য': 'j', 'র': 'r', 'ল': 'l',
  'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
  'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y',
  'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
  '্': '', // Hasanta / virama
  '\u09BC': '', // Nukta
};

const DEVANAGARI_CHAR_MAP: Record<string, string> = {
  // Vowels
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  // Vowel signs (matra)
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  // Consonants
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'j', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
  'ं': 'n', 'ँ': 'n', 'ः': 'h',
  '्': '', // Virama
  '\u093C': '', // Nukta
};

function isIndicConsonant(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  // Bengali consonants
  if ((code >= 0x0995 && code <= 0x09B9) || code === 0x09DC || code === 0x09DD || code === 0x09DF) {
    return true;
  }
  // Devanagari consonants
  if ((code >= 0x0915 && code <= 0x0939) || (code >= 0x0958 && code <= 0x095F)) {
    return true;
  }
  return false;
}

function isIndicVowelSignOrVirama(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  // Bengali matras (0x09BE - 0x09CC) & virama (0x09CD)
  if (code >= 0x09BE && code <= 0x09CD) return true;
  // Devanagari matras (0x093E - 0x094C) & virama (0x094D)
  if (code >= 0x093E && code <= 0x094D) return true;
  return false;
}

/**
 * Transliterates Bengali or Devanagari strings into normalized Latin.
 * Accurately models Indic syllable phonetics (inherent 'a' between consonants,
 * vowel sign replacement, and final schwa deletion).
 */
export function transliterateToLatin(text: string): string {
  if (!text) return '';
  const normalized = normalizeCustomerName(text)
    .replace(/\u09AF\u09BC/g, 'য়')
    .replace(/\u09A1\u09BC/g, 'ড়')
    .replace(/\u09A2\u09BC/g, 'ঢ়');

  let result = '';
  const len = normalized.length;

  for (let i = 0; i < len; i++) {
    const ch = normalized[i];
    const nextCh = i + 1 < len ? normalized[i + 1] : '';

    let mapped = '';
    if (BENGALI_CHAR_MAP[ch] !== undefined) {
      mapped = BENGALI_CHAR_MAP[ch];
    } else if (DEVANAGARI_CHAR_MAP[ch] !== undefined) {
      mapped = DEVANAGARI_CHAR_MAP[ch];
    } else {
      mapped = ch;
    }

    result += mapped;

    // Inherent vowel 'a' rule:
    // If current character is a consonant and next character is also a consonant (not a vowel sign, virama, space, or punctuation)
    if (isIndicConsonant(ch) && isIndicConsonant(nextCh)) {
      result += 'a';
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}

// --------------------------------------------------------------------------
// 4. INDIC-TUNED PHONETIC REDUCTION
// --------------------------------------------------------------------------

/**
 * Reduces a Latin or transliterated name into an Indic-aware phonetic key.
 * Collapses common vowel/consonant spelling variations:
 *   ee -> i, oo -> u, y -> i, w -> v, kh -> k, gh -> g, etc.
 *   sk / sheikh -> sek
 */
export function phoneticReduction(text: string): string {
  if (!text) return '';
  let str = transliterateToLatin(text).toLowerCase();

  // Normalize Sheikh / Sk / Shekh / Sheik -> sek
  str = str.replace(/\b(sheikh|sheik|shekh|shaik|shaikh|sk|shk)\b/g, 'sek');

  // Double vowels
  str = str.replace(/ee/g, 'i');
  str = str.replace(/oo/g, 'u');
  str = str.replace(/aa/g, 'a');

  // Vowel variations
  str = str.replace(/y/g, 'i');
  str = str.replace(/w/g, 'v');
  str = str.replace(/z/g, 'j');

  // Aspirated consonants to base
  str = str.replace(/kh/g, 'k');
  str = str.replace(/gh/g, 'g');
  str = str.replace(/chh/g, 'ch');
  str = str.replace(/jh/g, 'j');
  str = str.replace(/th/g, 't');
  str = str.replace(/dh/g, 'd');
  str = str.replace(/ph/g, 'f');
  str = str.replace(/bh/g, 'b');
  str = str.replace(/sh/g, 's');

  // Deduplicate consecutive identical consonants (e.g. mm -> m, dd -> d)
  str = str.replace(/([a-z])\1+/g, '$1');

  // Strip whitespace to compare phonetic character stream
  return str.replace(/\s+/g, '');
}

// --------------------------------------------------------------------------
// 5. DETERMINISTIC STRING SIMILARITY (Dice / Levenshtein Hybrid)
// --------------------------------------------------------------------------

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row: number[] = [];
  for (let i = 0; i <= b.length; i++) row[i] = i;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val =
        a[i - 1] === b[j - 1]
          ? row[j - 1]
          : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export function computeNameSimilarity(strA: string, strB: string): number {
  if (!strA || !strB) return 0;
  if (strA === strB) return 1.0;

  const maxLen = Math.max(strA.length, strB.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(strA, strB);
  const similarity = 1 - dist / maxLen;
  return Math.max(0, Math.min(1.0, Math.round(similarity * 100) / 100));
}

// --------------------------------------------------------------------------
// 6. CANONICAL MULTI-SIGNAL RESOLVER
// --------------------------------------------------------------------------

/**
 * Resolves customer identity with strict financial safety.
 * Guaranteed:
 *   1. Scoped strictly to shopId (cross-shop leak impossible).
 *   2. Phone conflict prevents silent auto-match.
 *   3. Contradictory name with same phone prevents silent auto-match.
 *   4. Cross-script (Bengali / Devanagari / English) recognized deterministically.
 */
export function resolveCustomerIdentity({
  extractedName,
  extractedPhone,
  shopId,
  customers,
}: ResolveCustomerIdentityOptions): CustomerResolutionResult {
  const normExtractedPhone = normalizePhoneNumber(extractedPhone);
  const normExtractedName = normalizeCustomerName(extractedName);
  const translitExtractedName = transliterateToLatin(extractedName);
  const phoneticExtractedName = phoneticReduction(extractedName);

  // 1. STRICT TENANT ISOLATION: Candidates must belong to the active shop
  const shopCustomers = (customers || []).filter((c) => c.shop_id === shopId);

  if (shopCustomers.length === 0) {
    return {
      status: 'NO_MATCH',
      matchedCustomer: null,
      candidates: [],
      reasons: ['No existing customers found in this shop.'],
      signals: {
        phoneExact: false,
        phoneConflict: false,
        nameExact: false,
        translitExact: false,
        phoneticExact: false,
        nameSimilarity: 0,
        translitSimilarity: 0,
      },
    };
  }

  // Evaluate candidate signals
  interface ScoredCandidate {
    customer: Customer;
    signals: ResolutionSignals;
    reasons: string[];
    isContradictoryName: boolean;
    isCompatibleName: boolean;
  }

  const scoredList: ScoredCandidate[] = [];

  for (const cust of shopCustomers) {
    const custNormPhone = normalizePhoneNumber(cust.phone_number);
    const custNormName = normalizeCustomerName(cust.name);
    const custNormDisplay = normalizeCustomerName(cust.display_label);
    const custTranslitName = transliterateToLatin(cust.name);
    const custTranslitDisplay = transliterateToLatin(cust.display_label);
    const custPhoneticName = phoneticReduction(cust.name);
    const custPhoneticDisplay = phoneticReduction(cust.display_label);

    // Phone checks
    const hasBothPhones = normExtractedPhone.isValid && custNormPhone.isValid;
    const phoneExact = hasBothPhones && normExtractedPhone.canonical === custNormPhone.canonical;
    const phoneConflict = hasBothPhones && normExtractedPhone.canonical !== custNormPhone.canonical;

    // Name checks
    const nameExact = Boolean(
      normExtractedName &&
        (normExtractedName === custNormName || (custNormDisplay && normExtractedName === custNormDisplay))
    );

    const translitExact = Boolean(
      translitExtractedName &&
        (translitExtractedName === custTranslitName ||
          (custTranslitDisplay && translitExtractedName === custTranslitDisplay))
    );

    const phoneticExact = Boolean(
      phoneticExtractedName &&
        (phoneticExtractedName === custPhoneticName ||
          (custPhoneticDisplay && phoneticExtractedName === custPhoneticDisplay))
    );

    // Similarities
    const simRaw = Math.max(
      computeNameSimilarity(normExtractedName, custNormName),
      custNormDisplay ? computeNameSimilarity(normExtractedName, custNormDisplay) : 0
    );

    const simTranslit = Math.max(
      computeNameSimilarity(translitExtractedName, custTranslitName),
      custTranslitDisplay ? computeNameSimilarity(translitExtractedName, custTranslitDisplay) : 0
    );

    const nameSimilarity = Math.max(simRaw, simTranslit);

    // Compatibility vs Contradiction
    const isCompatibleName =
      nameExact ||
      translitExact ||
      phoneticExact ||
      nameSimilarity >= 0.70 ||
      !normExtractedName; // If name not extracted, neutral

    const isContradictoryName = Boolean(
      normExtractedName &&
        normExtractedName.length >= 3 &&
        custNormName.length >= 3 &&
        !nameExact &&
        !translitExact &&
        !phoneticExact &&
        nameSimilarity < 0.35
    );

    const reasons: string[] = [];
    if (phoneExact) reasons.push('Phone number matches');
    if (phoneConflict) reasons.push('Phone number is different');
    if (nameExact) reasons.push('Exact customer name matches');
    if (translitExact && !nameExact) reasons.push('Name matches across languages (transliteration)');
    if (phoneticExact && !translitExact) reasons.push('Name sounds identical (phonetic)');
    if (nameSimilarity >= 0.75 && !nameExact && !translitExact) reasons.push('Name spelling is very similar');

    scoredList.push({
      customer: cust,
      signals: {
        phoneExact,
        phoneConflict,
        nameExact,
        translitExact,
        phoneticExact,
        nameSimilarity,
        translitSimilarity: simTranslit,
      },
      reasons,
      isContradictoryName,
      isCompatibleName,
    });
  }

  // ------------------------------------------------------------------------
  // CRITICAL RULE 1: PHONE CONFLICT (Same phone, contradictory name)
  // Example: DB="Rahim Ali" (9876543210) vs OCR="Bikram Das" (9876543210)
  // ------------------------------------------------------------------------
  const phoneMatches = scoredList.filter((sc) => sc.signals.phoneExact);
  if (phoneMatches.length > 0) {
    const contradictory = phoneMatches.find((sc) => sc.isContradictoryName);
    if (contradictory) {
      return {
        status: 'PHONE_CONFLICT',
        matchedCustomer: null,
        candidates: phoneMatches.map((sc) => sc.customer),
        reasons: [
          `Phone matches "${contradictory.customer.phone_number}", but customer name "${extractedName}" contradicts existing record "${contradictory.customer.name}".`,
        ],
        signals: contradictory.signals,
      };
    }
  }

  // ------------------------------------------------------------------------
  // RULE 2: EXACT PHONE + COMPATIBLE NAME (Highest Confidence Match)
  // Example: DB="সামিম গায়েন" (9876543210) vs OCR="Samim Gayen" (9876543210)
  // ------------------------------------------------------------------------
  const safePhoneMatches = phoneMatches.filter((sc) => sc.isCompatibleName);
  if (safePhoneMatches.length === 1) {
    const sc = safePhoneMatches[0];
    const isNameVerified = sc.signals.nameExact || sc.signals.translitExact || sc.signals.phoneticExact;
    return {
      status: isNameVerified ? 'EXACT_PHONE_AND_NAME' : 'EXACT_PHONE',
      matchedCustomer: sc.customer,
      candidates: [sc.customer],
      reasons: sc.reasons,
      signals: sc.signals,
    };
  } else if (safePhoneMatches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      matchedCustomer: null,
      candidates: safePhoneMatches.map((sc) => sc.customer),
      reasons: ['Multiple customers share this mobile number.'],
      signals: safePhoneMatches[0].signals,
    };
  }

  // ------------------------------------------------------------------------
  // CRITICAL RULE 3: PHONE CONFLICT (Same name, contradictory phone)
  // Example: DB="Samim Gayen" (9876543210) vs OCR="Samim Gayen" (9999999999)
  // ------------------------------------------------------------------------
  const strongNameMatchesWithPhoneConflict = scoredList.filter(
    (sc) => (sc.signals.nameExact || sc.signals.translitExact || sc.signals.nameSimilarity >= 0.85) && sc.signals.phoneConflict
  );
  if (strongNameMatchesWithPhoneConflict.length > 0) {
    const conflictCand = strongNameMatchesWithPhoneConflict[0];
    return {
      status: 'PHONE_CONFLICT',
      matchedCustomer: null,
      candidates: strongNameMatchesWithPhoneConflict.map((sc) => sc.customer),
      reasons: [
        `Customer name matches "${conflictCand.customer.name}", but mobile number "${extractedPhone}" is different from recorded "${conflictCand.customer.phone_number}".`,
      ],
      signals: conflictCand.signals,
    };
  }

  // ------------------------------------------------------------------------
  // SINGLE-TOKEN AMBIGUITY GUARD
  // If extracted name is a single word (e.g. "Ali", "Rahim", "Das") and multiple
  // customers share this word in their names, require merchant selection.
  // ------------------------------------------------------------------------
  const extractedTokens = (translitExtractedName || normExtractedName).split(/\s+/).filter(Boolean);
  if (extractedTokens.length === 1 && extractedTokens[0].length >= 3 && !phoneMatches.length) {
    const token = extractedTokens[0];
    const tokenMatches = scoredList.filter((sc) => {
      const custTokens = (
        normalizeCustomerName(sc.customer.name) +
        ' ' +
        transliterateToLatin(sc.customer.name) +
        ' ' +
        normalizeCustomerName(sc.customer.display_label)
      )
        .split(/\s+/)
        .filter(Boolean);
      return custTokens.includes(token);
    });

    if (tokenMatches.length > 1) {
      return {
        status: 'AMBIGUOUS',
        matchedCustomer: null,
        candidates: tokenMatches.map((sc) => sc.customer),
        reasons: [`Multiple customers matching "${extractedName}" found. Please select the exact customer.`],
        signals: tokenMatches[0].signals,
      };
    }
  }

  // ------------------------------------------------------------------------
  // RULE 4: EXACT NAME (Exact string or Exact Transliteration without phone conflict)
  // ------------------------------------------------------------------------
  const exactNameMatches = scoredList.filter(
    (sc) => (sc.signals.nameExact || sc.signals.translitExact) && !sc.signals.phoneConflict
  );

  if (exactNameMatches.length === 1) {
    const sc = exactNameMatches[0];
    return {
      status: 'EXACT_NAME',
      matchedCustomer: sc.customer,
      candidates: [sc.customer],
      reasons: sc.reasons,
      signals: sc.signals,
    };
  } else if (exactNameMatches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      matchedCustomer: null,
      candidates: exactNameMatches.map((sc) => sc.customer),
      reasons: [`Multiple customers named "${extractedName}" exist in this shop.`],
      signals: exactNameMatches[0].signals,
    };
  }

  // ------------------------------------------------------------------------
  // RULE 5: STRONG MATCH (Phonetic or High-Similarity Transliteration)
  // ------------------------------------------------------------------------
  const strongMatches = scoredList.filter(
    (sc) => (sc.signals.phoneticExact || sc.signals.nameSimilarity >= 0.75) && !sc.signals.phoneConflict
  );

  if (strongMatches.length === 1) {
    const sc = strongMatches[0];
    return {
      status: 'STRONG_MATCH',
      matchedCustomer: sc.customer,
      candidates: [sc.customer],
      reasons: sc.reasons,
      signals: sc.signals,
    };
  } else if (strongMatches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      matchedCustomer: null,
      candidates: strongMatches.map((sc) => sc.customer),
      reasons: [`Multiple similar customer records match "${extractedName}".`],
      signals: strongMatches[0].signals,
    };
  }

  // ------------------------------------------------------------------------
  // RULE 6: AMBIGUOUS BOUNDARY CHECK (Moderate Similarity)
  // ------------------------------------------------------------------------
  const moderateMatches = scoredList.filter(
    (sc) => sc.signals.nameSimilarity >= 0.60 && !sc.signals.phoneConflict
  );
  if (moderateMatches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      matchedCustomer: null,
      candidates: moderateMatches.map((sc) => sc.customer),
      reasons: ['Several customers with similar names found.'],
      signals: moderateMatches[0].signals,
    };
  } else if (moderateMatches.length === 1) {
    const sc = moderateMatches[0];
    return {
      status: 'STRONG_MATCH',
      matchedCustomer: sc.customer,
      candidates: [sc.customer],
      reasons: sc.reasons,
      signals: sc.signals,
    };
  }

  // ------------------------------------------------------------------------
  // RULE 7: NO MATCH (New Customer Flow)
  // ------------------------------------------------------------------------
  return {
    status: 'NO_MATCH',
    matchedCustomer: null,
    candidates: [],
    reasons: ['No matching customer found.'],
    signals: {
      phoneExact: false,
      phoneConflict: false,
      nameExact: false,
      translitExact: false,
      phoneticExact: false,
      nameSimilarity: 0,
      translitSimilarity: 0,
    },
  };
}
