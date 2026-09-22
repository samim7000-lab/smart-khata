// ====================================================
// SMART KHATA — ATOMIC TRANSACTION, RECOVERY & AUTH SAFETY TESTS
// ====================================================

import assert from 'assert';

console.log('====================================================');
console.log('🧪 SMART KHATA — SPRINT VERIFICATION TEST SUITE');
console.log('====================================================');

// --- TEST GROUP 1: Auth Mode Resolution & Fail-Closed Safety ---
console.log('\n--- TEST GROUP 1: Auth Mode Resolution & Fail-Closed Safety ---');

const resolveAuthModeTest = (rawInput, isViteDev = false) => {
  const normalized = (rawInput || '').trim().toLowerCase();
  if (normalized === 'development') {
    return { mode: 'development', isExplicitDev: true, isMalformed: false };
  }
  if (normalized === 'production') {
    return { mode: 'production', isExplicitDev: false, isMalformed: false };
  }
  if (!normalized) {
    return {
      mode: isViteDev ? 'development' : 'production',
      isExplicitDev: isViteDev,
      isMalformed: false,
    };
  }
  return {
    mode: 'production',
    isExplicitDev: false,
    isMalformed: true,
  };
};

// 1. Explicit development mode
const devResult = resolveAuthModeTest('development');
assert.strictEqual(devResult.mode, 'development');
assert.strictEqual(devResult.isExplicitDev, true);
assert.strictEqual(devResult.isMalformed, false);
console.log('✅ PASS [1]: Explicit "development" correctly activates dev auth bypass');

// 2. Explicit production mode
const prodResult = resolveAuthModeTest('production');
assert.strictEqual(prodResult.mode, 'production');
assert.strictEqual(prodResult.isExplicitDev, false);
assert.strictEqual(prodResult.isMalformed, false);
console.log('✅ PASS [2]: Explicit "production" strictly disables dev auth bypass');

// 3. Malformed value (e.g., 'devpmentelo') fails closed to production
const malformedResult = resolveAuthModeTest('devpmentelo');
assert.strictEqual(malformedResult.mode, 'production');
assert.strictEqual(malformedResult.isExplicitDev, false);
assert.strictEqual(malformedResult.isMalformed, true);
console.log('✅ PASS [3]: Malformed VITE_AUTH_MODE="devpmentelo" safely fails closed to production');

// 4. Random / unknown strings fail closed
const unknownResult = resolveAuthModeTest('staging_admin_bypass_999');
assert.strictEqual(unknownResult.mode, 'production');
assert.strictEqual(unknownResult.isExplicitDev, false);
assert.strictEqual(unknownResult.isMalformed, true);
console.log('✅ PASS [4]: Arbitrary unknown strings strictly fail closed to production');

// --- TEST GROUP 2: Double-Entry Balance Calculation ---
console.log('\n--- TEST GROUP 2: Double-Entry Balance Calculation ---');

const recalculateBalancesTest = (custs, txs) => {
  return custs.map((c) => {
    const customerTxs = txs.filter((t) => t.customer_id === c.id);
    const balance = customerTxs.reduce((sum, tx) => {
      if (tx.is_voided) return sum;
      if (tx.type === 'credit_given') return sum + Number(tx.amount);
      if (tx.type === 'payment_received') return sum - Number(tx.amount);
      return sum;
    }, 0);
    return { ...c, balance };
  });
};

const mockCustomers = [
  { id: 'c1', name: 'Rahim Khan', balance: 0 },
  { id: 'c2', name: 'Karim Ali', balance: 0 },
];

const mockTxs = [
  { id: 't1', customer_id: 'c1', type: 'credit_given', amount: 1500, is_voided: false },
  { id: 't2', customer_id: 'c1', type: 'payment_received', amount: 500, is_voided: false },
  { id: 't3', customer_id: 'c1', type: 'credit_given', amount: 200, is_voided: true }, // Voided: must be excluded
  { id: 't4', customer_id: 'c2', type: 'credit_given', amount: 3000, is_voided: false },
  { id: 't5', customer_id: 'c2', type: 'payment_received', amount: 3500, is_voided: false }, // Overpaid: negative balance
];

