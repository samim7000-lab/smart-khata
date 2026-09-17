// Security & Preflight Test for Deployed Supabase Edge Function: gemini-ocr
import assert from 'assert';

const FUNCTION_URL = 'https://potkfdjaxgebefqwkmju.supabase.co/functions/v1/gemini-ocr';

async function testEdgeFunction() {
  console.log('Testing Deployed Edge Function Security Gates at:', FUNCTION_URL);

  // 1. CORS Preflight Test (OPTIONS)
  console.log('1. Testing CORS OPTIONS Preflight...');
  const optionsRes = await fetch(FUNCTION_URL, {
    method: 'OPTIONS',
  });
  assert.strictEqual(optionsRes.status, 200, 'OPTIONS preflight should return 200');
  console.log('✅ PASS: CORS OPTIONS Preflight returns 200');

  // 2. Unauthorized Missing Token Test
  console.log('2. Testing Missing Authorization Header...');
  const unauthRes = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: 'test' }),
  });
  assert.strictEqual(unauthRes.status, 401, 'Missing token should return 401 Unauthorized');
  const unauthBody = await unauthRes.json();
  assert.strictEqual(unauthBody.status, 'unauthorized');
  console.log('✅ PASS: Missing Authorization Header rejected with 401');

  // 3. Fake / Expired Token Test
  console.log('3. Testing Fake Bearer Token...');
  const fakeTokenRes = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature',
    },
    body: JSON.stringify({ imageBase64: 'test' }),
  });
  assert.strictEqual(fakeTokenRes.status, 401, 'Fake token should return 401 Unauthorized');
  console.log('✅ PASS: Fake Token safely rejected with 401');

  console.log('\n🎉 ALL EDGE FUNCTION DEPLOYMENT & SECURITY TESTS SUCCEEDED!');
}

testEdgeFunction().catch((err) => {
  console.error('❌ Edge Function test failed:', err);
  process.exit(1);
});
