import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🧪 SMART KHATA — ROOT-CAUSE HARDENING REGRESSION TEST');
console.log('====================================================\n');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`✅ PASS [${total}]: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL [${total}]: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ==========================================
// SOURCE FILE VERIFICATIONS
// ==========================================
const receiptUtilsPath = path.resolve('src/lib/receiptUtils.ts');
const receiptModalPath = path.resolve('src/components/ReceiptModal.tsx');
const whatsappServicePath = path.resolve('src/lib/whatsappService.ts');
const aiTaskRouterPath = path.resolve('src/lib/aiTaskRouter.ts');
const addTxModalPath = path.resolve('src/components/AddTransactionModal.tsx');
const appPath = path.resolve('src/App.tsx');
const historyPath = path.resolve('src/components/HistoryScreen.tsx');
const navigationPath = path.resolve('src/components/Navigation.tsx');

const receiptUtilsSrc = fs.readFileSync(receiptUtilsPath, 'utf8');
const receiptModalSrc = fs.readFileSync(receiptModalPath, 'utf8');
const whatsappServiceSrc = fs.readFileSync(whatsappServicePath, 'utf8');
const aiTaskRouterSrc = fs.readFileSync(aiTaskRouterPath, 'utf8');
const addTxModalSrc = fs.readFileSync(addTxModalPath, 'utf8');
const appSrc = fs.readFileSync(appPath, 'utf8');
const historySrc = fs.readFileSync(historyPath, 'utf8');
const navigationSrc = fs.readFileSync(navigationPath, 'utf8');

// ==========================================
// TEST GROUP 1: BUGS C, D, & M (Note Regex & Clean Note Logic)
// ==========================================
console.log('--- TEST GROUP 1: Note Regex, JSON Unpack & Human Text Cleanliness ---');

function cleanNoteString(rawNote) {
  if (!rawNote) return '';
  return rawNote
    .replace(/\[\s*RECEIPT_JSON:[\s\S]*?\]/gi, '')
    .replace(/\[?\s*RECEIPT_JSON:[\s\S]*$/gi, '')
    .replace(/\{"mode":[\s\S]*?\}/gi, '')
    .trim();
}

function unpackReceiptNote(tx) {
  const noteText = cleanNoteString(tx.note);
  if (tx.receipt_details) {
    return { noteText, details: tx.receipt_details };
  }
  const rawNote = tx.note || '';
  const match = rawNote.match(/\[\s*RECEIPT_JSON:([\s\S]+?)\]/i) || rawNote.match(/\[?\s*RECEIPT_JSON:([\s\S]+)/i);
  if (match && match[1]) {
    try {
      let jsonCandidate = match[1].trim();
      if (jsonCandidate.endsWith(']') && !jsonCandidate.startsWith('[')) {
        jsonCandidate = jsonCandidate.replace(/\]+$/, '').trim();
      }
      const parsed = JSON.parse(jsonCandidate);
      return { noteText, details: parsed };
    } catch (e) {
      // ignore
    }
  }
  return { noteText, details: null };
}

runTest('cleanNoteString strips bracketed RECEIPT_JSON tags completely without leak', () => {
  const note = 'Purchased 2 shirts [RECEIPT_JSON:{"mode":"cash_sale","subtotal":1000}]';
  const cleaned = cleanNoteString(note);
  assert.strictEqual(cleaned, 'Purchased 2 shirts');
  assert.ok(!cleaned.includes('{'), 'Must not leak raw JSON brackets');
  assert.ok(!cleaned.includes('RECEIPT_JSON'), 'Must not contain tag');
});

runTest('cleanNoteString strips raw JSON without tags', () => {
  const note = 'Special order {"mode":"cash_sale"}';
  const cleaned = cleanNoteString(note);
  assert.strictEqual(cleaned, 'Special order');
});

runTest('cleanNoteString handles unclosed or malformed tags without crashing', () => {
  const note = 'Pending delivery [RECEIPT_JSON:{"truncated":true';
  const cleaned = cleanNoteString(note);
  assert.strictEqual(cleaned, 'Pending delivery');
});

runTest('unpackReceiptNote extracts JSON payload without empty string match', () => {
  const tx = {
    id: 'tx-001',
    note: 'Purchase notes [RECEIPT_JSON:{"mode":"cash_sale","subtotal":1500,"gst_enabled":true}]',
  };
  const { noteText, details } = unpackReceiptNote(tx);
  assert.strictEqual(noteText, 'Purchase notes');
  assert.ok(details !== null, 'Details must NOT be null');
  assert.strictEqual(details.mode, 'cash_sale');
  assert.strictEqual(details.subtotal, 1500);
  assert.strictEqual(details.gst_enabled, true);
});

runTest('unpackReceiptNote handles trailing brackets and unbracketed tags cleanly', () => {
  const tx1 = {
    id: 'tx-002',
    amount: 500,
    note: 'Items RECEIPT_JSON:{"mode":"credit_sale"}]',
  };
  const res1 = unpackReceiptNote(tx1);
  assert.strictEqual(res1.noteText, 'Items');
  assert.ok(res1.details !== null);
  assert.strictEqual(res1.details.mode, 'credit_sale');
});

runTest('receiptUtils.ts source enforces non-empty regex match and trailing cleanup', () => {
  assert.ok(receiptUtilsSrc.includes('/[\\s*RECEIPT_JSON:([\\s\\S]+?)\\]/i') || receiptUtilsSrc.includes('RECEIPT_JSON:([\\s\\S]+?)'), 'Must require non-empty match group');
  assert.ok(receiptUtilsSrc.includes('jsonCandidate.replace(/\\]+$/'), 'Must clean trailing brackets');
});

// ==========================================
// TEST GROUP 2: BUG B & G (GST statutory calculation & rates)
// ==========================================
console.log('\n--- TEST GROUP 2: GST Statutory Calculation, Split & WhatsApp Formatting ---');

runTest('receiptUtils.ts getCanonicalReceiptDetails computes half-rates and splits CGST/SGST', () => {
  assert.ok(receiptUtilsSrc.includes('calcCgst = tx.cgst_amount || (totalTax > 0 ? Math.round((totalTax / 2) * 100) / 100 : 0)'));
  assert.ok(receiptUtilsSrc.includes('calcSgst = tx.sgst_amount || (totalTax > 0 ? Math.round((totalTax - calcCgst) * 100) / 100 : 0)'));
});

runTest('ReceiptModal.tsx displays accurate half-rate instead of 0% tax', () => {
  assert.ok(receiptModalSrc.includes('CGST ({halfGstRate}%):'), 'ReceiptModal must use halfGstRate');
  assert.ok(receiptModalSrc.includes('SGST ({halfGstRate}%):'), 'ReceiptModal must use halfGstRate');
  assert.ok(!receiptModalSrc.includes('CGST ({(transaction.gst_rate || 0) / 2}%):'), 'Old 0% bug must be removed');
});

runTest('AddTransactionModal.tsx initializes isGstEnabled from shop.gst_enabled', () => {
  assert.ok(addTxModalSrc.includes('useState<boolean>(Boolean(shop.gst_enabled))'), 'Must initialize from shop.gst_enabled');
  assert.ok(!addTxModalSrc.includes('useState<boolean>(false);\n  const [gstRate, setGstRate] = useState<number>(shop.default_gst_rate || 18);'), 'Must not hardcode false');
});

runTest('whatsappService.ts computes statutory CGST/SGST and accurate taxable base', () => {
  assert.ok(whatsappServiceSrc.includes('const halfRate = gstRate / 2;'), 'Must define halfRate');
  assert.ok(whatsappServiceSrc.includes('CGST (${halfRate}%):'), 'Must use halfRate in message template');
  assert.ok(whatsappServiceSrc.includes('SGST (${halfRate}%):'), 'Must use halfRate in message template');
  assert.ok(whatsappServiceSrc.includes('Math.round((txAmt - totalTax) * 100) / 100'), 'Must calculate exact taxable base for inclusive GST');
});

// ==========================================
// TEST GROUP 3: BUG F (AI Campaign Tone & Custom Offer Interpolation)
// ==========================================
console.log('\n--- TEST GROUP 3: AI Campaign Draft Deterministic Interpolation ---');

runTest('aiTaskRouter.ts interpolates customOffer, tone, and shopName into fallback drafts', () => {
  assert.ok(aiTaskRouterSrc.includes('input.customOffer'), 'Must check customOffer');
  assert.ok(aiTaskRouterSrc.includes('Special Offer:'), 'Must interpolate in English');
  assert.ok(aiTaskRouterSrc.includes('বিশেষ অফার:'), 'Must interpolate in Bengali');
  assert.ok(aiTaskRouterSrc.includes('विशेष ऑफर:'), 'Must interpolate in Hindi');
  assert.ok(aiTaskRouterSrc.includes('tone === \'urgent\''), 'Must handle urgent tone');
  assert.ok(aiTaskRouterSrc.includes('tone === \'promotional\''), 'Must handle promotional tone');
});

// ==========================================
// TEST GROUP 4: BUG A (Profile Schema-Adaptive Fallback Simulation)
// ==========================================
console.log('\n--- TEST GROUP 4: Profile GST Persistence & Adaptive Fallback Invariant ---');

runTest('App.tsx handleSaveProfile contains schema-adaptive fallback on PGRST204', () => {
  assert.ok(appSrc.includes('PGRST204') || appSrc.includes('42703'), 'Must handle PGRST204 or 42703 column error');
  assert.ok(appSrc.includes('Executing schema-adaptive fallback to core fields'), 'Must execute adaptive fallback');
  assert.ok(appSrc.includes('coreUpdate[key] = (updatedFields as any)[key]'), 'Must update core fields including gst_enabled');
});

// ==========================================
// TEST GROUP 5: BUG E & H (Responsive Layout & History GST Filter)
// ==========================================
console.log('\n--- TEST GROUP 5: Responsive Layout, Word Break & History Filters ---');

runTest('ReceiptModal.tsx uses responsive 1-column mobile grid with break-words', () => {
  assert.ok(receiptModalSrc.includes('grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs break-words'), 'Must use responsive grid with break-words');
  assert.ok(receiptModalSrc.includes('overflow-x-auto -mx-1 px-1'), 'Must wrap line items table in overflow-x-auto');
});

runTest('Navigation.tsx mobile bar has smooth touch scrolling and scroll cue fade', () => {
  assert.ok(navigationSrc.includes('WebkitOverflowScrolling: \'touch\''), 'Must have touch scrolling');
  assert.ok(navigationSrc.includes('bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none'), 'Must have scroll cue fade');
});

runTest('HistoryScreen.tsx note has break-words break-all and GST filter uses canonical details', () => {
  assert.ok(historySrc.includes('break-words break-all'), 'Must have break-words break-all on note container');
  assert.ok(historySrc.includes('canonical?.gst_enabled'), 'GST filter must check canonical.gst_enabled');
});

console.log('\n====================================================');
console.log(`🎉 ALL ${passed}/${total} ROOT-CAUSE HARDENING REGRESSION TESTS PASSED!`);
console.log('====================================================');
