// Verification script for Financial Calculations, Indic Numerals & Customer Matching Logic
import assert from 'assert';

// 1. Indic Numerals Parser Test
const indicDigitMap = {
  // Bengali numerals
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  // Devanagari (Hindi) numerals
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

function parseIndicAmount(input) {
  if (typeof input === 'number') {
    return { amount: Math.abs(input), isValid: !isNaN(input) && input > 0 };
  }
  if (!input || typeof input !== 'string') {
    return { amount: 0, isValid: false };
  }

  let cleaned = input.trim();
  cleaned = cleaned.replace(/[\u20B9৳$£€\s,]/g, '');

  let normalized = '';
  for (const char of cleaned) {
    if (indicDigitMap[char] !== undefined) {
      normalized += indicDigitMap[char];
    } else {
      normalized += char;
    }
  }

  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return { amount: 0, isValid: false };
  }

  const num = parseFloat(match[1]);
  return { amount: isNaN(num) ? 0 : num, isValid: !isNaN(num) && num > 0 };
}

// Test Indic Parser
console.log('Testing Indic Numeral Parser...');
assert.strictEqual(parseIndicAmount('১৫০০').amount, 1500);
assert.strictEqual(parseIndicAmount('१५००').amount, 1500);
assert.strictEqual(parseIndicAmount('1500').amount, 1500);
assert.strictEqual(parseIndicAmount('৳ ২,৫৫০.৫০').amount, 2550.5);
assert.strictEqual(parseIndicAmount('₹ 499.00').amount, 499);
console.log('✅ Indic Numeral Parser Tests Passed!');

// 2. Customer Matching Engine Test
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-10); // Match last 10 digits for robust national format
}

function matchCustomer(customers, queryName, queryPhone) {
  const normQPhone = normalizePhone(queryPhone);

  // Priority 1: Phone match
  if (normQPhone.length >= 10) {
    const phoneMatch = customers.find(c => normalizePhone(c.phone_number) === normQPhone);
    if (phoneMatch) {
      return { match: phoneMatch, method: 'phone_exact', confidence: 1.0 };
    }
  }

  // Priority 2: Exact Name / Display Label match
  const qNameLower = (queryName || '').trim().toLowerCase();
  if (qNameLower) {
    const exactNameMatch = customers.find(c => 
      c.name.toLowerCase() === qNameLower || 
      (c.display_label && c.display_label.toLowerCase() === qNameLower)
    );
    if (exactNameMatch) {
      return { match: exactNameMatch, method: 'name_exact', confidence: 0.95 };
    }

    // Priority 3: Fuzzy / Partial match
    const fuzzy = customers.filter(c => 
      c.name.toLowerCase().includes(qNameLower) ||
      qNameLower.includes(c.name.toLowerCase()) ||
      (c.display_label && c.display_label.toLowerCase().includes(qNameLower))
    );

    if (fuzzy.length === 1) {
      return { match: fuzzy[0], method: 'name_fuzzy_single', confidence: 0.8 };
    } else if (fuzzy.length > 1) {
      return { match: null, candidates: fuzzy, method: 'name_ambiguous', confidence: 0.5 };
    }
  }

  return { match: null, method: 'none', confidence: 0 };
}

console.log('Testing Customer Matching Engine...');
const mockCustomers = [
  { id: 'c1', name: 'Rahim Ali', phone_number: '+8801711122233', balance: 500 },
  { id: 'c2', name: 'Karim Uddin', phone_number: '01822233344', balance: 1200 },
  { id: 'c3', name: 'Rahim Khan', phone_number: '01933344455', balance: 0 },
];

// Exact Phone Match
const r1 = matchCustomer(mockCustomers, 'Unknown', '01711122233');
assert.strictEqual(r1.match?.id, 'c1');
assert.strictEqual(r1.method, 'phone_exact');

// Exact Name Match
const r2 = matchCustomer(mockCustomers, 'Karim Uddin', '');
assert.strictEqual(r2.match?.id, 'c2');
assert.strictEqual(r2.method, 'name_exact');

// Ambiguous Name Guard (2 Rahims)
const r3 = matchCustomer(mockCustomers, 'Rahim', '');
assert.strictEqual(r3.match, null);
assert.strictEqual(r3.method, 'name_ambiguous');
assert.strictEqual(r3.candidates?.length, 2);

console.log('✅ Customer Matching Tests Passed!');

// 3. Financial Balance Invariant Test
console.log('Testing Financial Balance Invariant...');
function calculateNewBalance(currentBal, txType, amount) {
  const numAmt = Number(amount) || 0;
  if (txType === 'credit_given') {
    return currentBal + numAmt;
  } else if (txType === 'payment_received') {
    return currentBal - numAmt;
  }
  return currentBal;
}

let bal = 1000;
bal = calculateNewBalance(bal, 'credit_given', 500); // 1500
assert.strictEqual(bal, 1500);
bal = calculateNewBalance(bal, 'payment_received', 800); // 700
assert.strictEqual(bal, 700);
bal = calculateNewBalance(bal, 'payment_received', 700); // 0
assert.strictEqual(bal, 0);
console.log('✅ Financial Balance Invariant Tests Passed!');

console.log('\n🎉 ALL FINANCIAL & MATCHING TESTS SUCCEEDED!');
