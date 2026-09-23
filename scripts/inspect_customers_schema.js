import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://potkfdjaxgebefqwkmju.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2wV7ABdzA5adhmhhboL68g_EY-F8mqF';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  console.log('====================================================');
  console.log('🔍 INSPECTING REMOTE SUPABASE public.customers SCHEMA');
  console.log('====================================================\n');

  // 1. Select all columns from customers
  const { data, error } = await supabase.from('customers').select('*').limit(3);
  if (error) {
    console.error('❌ Select * error:', error);
  } else {
    console.log('✅ Query succeeded. Total rows returned:', data.length);
    if (data.length > 0) {
      console.log('Existing columns in public.customers:');
      console.log(Object.keys(data[0]));
    } else {
      console.log('No rows in table yet to extract keys from data[0].');
    }
  }

  // 2. Test selecting specific columns: address, credit_limit, gstin, state
  const testCols = ['id', 'shop_id', 'name', 'phone_number', 'display_label', 'state', 'address', 'credit_limit', 'gstin'];
  for (const col of testCols) {
    const { error: colErr } = await supabase.from('customers').select(col).limit(1);
    if (colErr) {
      console.log(`❌ Column "${col}": MISSING (${colErr.message})`);
    } else {
      console.log(`✅ Column "${col}": EXISTS`);
    }
  }

  // 3. Test insert with address
  console.log('\n--- Testing INSERT with address payload ---');
  const dummyShopId = '00000000-0000-4000-a000-000000000000';
  const { data: insData, error: insError } = await supabase.from('customers').insert({
    shop_id: dummyShopId,
    name: 'Schema Test Customer',
    phone_number: '1234567890',
    display_label: 'Schema Test Customer',
    address: '123 Test Street'
  }).select();

  if (insError) {
    console.log('❌ Insert with address failed:', insError.message, `(Code: ${insError.code})`);
  } else {
    console.log('✅ Insert with address succeeded:', insData);
  }
}

inspect().catch(console.error);