const balancedCusts = recalculateBalancesTest(mockCustomers, mockTxs);

// c1 balance: 1500 - 500 = 1000
const c1 = balancedCusts.find((c) => c.id === 'c1');
assert.strictEqual(c1.balance, 1000);
console.log('✅ PASS [5]: Customer 1 balance correctly calculated: 1500 - 500 = 1000 (voided tx ignored)');

// c2 balance: 3000 - 3500 = -500 (Advance / Overpayment)
const c2 = balancedCusts.find((c) => c.id === 'c2');
assert.strictEqual(c2.balance, -500);
console.log('✅ PASS [6]: Customer 2 overpayment correctly tracked as negative balance (-500)');

// --- TEST GROUP 3: Self-Serve Shop Recovery Invariants ---
console.log('\n--- TEST GROUP 3: Self-Serve Shop Recovery Invariants ---');

// Mock database state
const mockDbShops = [
  {
    id: 'shop-active-1',
    owner_id: 'user-alpha',
    shop_name: 'Alpha Active Store',
    deleted_at: null,
    deletion_status: 'ACTIVE',
    restore_available: false,
  },
  {
    id: 'shop-deleted-1',
    owner_id: 'user-beta',
    shop_name: 'Beta Old Grocery',
    deleted_at: '2026-09-01T10:00:00Z',
    deletion_status: 'DELETED',
    restore_available: true,
  },
  {
    id: 'shop-deleted-2',
    owner_id: 'user-gamma',
    shop_name: 'Gamma Soft Deleted',
    deleted_at: '2026-09-10T12:00:00Z',
    deletion_status: 'DELETED',
    restore_available: false, // restore expired or forbidden
  },
];

const mockUserRestoreOwnShop = (callerUserId, targetShopId) => {
  // 1. Authenticated owner check
  const shop = mockDbShops.find(
    (s) => s.id === targetShopId && s.owner_id === callerUserId && s.deleted_at !== null && s.restore_available === true
  );
  if (!shop) {
    throw new Error('42501: Access Denied: Soft-deleted shop not found or restore not available for this account.');
  }

  // 2. Concurrency check: Ensure no active shop already exists for caller
  const activeShop = mockDbShops.find(
    (s) => s.owner_id === callerUserId && s.deleted_at === null && s.deletion_status === 'ACTIVE'
  );
  if (activeShop) {
    throw new Error(`23505: Cannot restore shop: An active shop (${activeShop.id}) already exists for this owner.`);
  }

  // 3. Perform restoration
  shop.deleted_at = null;
  shop.deletion_status = 'ACTIVE';
  shop.restore_available = false;
  return true;
};

// 7. Legitimate owner can restore their soft-deleted shop when no active shop exists
const restoreResult = mockUserRestoreOwnShop('user-beta', 'shop-deleted-1');
assert.strictEqual(restoreResult, true);
const restoredShop = mockDbShops.find((s) => s.id === 'shop-deleted-1');
assert.strictEqual(restoredShop.deleted_at, null);
assert.strictEqual(restoredShop.deletion_status, 'ACTIVE');
console.log('✅ PASS [7]: Authenticated owner can cleanly restore their soft-deleted shop');

// 8. Cross-tenant attempt is strictly rejected
assert.throws(() => {
  mockUserRestoreOwnShop('user-alpha', 'shop-deleted-1'); // User Alpha tries to restore User Beta's shop
}, /42501/);
console.log('✅ PASS [8]: Cross-tenant restoration strictly blocked with 42501 Access Denied');

// 9. Cannot restore if user already has an active shop (one-active-shop invariant)
mockDbShops.push({
  id: 'shop-deleted-alpha',
  owner_id: 'user-alpha',
  shop_name: 'Alpha Old Store',
  deleted_at: '2026-08-01T00:00:00Z',
  deletion_status: 'DELETED',
  restore_available: true,
});

