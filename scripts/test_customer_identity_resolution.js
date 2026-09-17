// Comprehensive Test Suite for Canonical Customer Identity Resolution Engine
import assert from 'assert';
import {
  normalizePhoneNumber,
  normalizeCustomerName,
  transliterateToLatin,
  phoneticReduction,
  computeNameSimilarity,
  resolveCustomerIdentity,
} from '../src/lib/customerIdentityResolver.ts';

console.log('====================================================');
console.log('🧪 SMART KHATA — CUSTOMER IDENTITY RESOLUTION TESTS');
console.log('====================================================\n');

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`✅ PASS [${totalCount}]: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ FAIL [${totalCount}]: ${name}`);
    console.error(`   👉 Reason: ${err.message}`);
    throw err;
  }
}

// --------------------------------------------------------------------------
// TEST DATA SETUP
// --------------------------------------------------------------------------
const SHOP_A = 'shop-1111-aaaa-1111';
const SHOP_B = 'shop-2222-bbbb-2222';

const mockCustomers = [
  {
    id: 'cust-1',
    shop_id: SHOP_A,
    name: 'সামিম গায়েন',
    phone_number: '9876543210',
    display_label: 'সামিম গায়েন',
    created_at: new Date().toISOString(),
    balance: 1200,
  },
  {
    id: 'cust-2',
    shop_id: SHOP_A,
    name: 'समीम गायेन',
    phone_number: '9876543211',
    display_label: 'समीम गायेन',
    created_at: new Date().toISOString(),
    balance: 500,
  },
  {
    id: 'cust-3',
    shop_id: SHOP_A,
    name: 'Rahim Sheikh',
    phone_number: '1111111111',
    display_label: 'Rahim Sheikh',
    created_at: new Date().toISOString(),
    balance: 300,
  },
  {
    id: 'cust-4',
    shop_id: SHOP_A,
    name: 'Rahim Sk.',
    phone_number: '2222222222',
    display_label: 'Rahim Sk.',
    created_at: new Date().toISOString(),
    balance: 750,
  },
  {
    id: 'cust-5',
    shop_id: SHOP_A,
    name: 'Karim Uddin',
    phone_number: '9876500000',
    display_label: 'Karim Uddin',
    created_at: new Date().toISOString(),
    balance: 0,
  },
  {
    id: 'cust-6',
    shop_id: SHOP_A,
    name: 'Bikram Das',
    phone_number: '9876599999',
    display_label: 'Bikram Das',
    created_at: new Date().toISOString(),
    balance: 150,
  },
  {
    id: 'cust-shop-b',
    shop_id: SHOP_B,
    name: 'Samim Gayen',
    phone_number: '9876543210',
    display_label: 'Samim Gayen',
    created_at: new Date().toISOString(),
    balance: 9999,
  },
];

// --------------------------------------------------------------------------
// 1. UNIT NORMALIZATION TESTS
// --------------------------------------------------------------------------

runTest('Phone Normalization with Bengali Numerals & +91 prefix', () => {
  const r = normalizePhoneNumber('+91 ৯৮৭৬৫৪৩২১০');
  assert.strictEqual(r.canonical, '9876543210');
  assert.strictEqual(r.isValid, true);
});

runTest('Phone Normalization with Devanagari Numerals', () => {
  const r = normalizePhoneNumber('९८७६५४३२१०');
  assert.strictEqual(r.canonical, '9876543210');
  assert.strictEqual(r.isValid, true);
});

runTest('Phone Normalization with BD format 01711223344', () => {
  const r = normalizePhoneNumber('01711223344');
  assert.strictEqual(r.canonical, '1711223344');
  assert.strictEqual(r.isValid, true);
});

runTest('Transliteration: Bengali "সামিম গায়েন" -> "samim gayen"', () => {
  const t = transliterateToLatin('সামিম গায়েন');
  assert.strictEqual(t, 'samim gayen');
});

runTest('Transliteration: Devanagari "समीम गायेन" -> "samim gayen"', () => {
  const t = transliterateToLatin('समीम गायेन');
  assert.strictEqual(t, 'samim gayen');
});

runTest('Transliteration: Bengali "রহিম শেখ" -> "rahim shekh"', () => {
  const t = transliterateToLatin('রহিম শেখ');
  assert.strictEqual(t, 'rahim shekh');
});

runTest('Phonetic Reduction: "Sameem" & "Samim" -> identical key', () => {
  const p1 = phoneticReduction('Sameem');
  const p2 = phoneticReduction('Samim');
  assert.strictEqual(p1, p2);
});

