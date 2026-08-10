import { createClient } from '@supabase/supabase-js';
import { Customer, Shop, Transaction } from '../types';

const cleanUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const cleanKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  cleanUrl &&
  cleanKey &&
  cleanUrl.startsWith('http') &&
  !cleanUrl.includes('your-project-id') &&
  cleanKey !== 'your-anon-key-here' &&
  cleanKey !== 'undefined' &&
  cleanKey.length > 20
);

export const authMode = import.meta.env.VITE_AUTH_MODE || (import.meta.env.VITE_DEV_MODE === 'false' ? 'production' : 'development');
export const isDevAuth = authMode === 'development';
export const isDevMode = isDevAuth;

export const supabase = isSupabaseConfigured
  ? createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'smart_khata_supabase_auth_token',
        storage: window.localStorage,
      },
      global: {
        headers: {
          apikey: cleanKey,
        },
      },
    })
  : null;

// --- LOCAL MOCK DATABASE FOR INSTANT PREVIEW AND DEMO ---
const MOCK_STORAGE_KEY_SHOP = 'smart_khata_mock_shop';
const MOCK_STORAGE_KEY_CUSTOMERS = 'smart_khata_mock_customers';
const MOCK_STORAGE_KEY_TRANSACTIONS = 'smart_khata_mock_transactions';

const initialMockShop: Shop = {
  id: 'shop-demo-1',
  owner_id: 'user-demo-1',
  shop_name: 'Bismillah General Store',
  owner_name: 'Mohammad Rahim',
  preferred_language: 'bn',
  country: 'IN',
  currency_code: 'INR',
  gst_enabled: false,
  created_at: new Date().toISOString(),
};

const initialMockCustomers: Customer[] = [
  {
    id: 'cust-1',
    shop_id: 'shop-demo-1',
    name: 'Karim Uncle',
    phone_number: '01711223344',
    display_label: 'Karim Uncle (01711223344)',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'cust-2',
    shop_id: 'shop-demo-1',
    name: 'Rafiq Saheb',
    phone_number: '01899887766',
    display_label: 'Rafiq Saheb (01899887766)',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'cust-3',
    shop_id: 'shop-demo-1',
    name: 'Suman Kumar',
    phone_number: '01922334455',
    display_label: 'Suman Kumar (01922334455)',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  }
];

const initialMockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    shop_id: 'shop-demo-1',
    customer_id: 'cust-1',
    type: 'credit_given',
    amount: 1500,
    note: 'Rice 10kg, Oil 2L',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'tx-2',
    shop_id: 'shop-demo-1',
    customer_id: 'cust-1',
    type: 'credit_given',
    amount: 350,
    note: 'Tea & Sugar',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'tx-3',
    shop_id: 'shop-demo-1',
    customer_id: 'cust-2',
    type: 'credit_given',
    amount: 2400,
    note: 'Monthly ration list',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'tx-4',
    shop_id: 'shop-demo-1',
    customer_id: 'cust-2',
    type: 'payment_received',
    amount: 2400,
    note: 'Full bKash payment',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  }
];

export const getStoredMockShop = (): Shop | null => {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY_SHOP);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveMockShop = (shop: Shop): void => {
  localStorage.setItem(MOCK_STORAGE_KEY_SHOP, JSON.stringify(shop));
};

export const getStoredMockCustomers = (): Customer[] => {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY_CUSTOMERS);
  if (!raw) {
    localStorage.setItem(MOCK_STORAGE_KEY_CUSTOMERS, JSON.stringify(initialMockCustomers));
    return initialMockCustomers;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return initialMockCustomers;
  }
};

export const saveMockCustomers = (customers: Customer[]): void => {
  localStorage.setItem(MOCK_STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
};

export const getStoredMockTransactions = (): Transaction[] => {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY_TRANSACTIONS);
  if (!raw) {
    localStorage.setItem(MOCK_STORAGE_KEY_TRANSACTIONS, JSON.stringify(initialMockTransactions));
    return initialMockTransactions;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return initialMockTransactions;
  }
};

export const saveMockTransactions = (transactions: Transaction[]): void => {
  localStorage.setItem(MOCK_STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
};