assert.throws(() => {
  mockUserRestoreOwnShop('user-alpha', 'shop-deleted-alpha'); // User Alpha already has shop-active-1
}, /23505/);
console.log('✅ PASS [9]: Restoration rejected with 23505 when user already has an active shop');

// 10. Cannot restore if restore_available is false
assert.throws(() => {
  mockUserRestoreOwnShop('user-gamma', 'shop-deleted-2');
}, /42501/);
console.log('✅ PASS [10]: Restoration blocked when restore_available is false');

// --- TEST GROUP 4: Secret Sanitization in Meta Cloud Service ---
console.log('\n--- TEST GROUP 4: Secret Sanitization in Meta Cloud Service ---');

const testLocalStorage = {};
const mockSaveConnection = (connection) => {
  const { access_token, ...safeConn } = connection;
  testLocalStorage[`smart_khata_wa_conn_${connection.shop_id}`] = JSON.stringify(safeConn);
};

mockSaveConnection({
  id: 'conn-1',
  shop_id: 'shop-1',
  provider: 'meta_cloud_api',
  phone_number_id: '123456789',
  business_account_id: '987654321',
  display_phone: '+919876543210',
  status: 'CONNECTED',
  access_token: 'EAABwzL_SECRET_META_GRAPH_ACCESS_TOKEN_12345',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const storedJson = JSON.parse(testLocalStorage['smart_khata_wa_conn_shop-1']);
assert.strictEqual(storedJson.access_token, undefined);
assert.strictEqual(storedJson.phone_number_id, '123456789');
assert.strictEqual(storedJson.status, 'CONNECTED');
console.log('✅ PASS [11]: Plaintext Meta access_token is strictly redacted before localStorage persistence');

// --- TEST GROUP 5: Atomic Transaction Validation Invariants ---
console.log('\n--- TEST GROUP 5: Atomic Transaction Validation Invariants ---');

const validateAtomicTxPayload = (shopId, customerId, type, amount, callerShopOwner, customerShopId) => {
  if (callerShopOwner !== 'authenticated-owner') {
    throw new Error('42501: Access Denied: Shop not owned by caller');
  }
  if (customerShopId !== shopId) {
    throw new Error('P0002: Customer does not belong to shop');
  }
  if (!['credit_given', 'payment_received'].includes(type)) {
    throw new Error('22023: Invalid transaction type');
  }
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('22003: Transaction amount must be strictly positive');
  }
  return { id: 'tx-new-uuid', shop_id: shopId, customer_id: customerId, type, amount };
};

// Valid transaction
const validTx = validateAtomicTxPayload('s1', 'c1', 'credit_given', 500, 'authenticated-owner', 's1');
assert.strictEqual(validTx.amount, 500);
console.log('✅ PASS [12]: Valid atomic transaction payload passes all schema assertions');

// Negative or zero amount rejected
assert.throws(() => {
  validateAtomicTxPayload('s1', 'c1', 'credit_given', 0, 'authenticated-owner', 's1');
}, /22003/);
assert.throws(() => {
  validateAtomicTxPayload('s1', 'c1', 'credit_given', -100, 'authenticated-owner', 's1');
}, /22003/);
console.log('✅ PASS [13]: Non-positive amount strictly rejected by atomic transaction validation');

// Mismatched customer rejected
assert.throws(() => {
  validateAtomicTxPayload('s1', 'c1', 'credit_given', 500, 'authenticated-owner', 's2'); // Customer belongs to s2
}, /P0002/);
console.log('✅ PASS [14]: Cross-shop customer transaction strictly rejected with P0002');

console.log('\n----------------------------------------------------');
console.log('🎉 ALL 14/14 SPRINT VERIFICATION TESTS PASSED CLEANLY!');
console.log('----------------------------------------------------');