runTest('Phonetic Reduction: "Raheem" & "Rahim" -> identical key', () => {
  const p1 = phoneticReduction('Raheem');
  const p2 = phoneticReduction('Rahim');
  assert.strictEqual(p1, p2);
});

// --------------------------------------------------------------------------
// 2. MANDATORY HIGH-RISK TESTS (From Prompt Requirements)
// --------------------------------------------------------------------------

runTest('MANDATORY TEST 1: DB="সামিম গায়েন" (9876543210) vs OCR="Samim Gayen" (9876543210) -> MATCH', () => {
  const res = resolveCustomerIdentity({
    extractedName: 'Samim Gayen',
    extractedPhone: '9876543210',
    shopId: SHOP_A,
    customers: mockCustomers,
  });

  assert.strictEqual(res.status, 'EXACT_PHONE_AND_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'cust-1');
});

runTest('MANDATORY TEST 2: DB="সামিম গায়েন" (9876543210) vs OCR="Samim Gayen" (9999999999) -> PHONE_CONFLICT (NO AUTO MATCH)', () => {
  const res = resolveCustomerIdentity({
    extractedName: 'Samim Gayen',
    extractedPhone: '9999999999',
    shopId: SHOP_A,
    customers: mockCustomers,
  });

  assert.strictEqual(res.status, 'PHONE_CONFLICT');
  assert.strictEqual(res.matchedCustomer, null);
  assert(res.candidates.some((c) => c.id === 'cust-1'));
});

runTest('MANDATORY TEST 3: DB="Rahim Ali" (9876543210) vs OCR="Bikram Das" (9876543210) -> PHONE_CONFLICT (NO AUTO MATCH)', () => {
  const localCusts = [
    {
      id: 'cust-rahim',
      shop_id: SHOP_A,
      name: 'Rahim Ali',
      phone_number: '9876543210',
      display_label: 'Rahim Ali',
      created_at: new Date().toISOString(),
    },
  ];

  const res = resolveCustomerIdentity({
    extractedName: 'Bikram Das',
    extractedPhone: '9876543210',
    shopId: SHOP_A,
    customers: localCusts,
  });

  assert.strictEqual(res.status, 'PHONE_CONFLICT');
  assert.strictEqual(res.matchedCustomer, null);
  assert.strictEqual(res.candidates[0].id, 'cust-rahim');
});

runTest('MANDATORY TEST 4: DB="Rahim Sheikh" & "Rahim Sk." vs OCR="রহিম শেখ" (no phone) -> AMBIGUOUS', () => {
  const res = resolveCustomerIdentity({
    extractedName: 'রহিম শেখ',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: mockCustomers,
  });

  assert.strictEqual(res.status, 'AMBIGUOUS');
  assert.strictEqual(res.matchedCustomer, null);
  assert(res.candidates.length >= 2);
});

runTest('MANDATORY TEST 5: DB="Samim Gayen" (9876543210) vs OCR="समीम गायेन" (9876543210) -> MATCH', () => {
  const localCusts = [
    {
      id: 'cust-samim-eng',
      shop_id: SHOP_A,
      name: 'Samim Gayen',
      phone_number: '9876543210',
      display_label: 'Samim Gayen',
      created_at: new Date().toISOString(),
    },
  ];

  const res = resolveCustomerIdentity({
    extractedName: 'समीम गायेन',
    extractedPhone: '9876543210',
    shopId: SHOP_A,
    customers: localCusts,
  });

  assert.strictEqual(res.status, 'EXACT_PHONE_AND_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'cust-samim-eng');
});

runTest('MANDATORY TEST 6: Cross-Shop Isolation: Shop A customer must NEVER match Shop B scan', () => {
  const res = resolveCustomerIdentity({
    extractedName: 'Samim Gayen',
    extractedPhone: '9876543210',
    shopId: 'shop-unrelated-9999',
    customers: mockCustomers,
  });

  assert.strictEqual(res.status, 'NO_MATCH');
  assert.strictEqual(res.matchedCustomer, null);
  assert.strictEqual(res.candidates.length, 0);
});

// --------------------------------------------------------------------------
// 3. ADDITIONAL 14 COMPREHENSIVE MATRIX TESTS (Total >= 20)
// --------------------------------------------------------------------------

runTest('Case 7: English same name + same phone', () => {
  const localCusts = [
    { id: 'c-karim', shop_id: SHOP_A, name: 'Karim Uddin', phone_number: '9876500000', display_label: 'Karim Uddin', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Karim Uddin',
    extractedPhone: '9876500000',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'EXACT_PHONE_AND_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'c-karim');
});

runTest('Case 8: Bengali stored + Hindi OCR + same phone', () => {
  const localCusts = [
    { id: 'c-bengali', shop_id: SHOP_A, name: 'করিম উদ্দিন', phone_number: '9876500000', display_label: 'করিম উদ্দিন', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'करीम उद्दीन',
    extractedPhone: '9876500000',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'EXACT_PHONE_AND_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'c-bengali');
});

runTest('Case 9: English stored + Bengali OCR (no phone)', () => {
  const localCusts = [
    { id: 'c-eng', shop_id: SHOP_A, name: 'Samim Gayen', phone_number: '', display_label: 'Samim Gayen', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'সামিম গায়েন',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'EXACT_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'c-eng');
});

runTest('Case 10: Spelling variation "Sameem Gayen" vs "Samim Gayen" (no phone)', () => {
  const localCusts = [
    { id: 'c-samim', shop_id: SHOP_A, name: 'Samim Gayen', phone_number: '', display_label: 'Samim Gayen', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Sameem Gayen',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'STRONG_MATCH');
  assert.strictEqual(res.matchedCustomer?.id, 'c-samim');
});

runTest('Case 11: Exact phone + missing name in OCR -> EXACT_PHONE', () => {
  const res = resolveCustomerIdentity({
    extractedName: '',
    extractedPhone: '9876543210',
    shopId: SHOP_A,
    customers: mockCustomers,
  });
  assert.strictEqual(res.status, 'EXACT_PHONE');
  assert.strictEqual(res.matchedCustomer?.id, 'cust-1');
});

runTest('Case 12: Unknown customer with valid phone -> NO_MATCH (Ready for new customer flow)', () => {
  const res = resolveCustomerIdentity({
    extractedName: 'Tanvir Hossain',
    extractedPhone: '9123456789',
    shopId: SHOP_A,
    customers: mockCustomers,
  });
  assert.strictEqual(res.status, 'NO_MATCH');
  assert.strictEqual(res.matchedCustomer, null);
});

runTest('Case 13: Unknown customer with missing phone -> NO_MATCH', () => {
  const res = resolveCustomerIdentity({
    extractedName: 'Subrata Mukherjee',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: mockCustomers,
  });
  assert.strictEqual(res.status, 'NO_MATCH');
  assert.strictEqual(res.matchedCustomer, null);
});

runTest('Case 14: Invalid phone digits (too short) -> handled safely without crash', () => {
  const res = resolveCustomerIdentity({
    extractedName: 'Bikram Das',
    extractedPhone: '123',
    shopId: SHOP_A,
    customers: mockCustomers,
  });
  // Should match Bikram Das by exact name since phone "123" is invalid
  assert.strictEqual(res.status, 'EXACT_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'cust-6');
});

runTest('Case 15: Three ambiguous customers with similar names', () => {
  const ambiguousGroup = [
    { id: 'm1', shop_id: SHOP_A, name: 'Mohammed Ali', phone_number: '1111111111', display_label: '', created_at: '' },
    { id: 'm2', shop_id: SHOP_A, name: 'Md Ali', phone_number: '2222222222', display_label: '', created_at: '' },
    { id: 'm3', shop_id: SHOP_A, name: 'Ali Bhai', phone_number: '3333333333', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Ali',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: ambiguousGroup,
  });
  assert.strictEqual(res.status, 'AMBIGUOUS');
  assert.strictEqual(res.matchedCustomer, null);
  assert(res.candidates.length >= 2);
});

runTest('Case 16: Honorific stripping "Md. Rahim Sheikh" matches "Rahim Sheikh"', () => {
  const localCusts = [
    { id: 'c-rahim', shop_id: SHOP_A, name: 'Rahim Sheikh', phone_number: '', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Md. Rahim Sheikh',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'EXACT_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'c-rahim');
});

runTest('Case 17: Bengali honorific stripping "মোঃ রহিম শেখ" matches "Rahim Sheikh"', () => {
  const localCusts = [
    { id: 'c-rahim', shop_id: SHOP_A, name: 'Rahim Sheikh', phone_number: '', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'মোঃ রহিম শেখ',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert(res.status === 'STRONG_MATCH' || res.status === 'EXACT_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'c-rahim');
});

runTest('Case 18: Exact match with display_label when different from name', () => {
  const localCusts = [
    { id: 'c-babu', shop_id: SHOP_A, name: 'Subhash Chandra', phone_number: '', display_label: 'Babu Da', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Babu Da',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'EXACT_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'c-babu');
});

runTest('Case 19: Duplicate Customer Prevention Verification', () => {
  // Verifies that when customer matches, resolver returns the exact existing customer object
  const res = resolveCustomerIdentity({
    extractedName: 'Samim Gayen',
    extractedPhone: '9876543210',
    shopId: SHOP_A,
    customers: mockCustomers,
  });
  assert.strictEqual(res.status, 'EXACT_PHONE_AND_NAME');
  assert.strictEqual(res.matchedCustomer?.id, 'cust-1');
  assert.strictEqual(res.matchedCustomer?.name, 'সামিম গায়েন');
  assert.strictEqual(res.matchedCustomer?.balance, 1200);
});

runTest('Case 20: Phone Conflict with Different Phone Format (+91 vs 0...)', () => {
  const localCusts = [
    { id: 'c-t', shop_id: SHOP_A, name: 'Sunil Sen', phone_number: '9876512345', display_label: 'Sunil Sen', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Sunil Sen',
    extractedPhone: '+91 99999 54321',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'PHONE_CONFLICT');
  assert.strictEqual(res.matchedCustomer, null);
});

// --------------------------------------------------------------------------
// NEGATIVE SAFETY & FALSE-POSITIVE PREVENTION TESTS (PHASE 1 & PHASE 13)
// --------------------------------------------------------------------------

runTest('Negative Test 21: Similar phonetic names with different phones -> PHONE_CONFLICT', () => {
  const localCusts = [
    { id: 'c-1', shop_id: SHOP_A, name: 'Sameer Khan', phone_number: '9800000001', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Samir Khan',
    extractedPhone: '9800000002', // Different person!
    shopId: SHOP_A,
    customers: localCusts,
  });
  // Must NOT auto-match! Phone discrepancy takes precedence.
  assert.strictEqual(res.status, 'PHONE_CONFLICT');
  assert.strictEqual(res.matchedCustomer, null);
});

runTest('Negative Test 22: Short single-token name ("Das") with multiple matches -> AMBIGUOUS', () => {
  const localCusts = [
    { id: 'c-d1', shop_id: SHOP_A, name: 'Bikram Das', phone_number: '9800000011', display_label: '', created_at: '' },
    { id: 'c-d2', shop_id: SHOP_A, name: 'Sanjay Das', phone_number: '9800000012', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Das',
    extractedPhone: '',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'AMBIGUOUS');
  assert.strictEqual(res.matchedCustomer, null);
  assert.strictEqual(res.candidates.length, 2);
});

runTest('Negative Test 23: Dissimilar names with different phones -> NO_MATCH', () => {
  const localCusts = [
    { id: 'c-1', shop_id: SHOP_A, name: 'Subrata Roy', phone_number: '9800000021', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Anil Kumar',
    extractedPhone: '9800000099',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'NO_MATCH');
  assert.strictEqual(res.matchedCustomer, null);
});

runTest('Negative Test 24: OCR partial name typo with completely different phone -> PHONE_CONFLICT', () => {
  const localCusts = [
    { id: 'c-1', shop_id: SHOP_A, name: 'Rahim Sheikh', phone_number: '9800000031', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Rahim Shekh',
    extractedPhone: '9800000039', // 1 digit typo or different person
    shopId: SHOP_A,
    customers: localCusts,
  });
  // Must NOT match because phones differ!
  assert.strictEqual(res.status, 'PHONE_CONFLICT');
  assert.strictEqual(res.matchedCustomer, null);
});

runTest('Negative Test 25: Same phone with contradictory name -> PHONE_CONFLICT (no silent merge)', () => {
  const localCusts = [
    { id: 'c-1', shop_id: SHOP_A, name: 'Kalyan Mukherjee', phone_number: '9800000041', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Tapan Ghosh',
    extractedPhone: '9800000041',
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'PHONE_CONFLICT');
  assert.strictEqual(res.matchedCustomer, null);
  assert.strictEqual(res.candidates.length, 1);
});

runTest('Negative Test 26: Invalid short phone with dissimilar name -> NO_MATCH without crash', () => {
  const localCusts = [
    { id: 'c-1', shop_id: SHOP_A, name: 'Animesh Das', phone_number: '9800000051', display_label: '', created_at: '' },
  ];
  const res = resolveCustomerIdentity({
    extractedName: 'Prabir Roy',
    extractedPhone: '123', // Garbage/partial digits
    shopId: SHOP_A,
    customers: localCusts,
  });
  assert.strictEqual(res.status, 'NO_MATCH');
  assert.strictEqual(res.matchedCustomer, null);
});

console.log('\n----------------------------------------------------');
console.log(`🎉 ALL ${passedCount}/${totalCount} IDENTITY RESOLUTION TESTS PASSED!`);
console.log('----------------------------------------------------\n');
