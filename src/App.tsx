import React, { useState, useEffect } from 'react';
import { Customer, Language, Shop, Transaction, TransactionType } from './types';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LanguageSelector } from './components/LanguageSelector';
import { PhoneAuth } from './components/PhoneAuth';
import { ShopSetup } from './components/ShopSetup';
import { Navbar } from './components/Navbar';
import { Navigation, NavTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { CustomersScreen } from './components/CustomersScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { CustomerDetail } from './components/CustomerDetail';
import { ProfileScreen } from './components/ProfileScreen';
import { AddTransactionModal } from './components/AddTransactionModal';
import { ScanLedgerModal } from './components/ScanLedgerModal';
import { ReceiptModal } from './components/ReceiptModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { ShopsModal } from './components/ShopsModal';
import { StaffModal } from './components/StaffModal';
import { UpgradeModal } from './components/UpgradeModal';
import { CampaignsScreen } from './components/CampaignsScreen';
import { AIRecoveryDashboard } from './components/AIRecoveryDashboard';
import { SmartKhataLogo } from './components/SmartKhataLogo';
import { PlanTier } from './types';
import {
  isSupabaseConfigured,
  isDevAuth,
  supabase,
  getStoredMockShop,
  saveMockShop,
  getStoredMockCustomers,
  saveMockCustomers,
  getStoredMockTransactions,
  saveMockTransactions
} from './lib/supabase';

import { Loader2 } from 'lucide-react';

// Helper to validate canonical PostgreSQL UUID string format
const isValidUuid = (val?: string | null): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

export const App: React.FC = () => {
  // Auth Session Initialization State (Prevents race conditions on Google OAuth redirect)
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(true);

  // Onboarding & App State (Single source of truth for language: localStorage -> 'bn')
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('smart_khata_lang') as Language) || 'bn';
  });

  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    const devUserRaw = localStorage.getItem('smart_khata_dev_user');
    if (devUserRaw) {
      try {
        const parsed = JSON.parse(devUserRaw);
        return parsed.id || null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [screen, setScreen] = useState<
    'welcome' | 'language_select' | 'phone_auth' | 'shop_setup' | 'main' | 'customer_detail'
  >(() => {
    const onboardingDone = localStorage.getItem('smart_khata_onboarding_completed');
    const savedLang = localStorage.getItem('smart_khata_lang');

    if (onboardingDone) {
      const mockShop = getStoredMockShop();
      if (mockShop && !isSupabaseConfigured) return 'main';
    }

    if (savedLang) return 'phone_auth';
    return 'language_select';
  });

  // Global Theme State ('light' | 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('smart_khata_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Global Network Status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('smart_khata_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleRestoreBackup = (backupData: any) => {
    if (backupData.shop) {
      setShop(backupData.shop);
      saveMockShop(backupData.shop);
    }
    if (Array.isArray(backupData.customers)) {
      setCustomers(backupData.customers);
      saveMockCustomers(backupData.customers);
    }
    if (Array.isArray(backupData.transactions)) {
      setTransactions(backupData.transactions);
      saveMockTransactions(backupData.transactions);
    }
  };

  const [activeTab, setActiveTab] = useState<NavTab>('home');

  // In Supabase mode, shop starts null until resolved from database via fetchUserShop
  const [shop, setShop] = useState<Shop | null>(() => {
    if (isSupabaseConfigured && supabase) {
      return null;
    }
    return getStoredMockShop();
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Navigation / Modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isScanLedgerOpen, setIsScanLedgerOpen] = useState(false);
  const [preSelectedTxType, setPreSelectedTxType] = useState<TransactionType | undefined>();
  const [receiptModalData, setReceiptModalData] = useState<{
    tx: Transaction;
    customer: Customer;
  } | null>(null);

  // Phase G Enterprise Modals State
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isShopsOpen, setIsShopsOpen] = useState(false);
  const [isStaffOpen, setIsStaffOpen] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState<string | null>(null);

  const [userShops, setUserShops] = useState<Shop[]>(() => {
    if (isSupabaseConfigured && supabase) return [];
    const initial = getStoredMockShop();
    return initial ? [initial] : [];
  });

  const handleSelectPlan = (tier: PlanTier) => {
    if (shop) {
      handleSaveProfile({ plan_tier: tier });
    }
  };

  const handleSwitchActiveShop = (shopId: string) => {
    const target = userShops.find((s) => s.id === shopId);
    if (target) {
      setShop(target);
      if (!isSupabaseConfigured) saveMockShop(target);
    }
  };

  const handleCreateNewShop = async (shopName: string, ownerName: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user) {
          const { data, error } = await supabase
            .from('shops')
            .insert({
              owner_id: authUser.user.id,
              shop_name: shopName,
              owner_name: ownerName,
              preferred_language: language,
              gst_enabled: false,
            })
            .select()
            .single();

          if (error) throw error;
          if (data) {
            console.log('[REAL AUTH DEBUG] Multi-shop created with valid UUID:', data.id);
            setShop(data);
            setUserShops((prev) => [...prev, data]);
            loadSupabaseData(data.id);
            return;
          }
        }
      } catch (err: any) {
        console.error('[REAL AUTH DEBUG] Error creating multi-shop in Supabase:', err.message);
        alert('Could not create new shop: ' + err.message);
        return;
      }
    }

    const newShop: Shop = {
      id: `shop-${Date.now()}`,
      owner_id: activeUserId || 'owner-1',
      shop_name: shopName,
      owner_name: ownerName,
      preferred_language: language,
      gst_enabled: false,
      created_at: new Date().toISOString(),
      currency_code: shop?.currency_code || 'BDT',
      country: shop?.country || 'BD',
    };
    const updated = [...userShops, newShop];
    setUserShops(updated);
    setShop(newShop);
    saveMockShop(newShop);
  };

  const handleDeleteShop = (shopId: string) => {
    if (userShops.length <= 1) return;
    const updated = userShops.filter((s) => s.id !== shopId);
    setUserShops(updated);
    if (shop?.id === shopId) {
      setShop(updated[0]);
      saveMockShop(updated[0]);
    }
  };

  const [authUserMeta, setAuthUserMeta] = useState<{
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  }>({
    email: localStorage.getItem('smart_khata_last_account_email'),
    name: localStorage.getItem('smart_khata_last_account_name'),
    avatarUrl: localStorage.getItem('smart_khata_last_account_avatar'),
  });

  // Initial Auth Listener for Real Supabase Mode
  useEffect(() => {
    console.log(`[AUTH] Initializing App (isSupabaseConfigured: ${isSupabaseConfigured})`);
    
    const saveGoogleMetadata = (user: any) => {
      if (!user) return;
      const meta = user.user_metadata || {};
      const avatarUrl = meta.avatar_url || meta.picture || null;
      const fullName = meta.full_name || meta.name || null;
      const email = user.email || null;

      setAuthUserMeta({
        email,
        name: fullName,
        avatarUrl,
      });

      if (avatarUrl) {
        localStorage.setItem('smart_khata_last_account_avatar', avatarUrl);
        localStorage.setItem('smart_khata_user_avatar', avatarUrl);
      }
      if (fullName) {
        localStorage.setItem('smart_khata_last_account_name', fullName);
      }
      if (email) {
        localStorage.setItem('smart_khata_last_account_email', email);
      }
    };

    const initAuth = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          // 1. Check for active session (handles OAuth callback redirect)
          const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) console.warn('[AUTH DEBUG] getSession error:', sessionErr.message);

          if (session?.user) {
            console.log(`[AUTH DEBUG] Active session found for user: ${session.user.id}`);
            saveGoogleMetadata(session.user);
            setActiveUserId(session.user.id);
            await fetchUserShop(session.user.id);
          } else {
            console.log('[AUTH DEBUG] No active Supabase OAuth session found on initialization');
            const devUserRaw = localStorage.getItem('smart_khata_dev_user');
            if (devUserRaw) {
              try {
                const devUser = JSON.parse(devUserRaw);
                if (devUser.id) {
                  console.log(`[AUTH DEBUG] Restoring Development OTP user session: ${devUser.id}`);
                  setActiveUserId(devUser.id);
                  await fetchUserShop(devUser.id);
                  return;
                }
              } catch {
                // Ignore invalid dev user JSON
              }
            }
            const savedLang = localStorage.getItem('smart_khata_lang');
            if (savedLang) {
              setScreen((prev) => (prev === 'main' ? 'phone_auth' : prev));
            }
          }
        } catch (err) {
          console.error('[AUTH DEBUG] Session initialization exception:', err);
        } finally {
          setIsAuthInitializing(false);
        }

        // 2. Auth state listener for SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED events
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log(`[AUTH DEBUG] Auth Event: ${event}, User ID: ${session?.user?.id || 'none'}`);
          if (session?.user) {
            saveGoogleMetadata(session.user);
            setActiveUserId(session.user.id);
            await fetchUserShop(session.user.id);
            setIsAuthInitializing(false);
          } else if (event === 'SIGNED_OUT') {
            console.log(`[AUTH DEBUG] User signed out`);
            setActiveUserId(null);
            setShop(null);
            setCustomers([]);
            setTransactions([]);
            setIsAuthInitializing(false);
          }
        });

        return () => {
          authListener.subscription.unsubscribe();
        };
      } else {
        setIsAuthInitializing(false);
      }
      return undefined;
    };

    initAuth();
  }, []);

  const fetchUserShop = async (userId: string) => {
    console.log(`[AUTH DEBUG] fetchUserShop initiated for owner_id: ${userId}`);
    const savedLang = (localStorage.getItem('smart_khata_lang') as Language) || null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('shops')
          .select('*')
          .eq('owner_id', userId)
          .maybeSingle();

        if (error) {
          console.warn('[AUTH DEBUG] Error querying shops from Supabase:', error.message);
          const localShop = getStoredMockShop();
          if (localShop) {
            console.log('[AUTH DEBUG] Falling back to local shop in DEV MODE');
            setShop(localShop);
            setScreen('main');
            return;
          }
        }

        if (data) {
          console.log('[AUTH DEBUG] Found existing shop in database:', data);
          const savedOwnerProfileRaw = localStorage.getItem(`smart_khata_shop_profile_${userId}`);
          let ownerProfileCache: Partial<Shop> = {};
          if (savedOwnerProfileRaw) {
            try {
              ownerProfileCache = JSON.parse(savedOwnerProfileRaw);
            } catch {
              // Ignore invalid cache
            }
          }

          const sanitizedCountry = data.country || localStorage.getItem('smart_khata_last_country') || 'IN';
          const sanitizedCurrency = data.currency_code || (sanitizedCountry === 'BD' ? 'BDT' : 'INR');

          const sanitizedShop: Shop = {
            ...data,
            country: sanitizedCountry,
            currency_code: sanitizedCurrency,
            logo_url: data.logo_url || ownerProfileCache.logo_url || undefined,
            signature_url: data.signature_url || ownerProfileCache.signature_url || undefined,
            shop_photo_url: data.shop_photo_url || ownerProfileCache.shop_photo_url || undefined,
          };

          setShop(sanitizedShop);
          saveMockShop(sanitizedShop);

          // Priority: 1. Explicit user choice in localStorage -> 2. Saved shop language -> 3. Fallback 'bn'
          const effectiveLang = savedLang || (data.preferred_language as Language) || 'bn';
          setLanguage(effectiveLang);
          localStorage.setItem('smart_khata_lang', effectiveLang);

          setScreen('main');
          loadSupabaseData(data.id);
        } else {
          console.log('[AUTH DEBUG] No existing shop found for user. Directing to Shop Setup.');
          setShop(null);
          if (savedLang) {
            setLanguage(savedLang);
          }
          setScreen('shop_setup');
        }
      } catch (err) {
        console.error('[AUTH DEBUG] Exception fetching user shop:', err);
        setScreen('shop_setup');
      }
    } else {
      const localShop = getStoredMockShop();
      if (localShop) {
        setShop(localShop);
        if (savedLang) {
          setLanguage(savedLang);
        }
        setScreen('main');
      } else {
        setScreen('shop_setup');
      }
    }
  };

  // Load Customers & Transactions when shop changes
  useEffect(() => {
    if (shop) {
      if (isSupabaseConfigured && supabase) {
        loadSupabaseData(shop.id);
      } else {
        loadMockData();
      }
    }
  }, [shop?.id]);

  const loadSupabaseData = async (shopId: string) => {
    if (!supabase) return;
    try {
      console.log(`[REAL AUTH TEST] Querying Supabase DB records for shop_id: ${shopId}`);
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: true });

      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (custErr) console.error('[REAL AUTH TEST] Customers fetch error:', custErr.message);
      if (txErr) console.error('[REAL AUTH TEST] Transactions fetch error:', txErr.message);

      const custs = custData || [];
      const txs = txData || [];

      console.log(`[REAL AUTH TEST] Retrieved ${custs.length} customers & ${txs.length} transactions from DB for shop_id: ${shopId}`);

      setTransactions(txs);
      recalculateBalances(custs, txs);
    } catch (err) {
      console.error('[REAL AUTH TEST] Error loading Supabase data', err);
    }
  };

  const loadMockData = () => {
    console.log('[DATA] Loading local records');
    const mockCusts = getStoredMockCustomers();
    const mockTxs = getStoredMockTransactions();
    setTransactions(mockTxs);
    recalculateBalances(mockCusts, mockTxs);
  };

  const recalculateBalances = (custs: Customer[], txs: Transaction[]) => {
    const updated = custs.map((c) => {
      const customerTxs = txs.filter((t) => t.customer_id === c.id);
      const balance = customerTxs.reduce((sum, tx) => {
        if (tx.is_voided) return sum;
        if (tx.type === 'credit_given') return sum + Number(tx.amount);
        if (tx.type === 'payment_received') return sum - Number(tx.amount);
        return sum;
      }, 0);
      return { ...c, balance };
    });
    setCustomers(updated);
  };

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('smart_khata_lang', lang);
    if (shop) {
      const updatedShop = { ...shop, preferred_language: lang };
      setShop(updatedShop);
      saveMockShop(updatedShop);
      if (isSupabaseConfigured && supabase) {
        supabase.from('shops').update({ preferred_language: lang }).eq('id', shop.id).then();
      }
    }
    setScreen('welcome');
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('smart_khata_lang', lang);
    if (shop) {
      const updatedShop = { ...shop, preferred_language: lang };
      setShop(updatedShop);
      saveMockShop(updatedShop);
      if (isSupabaseConfigured && supabase) {
        supabase.from('shops').update({ preferred_language: lang }).eq('id', shop.id).then();
      }
    }
  };

  const handleWelcomeContinue = () => {
    setScreen('phone_auth');
  };

  const handlePhoneAuthSuccess = async (phone: string, userId?: string) => {
    const resolvedUserId = userId || `00000000-0000-4000-a000-${phone.replace(/\D/g, '').padStart(12, '0').slice(-12)}`;
    setActiveUserId(resolvedUserId);
    localStorage.setItem('smart_khata_dev_user', JSON.stringify({ id: resolvedUserId, phone }));

    await fetchUserShop(resolvedUserId);
  };

  const handleShopSetupComplete = async (newShopData: Partial<Shop>) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authUser } = await supabase.auth.getUser();
        const user = authUser?.user;

        if (user) {
          console.log(`[REAL AUTH DEBUG] Creating new shop in Supabase DB for user: ${user.id}`);
          const fullPayload: any = {
            owner_id: user.id,
            shop_name: newShopData.shop_name || 'My Shop',
            owner_name: newShopData.owner_name || 'Owner',
            preferred_language: language,
            gst_enabled: false,
          };

          if (newShopData.phone) fullPayload.phone = newShopData.phone;
          if (newShopData.whatsapp_number) fullPayload.whatsapp_number = newShopData.whatsapp_number;
          if (newShopData.country) fullPayload.country = newShopData.country;
          if (newShopData.currency_code) fullPayload.currency_code = newShopData.currency_code;
          if (newShopData.business_type) fullPayload.business_type = newShopData.business_type;

          let { data, error } = await supabase
            .from('shops')
            .insert(fullPayload)
            .select()
            .single();

          // Fallback to base schema payload if schema cache does not have extended columns yet
          if (error && (error.message?.includes('schema cache') || error.code === 'PGRST204')) {
            console.warn('[REAL AUTH DEBUG] Extended columns not in schema cache. Falling back to base payload...');
            const basePayload = {
              owner_id: user.id,
              shop_name: newShopData.shop_name || 'My Shop',
              owner_name: newShopData.owner_name || 'Owner',
              preferred_language: language,
              gst_enabled: false,
            };

            const baseResult = await supabase
              .from('shops')
              .insert(basePayload)
              .select()
              .single();

            data = baseResult.data;
            error = baseResult.error;
          }

          if (error) {
            console.error('[REAL AUTH DEBUG] Error creating shop in Supabase:', error.message);
            alert('Could not create shop in database: ' + error.message);
            return;
          }

          if (data && isValidUuid(data.id)) {
            console.log('[REAL AUTH DEBUG] Shop created successfully with valid UUID:', data.id);
            setShop(data);
            localStorage.setItem('smart_khata_onboarding_completed', 'true');
            setScreen('main');
            loadSupabaseData(data.id);
            return;
          }
        } else if (activeUserId || localStorage.getItem('smart_khata_dev_user')) {
          console.log('[DEV AUTH DEBUG] Creating shop locally for Development OTP mode session');
        } else {
          alert('Session expired. Please sign in again.');
          return;
        }
      } catch (err: any) {
        console.error('[REAL AUTH DEBUG] Exception creating shop in Supabase:', err);
        alert('Failed to set up shop: ' + err.message);
        return;
      }
    }

    const createdShop: Shop = {
      id: `shop-${Date.now()}`,
      owner_id: activeUserId || '00000000-0000-4000-a000-017000000000',
      shop_name: newShopData.shop_name || 'My Shop',
      owner_name: newShopData.owner_name || 'Owner',
      phone: newShopData.phone,
      whatsapp_number: newShopData.whatsapp_number,
      country: newShopData.country || 'BD',
      currency_code: newShopData.currency_code || 'BDT',
      business_type: newShopData.business_type,
      preferred_language: language,
      gst_enabled: false,
      created_at: new Date().toISOString(),
    };

    setShop(createdShop);
    saveMockShop(createdShop);
    localStorage.setItem('smart_khata_onboarding_completed', 'true');
    setScreen('main');
  };

  const handleSaveProfile = async (updatedFields: Partial<Shop>) => {
    if (!shop) return;
    const merged: Shop = {
      ...shop,
      ...updatedFields,
      updated_at: new Date().toISOString(),
    };

    // Store per-owner persistent profile cache
    if (shop.owner_id) {
      localStorage.setItem(`smart_khata_shop_profile_${shop.owner_id}`, JSON.stringify(merged));
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('shops')
          .update(updatedFields)
          .eq('id', shop.id)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const finalShop: Shop = {
            ...data,
            logo_url: data.logo_url || merged.logo_url,
            signature_url: data.signature_url || merged.signature_url,
            shop_photo_url: data.shop_photo_url || merged.shop_photo_url,
          };
          setShop(finalShop);
          saveMockShop(finalShop);
          if (shop.owner_id) {
            localStorage.setItem(`smart_khata_shop_profile_${shop.owner_id}`, JSON.stringify(finalShop));
          }
          return;
        }
      } catch (err) {
        console.warn('Supabase profile update fallback to local state', err);
      }
    }

    setShop(merged);
    saveMockShop(merged);
  };

  const handleSaveTransaction = async (
    customerId: string,
    type: TransactionType,
    amount: number,
    note: string,
    newCustomerData?: { name: string; phone: string; displayLabel: string; state?: string },
    gstDetails?: any,
    ledgerPhotoUrl?: string
  ) => {
    if (!shop) return;

    let activeShop = shop;

    // Pre-flight validation: Ensure shop.id is a valid PostgreSQL UUID
    if (isSupabaseConfigured && supabase) {
      if (!isValidUuid(activeShop.id)) {
        console.warn(`[REAL AUTH DEBUG] shop.id "${activeShop.id}" is not a valid UUID. Resolving real shop...`);
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user) {
          const { data: dbShop } = await supabase
            .from('shops')
            .select('*')
            .eq('owner_id', authUser.user.id)
            .maybeSingle();

          if (dbShop && isValidUuid(dbShop.id)) {
            console.log(`[REAL AUTH DEBUG] Successfully re-resolved valid shop UUID: ${dbShop.id}`);
            setShop(dbShop);
            activeShop = dbShop;
          } else {
            alert('Your shop account could not be resolved from database. Please sign in again.');
            return;
          }
        } else if (activeUserId || localStorage.getItem('smart_khata_dev_user')) {
          console.log('[DEV AUTH DEBUG] Using local shop ID for transaction in Development OTP mode');
        } else {
          alert('Session expired. Please sign in again.');
          return;
        }
      }
    }

    let finalCustId = customerId;
    let targetCustomer: Customer | undefined;

    // 1. Handle Inline Customer Creation
    if (newCustomerData) {
      if (isSupabaseConfigured && supabase) {
        try {
          console.log(`[REAL AUTH DEBUG] Inserting Customer into Supabase DB for shop_id: ${activeShop.id}`);
          const custPayload: any = {
            shop_id: activeShop.id,
            name: newCustomerData.name,
            phone_number: newCustomerData.phone,
            display_label: newCustomerData.displayLabel,
          };
          if (newCustomerData.state && newCustomerData.state.trim()) {
            custPayload.state = newCustomerData.state.trim();
          }

          const { data, error } = await supabase
            .from('customers')
            .insert(custPayload)
            .select()
            .single();

          if (error) throw error;
          if (data) {
            console.log(`[REAL AUTH DEBUG] Customer inserted successfully into DB. ID: ${data.id}`);
            finalCustId = data.id;
            targetCustomer = data;
          }
        } catch (err: any) {
          console.error('[REAL AUTH DEBUG] Supabase customer insert error:', err);
          alert('Failed to add customer to database: ' + err.message);
          return;
        }
      } else {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          shop_id: shop.id,
          name: newCustomerData.name,
          phone_number: newCustomerData.phone,
          display_label: newCustomerData.displayLabel,
          state: newCustomerData.state,
          created_at: new Date().toISOString(),
          balance: 0,
        };
        finalCustId = newCust.id;
        targetCustomer = newCust;
        const updatedCusts = [...customers, newCust];
        setCustomers(updatedCusts);
        saveMockCustomers(updatedCusts);
      }
    } else {
      targetCustomer = customers.find((c) => c.id === customerId);
    }

    if (!targetCustomer) return;

    // 2. Save Transaction
    let savedTx: Transaction | null = null;
    const txGstPayload = gstDetails
      ? {
          base_amount: gstDetails.baseAmount,
          tax_amount: gstDetails.taxAmount,
          total_amount: gstDetails.totalAmount,
          gst_rate: gstDetails.gstRate,
          cgst_amount: gstDetails.cgstAmount,
          sgst_amount: gstDetails.sgstAmount,
          igst_amount: gstDetails.igstAmount,
          tax_type: gstDetails.taxType,
        }
      : {};

    if (isSupabaseConfigured && supabase) {
      try {
        console.log(`[REAL AUTH DEBUG] Inserting Transaction into Supabase DB for shop_id: ${activeShop.id}, customer_id: ${finalCustId}`);
        const txPayload: any = {
          shop_id: activeShop.id,
          customer_id: finalCustId,
          type,
          amount,
          note: note || '',
          ...txGstPayload,
        };

        if (ledgerPhotoUrl && ledgerPhotoUrl.trim()) {
          txPayload.ledger_photo_url = ledgerPhotoUrl.trim();
        }

        let { data, error } = await supabase
          .from('transactions')
          .insert(txPayload)
          .select()
          .single();

        // Fallback if PostgREST schema cache does not have ledger_photo_url column yet
        if (error && (error.message?.includes('schema cache') || error.code === 'PGRST204')) {
          console.warn('[REAL AUTH DEBUG] ledger_photo_url not in schema cache. Retrying transaction insert...');
          delete txPayload.ledger_photo_url;
          const retryResult = await supabase
            .from('transactions')
            .insert(txPayload)
            .select()
            .single();

          data = retryResult.data;
          error = retryResult.error;
        }

        if (error) throw error;
        if (data) {
          console.log(`[REAL AUTH DEBUG] Transaction inserted successfully into DB. ID: ${data.id}`);
          savedTx = data;
        }
      } catch (err: any) {
        console.error('[REAL AUTH DEBUG] Supabase transaction insert error:', err);
        alert('Failed to save transaction: ' + err.message);
        return;
      }
    } else {
      savedTx = {
        id: `tx-${Date.now()}`,
        shop_id: activeShop.id,
        customer_id: finalCustId,
        type,
        amount,
        note,
        ledger_photo_url: ledgerPhotoUrl,
        created_at: new Date().toISOString(),
        ...txGstPayload,
      };
      const updatedTxs = [savedTx, ...transactions];
      setTransactions(updatedTxs);
      saveMockTransactions(updatedTxs);
    }

    if (!savedTx) return;

    // Refresh state
    if (isSupabaseConfigured && supabase) {
      await loadSupabaseData(activeShop.id);
      const updatedCust = customers.find((c) => c.id === finalCustId) || targetCustomer;
      setReceiptModalData({
        tx: savedTx,
        customer: updatedCust,
      });
    } else {
      const allCusts = customers.some((c) => c.id === targetCustomer?.id)
        ? customers
        : [...customers, targetCustomer];

      const updatedCustList = allCusts.map((c) => {
        if (c.id === finalCustId) {
          const currentBal = c.balance || 0;
          const newBal = type === 'credit_given' ? currentBal + amount : currentBal - amount;
          return { ...c, balance: newBal };
        }
        return c;
      });

      setCustomers(updatedCustList);
      saveMockCustomers(updatedCustList);

      const latestCustomerState = updatedCustList.find((c) => c.id === finalCustId) || targetCustomer;
      setReceiptModalData({
        tx: savedTx,
        customer: latestCustomerState,
      });
    }

    setIsAddTxOpen(false);
  };

  // Reversible Void Audit Entry Handler
  const handleVoidTransaction = async (originalTx: Transaction, reason: string) => {
    if (!shop) return;
    console.log(`[AUDIT] Creating reversible void entry for TX: ${originalTx.id}, reason: ${reason}`);

    // Mark original transaction as voided
    const updatedTxs = transactions.map((t) => {
      if (t.id === originalTx.id) {
        return {
          ...t,
          is_voided: true,
          void_reason: reason,
          voided_at: new Date().toISOString(),
        };
      }
      return t;
    });

    setTransactions(updatedTxs);
    saveMockTransactions(updatedTxs);
    recalculateBalances(customers, updatedTxs);
  };

  const handleLogout = async () => {
    const currentLang = (localStorage.getItem('smart_khata_lang') as Language) || language || 'bn';
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('[AUTH DEBUG] Error signing out from Supabase:', err);
      }
    }
    localStorage.removeItem('smart_khata_dev_user');
    localStorage.removeItem('smart_khata_mock_shop');
    localStorage.removeItem('smart_khata_onboarding_completed');
    setActiveUserId(null);
    setShop(null);
    setCustomers([]);
    setTransactions([]);
    setAuthUserMeta({ email: null, name: null, avatarUrl: null });
    
    // Explicitly preserve saved language preference across logouts
    localStorage.setItem('smart_khata_lang', currentLang);
    setLanguage(currentLang);
    setScreen('phone_auth');
  };

  const handleDeleteAccount = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (shop) {
          await supabase.from('shops').delete().eq('id', shop.id);
        }
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Account deletion error:', err);
      }
    }
    await handleLogout();
  };

  if (isAuthInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 space-y-4 font-sans">
        <SmartKhataLogo size="xl" className="shadow-2xl animate-pulse" />
        <div className="flex items-center space-x-2 text-blue-400 font-extrabold text-sm uppercase tracking-wider">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Restoring Smart Khata Session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-blue-50 dark:from-slate-950 dark:via-gray-900 dark:to-blue-950 text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors duration-300 selection:bg-blue-200">
      {/* Onboarding Flow */}
      {screen === 'welcome' && (
        <WelcomeScreen
          language={language}
          onContinue={handleWelcomeContinue}
        />
      )}

      {screen === 'language_select' && (
        <LanguageSelector
          currentLanguage={language}
          onSelectLanguage={handleLanguageSelect}
        />
      )}

      {screen === 'phone_auth' && (
        <PhoneAuth
          language={language}
          onSuccess={handlePhoneAuthSuccess}
          onBack={() => setScreen('welcome')}
        />
      )}

      {screen === 'shop_setup' && (
        <ShopSetup
          language={language}
          onComplete={handleShopSetupComplete}
        />
      )}

      {/* Main Experience with Dual Navigation (Mobile Bottom Bar + Desktop Sidebar) */}
      {(screen === 'main' || screen === 'customer_detail') && shop && (
        <div className="flex flex-col md:flex-row min-h-screen">
          {/* Responsive Navigation Component */}
          {screen === 'main' && (
            <Navigation
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab)}
              shop={shop}
              language={language}
              onLanguageChange={handleLanguageChange}
              onLogout={handleLogout}
              onOpenAddTx={() => {
                setSelectedCustomer(null);
                setPreSelectedTxType(undefined);
                setIsAddTxOpen(true);
              }}
              userEmail={authUserMeta.email}
              userName={authUserMeta.name}
              userAvatarUrl={authUserMeta.avatarUrl}
            />
          )}

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto">
            {screen === 'main' && (
              <>
                {/* Navbar Header on Mobile */}
                <div className="md:hidden">
                  <Navbar
                    shop={shop}
                    currentLanguage={language}
                    onLanguageChange={handleLanguageChange}
                    onOpenProfile={() => setActiveTab('profile')}
                    onLogout={handleLogout}
                    onOpenSubscriptions={() => setIsSubscriptionOpen(true)}
                    onOpenShops={() => setIsShopsOpen(true)}
                    userEmail={authUserMeta.email}
                    userName={authUserMeta.name}
                    userAvatarUrl={authUserMeta.avatarUrl}
                  />
                </div>

                {activeTab === 'home' && (
                  <Dashboard
                    shop={shop}
                    customers={customers}
                    transactions={transactions}
                    language={language}
                    onSelectCustomer={(c) => {
                      setSelectedCustomer(c);
                      setScreen('customer_detail');
                    }}
                    onOpenAddTx={() => {
                      setSelectedCustomer(null);
                      setPreSelectedTxType(undefined);
                      setIsAddTxOpen(true);
                    }}
                    onOpenScanLedger={() => setIsScanLedgerOpen(true)}
                    onSelectReceiptTx={(tx, cust) => setReceiptModalData({ tx, customer: cust })}
                    onNavigateTab={(t) => setActiveTab(t as any)}
                  />
                )}

                {activeTab === 'customers' && (
                  <CustomersScreen
                    customers={customers}
                    language={language}
                    onSelectCustomer={(c) => {
                      setSelectedCustomer(c);
                      setScreen('customer_detail');
                    }}
                    onOpenAddTx={() => {
                      setSelectedCustomer(null);
                      setPreSelectedTxType(undefined);
                      setIsAddTxOpen(true);
                    }}
                  />
                )}

                {activeTab === 'history' && (
                  <HistoryScreen
                    transactions={transactions}
                    customers={customers}
                    shop={shop}
                    language={language}
                    onSelectReceiptTx={(tx, cust) => setReceiptModalData({ tx, customer: cust })}
                    onVoidTransaction={handleVoidTransaction}
                  />
                )}

                {activeTab === 'reports' && (
                  <ReportsScreen
                    customers={customers}
                    transactions={transactions}
                    shop={shop}
                    language={language}
                  />
                )}

                {activeTab === 'ai_recovery' && (
                  <AIRecoveryDashboard
                    shop={shop}
                    customers={customers}
                    transactions={transactions}
                    language={language}
                    onOpenSubscriptions={() => setIsSubscriptionOpen(true)}
                  />
                )}

                {activeTab === 'campaigns' && (
                  <CampaignsScreen
                    shop={shop}
                    customers={customers}
                    transactions={transactions}
                    language={language}
                    onOpenSubscriptions={() => setIsSubscriptionOpen(true)}
                  />
                )}

                {activeTab === 'profile' && (
                  <ProfileScreen
                    shop={shop}
                    customers={customers}
                    transactions={transactions}
                    language={language}
                    theme={theme}
                    onToggleTheme={toggleTheme}
                    onBack={() => setActiveTab('home')}
                    onSaveProfile={handleSaveProfile}
                    onRestoreBackup={handleRestoreBackup}
                    onOpenSubscriptions={() => setIsSubscriptionOpen(true)}
                    onOpenShops={() => setIsShopsOpen(true)}
                    onOpenStaff={() => setIsStaffOpen(true)}
                    onDeleteAccount={handleDeleteAccount}
                    userEmail={authUserMeta.email}
                    userName={authUserMeta.name}
                    userAvatarUrl={authUserMeta.avatarUrl}
                  />
                )}
              </>
            )}

            {screen === 'customer_detail' && selectedCustomer && (
              <CustomerDetail
                customer={
                  customers.find((c) => c.id === selectedCustomer.id) || selectedCustomer
                }
                transactions={transactions.filter(
                  (t) => t.customer_id === selectedCustomer.id
                )}
                shop={shop}
                language={language}
                onBack={() => setScreen('main')}
                onOpenAddTx={(type) => {
                  setPreSelectedTxType(type);
                  setIsAddTxOpen(true);
                }}
                onSelectReceiptTx={(tx) => {
                  setReceiptModalData({
                    tx,
                    customer:
                      customers.find((c) => c.id === selectedCustomer.id) || selectedCustomer,
                  });
                }}
              />
            )}
          </main>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isAddTxOpen && shop && (
        <AddTransactionModal
          shop={shop}
          customers={customers}
          language={language}
          preSelectedCustomer={selectedCustomer}
          onClose={() => setIsAddTxOpen(false)}
          onSave={handleSaveTransaction}
        />
      )}

      {/* AI Handwriting Scanner Modal */}
      {isScanLedgerOpen && shop && (
        <ScanLedgerModal
          shop={shop}
          customers={customers}
          language={language}
          onClose={() => setIsScanLedgerOpen(false)}
          onConfirmSave={(
            finalCustId,
            type,
            amount,
            note,
            ledgerPhotoUrl,
            newCustPayload
          ) => {
            setIsScanLedgerOpen(false);
            handleSaveTransaction(
              finalCustId,
              type,
              amount,
              note,
              newCustPayload,
              undefined,
              ledgerPhotoUrl
            );
          }}
        />
      )}

      {/* WhatsApp Receipt Modal */}
      {receiptModalData && shop && (
        <ReceiptModal
          transaction={receiptModalData.tx}
          customer={receiptModalData.customer}
          shop={shop}
          language={language}
          onClose={() => setReceiptModalData(null)}
        />
      )}

      {/* Subscription Screen Modal */}
      {isSubscriptionOpen && shop && (
        <SubscriptionModal
          shop={shop}
          language={language}
          currentTier={shop.plan_tier || 'free'}
          onClose={() => setIsSubscriptionOpen(false)}
          onSelectPlan={handleSelectPlan}
        />
      )}

      {/* My Shops & Outlets Hub Modal */}
      {isShopsOpen && shop && (
        <ShopsModal
          shops={userShops.length > 0 ? userShops : [shop]}
          activeShopId={shop.id}
          language={language}
          onClose={() => setIsShopsOpen(false)}
          onSwitchShop={handleSwitchActiveShop}
          onCreateShop={handleCreateNewShop}
          onDeleteShop={handleDeleteShop}
        />
      )}

      {/* Staff & Role Permissions Modal */}
      {isStaffOpen && shop && (
        <StaffModal
          shop={shop}
          language={language}
          onClose={() => setIsStaffOpen(false)}
        />
      )}

      {/* Premium Feature Lock Upgrade Dialog */}
      {lockedFeatureName && (
        <UpgradeModal
          featureName={lockedFeatureName}
          language={language}
          onClose={() => setLockedFeatureName(null)}
          onOpenSubscriptions={() => setIsSubscriptionOpen(true)}
        />
      )}
    </div>
  );
};
