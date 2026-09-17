// Test Bulk Scan Multi-Draft Resolution & Customer Integrity
import assert from 'assert';
import { resolveCustomerIdentity } from '../src/lib/customerIdentityResolver.ts';

console.log('====================================================');
console.log('🧪 SMART KHATA — BULK SCAN MULTI-DRAFT TESTS');
console.log('====================================================\n');

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
    name: 'Rahim Sheikh',
    phone_number: '9876500001',
    display_label: 'Rahim Sheikh',
    created_at: new Date().toISOString(),
    balance: 500,
  },
  {
    id: 'cust-shop-b',
    shop_id: SHOP_B,
    name: 'Bikram Das',
    phone_number: '9876500002',
    display_label: 'Bikram Das',
    created_at: new Date().toISOString(),
    balance: 100,
  },
];

// Mock a multi-row page extracted from Gemini OCR
const simulatedOcrDrafts = [
  // Row 1: Existing customer in English
  {
    id: 'draft-1',
    customerName: 'Samim Gayen',
    phone: '9876543210',
    amount: 250,
    type: 'credit_given',
  },
  // Row 2: Same existing customer appearing again (payment)
  {
    id: 'draft-2',
    customerName: 'সামিম গায়েন',
    phone: '9876543210',
    amount: 100,
    type: 'payment_received',
  },
  // Row 3: New customer
  {
    id: 'draft-3',
    customerName: 'Anil Roy',
    phone: '9811122233',
    amount: 500,
    type: 'credit_given',
  },
  // Row 4: Phone Conflict (Existing name, different phone)
  {
    id: 'draft-4',
    customerName: 'Rahim Sheikh',
    phone: '9999988888',
    amount: 400,
    type: 'credit_given',
  },
  // Row 5: Cross-shop customer name/phone
  {
    id: 'draft-5',
    customerName: 'Bikram Das',
    phone: '9876500002',
    amount: 300,
    type: 'credit_given',
  },
];

// Process each draft independently
const processedDrafts = simulatedOcrDrafts.map((draft) => {
  const resolution = resolveCustomerIdentity({
    extractedName: draft.customerName,
    extractedPhone: draft.phone,
    shopId: SHOP_A,
    customers: mockCustomers,
  });
  return {
    ...draft,
    identityStatus: resolution.status,
    matchedCustomer: resolution.matchedCustomer,
    candidates: resolution.candidates,
  };
});

// Assertions:
// 1. Draft 1 matches cust-1
assert.strictEqual(processedDrafts[0].identityStatus, 'EXACT_PHONE_AND_NAME');
assert.strictEqual(processedDrafts[0].matchedCustomer?.id, 'cust-1');
console.log('✅ PASS: Draft 1 correctly resolved to existing customer (cust-1)');

// 2. Draft 2 matches SAME customer cust-1 without creating duplicate customer
assert.strictEqual(processedDrafts[1].identityStatus, 'EXACT_PHONE_AND_NAME');
assert.strictEqual(processedDrafts[1].matchedCustomer?.id, 'cust-1');
console.log('✅ PASS: Draft 2 for same customer links to same ID (no duplicate)');

// 3. Draft 3 is a genuine new customer
assert.strictEqual(processedDrafts[2].identityStatus, 'NO_MATCH');
assert.strictEqual(processedDrafts[2].matchedCustomer, null);
console.log('✅ PASS: Draft 3 correctly identified as new customer');

// 4. Draft 4 has phone conflict and is NOT auto-linked
assert.strictEqual(processedDrafts[3].identityStatus, 'PHONE_CONFLICT');
assert.strictEqual(processedDrafts[3].matchedCustomer, null);
console.log('✅ PASS: Draft 4 caught in PHONE_CONFLICT gate (no contamination)');

// 5. Draft 5 with Shop B customer does NOT cross-contaminate Shop A
assert.strictEqual(processedDrafts[4].identityStatus, 'NO_MATCH');
assert.strictEqual(processedDrafts[4].matchedCustomer, null);
console.log('✅ PASS: Draft 5 strictly isolated from Shop B customer');

console.log('\n🎉 ALL BULK SCAN DRAFT RESOLUTION TESTS PASSED!\n');
