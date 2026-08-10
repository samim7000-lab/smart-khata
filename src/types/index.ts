export type Language = 'bn' | 'en' | 'hi';

export interface Shop {
  id: string;
  owner_id: string;
  shop_name: string;
  owner_name: string;
  preferred_language: Language;
  gst_enabled: boolean;
  default_gst_rate?: number; // 0, 5, 12, 18, 28
  created_at: string;
  
  // Expanded Profile Fields (v2 & v3)
  phone?: string;
  whatsapp_number?: string;
  email?: string;
  country?: string; // e.g. 'BD', 'IN', 'US'
  state?: string;
  city?: string;
  full_address?: string;
  postal_code?: string;
  business_type?: string;
  currency_code?: string; // e.g. 'BDT', 'INR', 'USD'
  gst_number?: string;
  logo_url?: string;
  shop_photo_url?: string;
  signature_url?: string;
  updated_at?: string;

  // Phase F: Subscription & Branch
  plan_tier?: PlanTier;
  branch_name?: string;
  parent_shop_id?: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone_number: string;
  display_label: string;
  state?: string; // Customer state for GST intra vs inter-state detection
  created_at: string;
  balance?: number; // Positive = customer owes money (credit), Negative = customer overpaid, 0 = settled
}

export type TransactionType = 'credit_given' | 'payment_received' | 'void_correction';

export type TaxType = 'intra' | 'inter' | 'none';

export interface Transaction {
  id: string;
  shop_id: string;
  customer_id: string;
  type: TransactionType;
  amount: number; // Final total amount
  note?: string;
  created_at: string;

  // GST Fields (v3)
  base_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  gst_rate?: number; // 0, 5, 12, 18, 28
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  tax_type?: TaxType;
  
  // Reversible Audit Correction Fields
  is_voided?: boolean;
  void_reason?: string;
  voided_at?: string;
  original_tx_id?: string;

  // AI OCR Proof Photo (v4)
  ledger_photo_url?: string;
}

export interface CountryConfig {
  code: string;
  name: {
    en: string;
    bn: string;
    hi: string;
  };
  callingCode: string;
  flag: string;
  currencySymbol: string;
  currencyCode: string;
  currencyName: {
    en: string;
    bn: string;
    hi: string;
  };
  phoneLength: number;
}

// ----------------------------------------------------
// PHASE F: ENTERPRISE ARCHITECTURE FOUNDATION TYPES
// ----------------------------------------------------

export type PlanTier = 'free' | 'pro' | 'business' | 'enterprise';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export interface SubscriptionPlan {
  tier: PlanTier;
  name: string;
  monthlyPriceUSD: number;
  monthlyPriceINR: number;
  campaignRecipientLimit: number; // 50 for free, 500 for pro, Infinity for unlimited
  customerLimit: number; // Infinity for unlimited
  txMonthlyLimit: number; // Infinity for unlimited
  shopLimit: number; // Max allowed shops
  staffLimit: number; // Max allowed staff members
  trialDays: number;
  features: FeatureKey[];
}

export interface ShopSubscription {
  id: string;
  shop_id: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  trial_ends_at?: string;
  current_period_end?: string;
  created_at: string;
}

// Role Based Access Control (RBAC)
export type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';

export interface ShopMember {
  id: string;
  shop_id: string;
  user_id: string;
  role: UserRole;
  user_name?: string;
  user_phone?: string;
  status: 'active' | 'invited' | 'suspended';
  created_at: string;
}

// Feature Flag Engine
export type FeatureKey =
  | 'ocr_scanner'
  | 'pdf_export'
  | 'analytics_reports'
  | 'cloud_backup'
  | 'gst_filing'
  | 'inventory_management'
  | 'multi_shop'
  | 'staff_management'
  | 'voice_ai'
  | 'ai_assistant';

export interface FeatureFlag {
  key: FeatureKey;
  name: string;
  description: string;
  enabled: boolean;
  minTier: PlanTier;
}

// ----------------------------------------------------
// PHASE H.6: ENTITLEMENT & DELIVERY ARCHITECTURE TYPES
// ----------------------------------------------------

export type CampaignStatus =
  | 'draft'
  | 'ready_for_review'
  | 'approved'
  | 'queued'
  | 'sending'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled';

export type ManualDeliveryStatus = 'prepared' | 'opened' | 'shared' | 'cancelled';

export type DeliveryMessageStatus =
  | 'prepared'
  | 'opened'
  | 'submitted'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export type TemplateStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'disabled';

export interface WhatsAppTemplate {
  id: string;
  shop_id: string;
  provider: 'meta_cloud_api' | 'manual_share';
  template_name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: TemplateStatus;
  meta_template_id?: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export interface WhatsAppOptIn {
  id: string;
  shop_id: string;
  customer_id: string;
  opt_in_status: 'opted_in' | 'opted_out' | 'unknown';
  opt_in_source?: 'manual' | 'qr_code' | 'website' | 'chat';
  opt_in_at?: string;
  opt_out_at?: string;
}

export interface DeliveryAttempt {
  id: string;
  shop_id: string;
  customer_id: string;
  provider: 'whatsapp_direct' | 'meta_cloud_api' | 'sms' | 'email';
  status: DeliveryMessageStatus;
  dispatched_at: string;
  error_message?: string;
}

