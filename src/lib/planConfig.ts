import { PlanTier } from '../types';

export type FeatureKey =
  | 'basic_khata'
  | 'basic_transactions'
  | 'basic_receipts'
  | 'manual_whatsapp'
  | 'basic_recovery'
  | 'basic_emi'
  | 'basic_campaign'
  | 'smart_recovery_assistance'
  | 'ai_message_placeholder'
  | 'better_emi_management'
  | 'campaign_audience_filters'
  | 'fast_receipt_workflow'
  | 'automation_placeholders_limited'
  | 'advanced_ai_recovery'
  | 'ai_emi_recovery'
  | 'ai_campaign_audience'
  | 'advanced_campaign_insights'
  | 'automation_placeholders_advanced'
  | 'advanced_business_insights';

export interface PlanConfig {
  tier: PlanTier;
  id: 'free' | 'pro' | 'advanced';
  name: string;
  nameBn: string;
  nameHi: string;
  priceINR: number;
  priceFormatted: string;
  pricePeriod: string;
  features: FeatureKey[];
  limits: {
    campaignRecipients: number;
    weeklyAiQuota: number;
    emiLimit: number;
  };
}

export const PLAN_CONFIGS: Record<'free' | 'pro' | 'advanced', PlanConfig> = {
  free: {
    tier: 'free',
    id: 'free',
    name: 'FREE',
    nameBn: 'ফ্রি প্ল্যান (FREE)',
    nameHi: 'फ्री प्लान (FREE)',
    priceINR: 0,
    priceFormatted: '₹0',
    pricePeriod: 'Forever Free',
    features: [
      'basic_khata',
      'basic_transactions',
      'basic_receipts',
      'manual_whatsapp',
      'basic_recovery',
      'basic_emi',
      'basic_campaign',
    ],
    limits: {
      campaignRecipients: 50,
      weeklyAiQuota: 5,
      emiLimit: 5,
    },
  },
  pro: {
    tier: 'pro',
    id: 'pro',
    name: 'PRO ₹49',
    nameBn: 'প্রো (PRO) ₹৪৯/মাস',
    nameHi: 'प्रो (PRO) ₹49/महीना',
    priceINR: 49,
    priceFormatted: '₹49',
    pricePeriod: '/ month',
    features: [
      'basic_khata',
      'basic_transactions',
      'basic_receipts',
      'manual_whatsapp',
      'basic_recovery',
      'basic_emi',
      'basic_campaign',
      'smart_recovery_assistance',
      'ai_message_placeholder',
      'better_emi_management',
      'campaign_audience_filters',
      'fast_receipt_workflow',
      'automation_placeholders_limited',
    ],
    limits: {
      campaignRecipients: 500,
      weeklyAiQuota: 25,
      emiLimit: 25,
    },
  },
  advanced: {
    tier: 'business',
    id: 'advanced',
    name: 'ADVANCED ₹149',
    nameBn: 'এডভান্সড (ADVANCED) ₹১৪৯/মাস',
    nameHi: 'एडवांस्ड (ADVANCED) ₹149/महीना',
    priceINR: 149,
    priceFormatted: '₹149',
    pricePeriod: '/ month',
    features: [
      'basic_khata',
      'basic_transactions',
      'basic_receipts',
      'manual_whatsapp',
      'basic_recovery',
      'basic_emi',
      'basic_campaign',
      'smart_recovery_assistance',
      'ai_message_placeholder',
      'better_emi_management',
      'campaign_audience_filters',
      'fast_receipt_workflow',
      'automation_placeholders_limited',
      'advanced_ai_recovery',
      'ai_emi_recovery',
      'ai_campaign_audience',
      'advanced_campaign_insights',
      'automation_placeholders_advanced',
      'advanced_business_insights',
    ],
    limits: {
      campaignRecipients: 5000,
      weeklyAiQuota: 100,
      emiLimit: 1000,
    },
  },
};

/**
 * Normalizes input string tier into standard plan id ('free' | 'pro' | 'advanced').
 */
export function normalizePlanTier(tier?: string): 'free' | 'pro' | 'advanced' {
  if (!tier) return 'free';
  const t = tier.toLowerCase();
  if (t === 'advanced' || t === 'business' || t === 'enterprise') return 'advanced';
  if (t === 'pro') return 'pro';
  return 'free';
}

/**
 * Central entitlement check function.
 * Usage: canUse(shop.plan_tier, 'advanced_ai_recovery')
 */
export function canUse(planTier: string | undefined, feature: FeatureKey): boolean {
  const normalized = normalizePlanTier(planTier);
  return PLAN_CONFIGS[normalized].features.includes(feature);
}

/**
 * Central plan limit accessor function.
 * Usage: getPlanLimit(shop.plan_tier, 'campaignRecipients')
 */
export function getPlanLimit(planTier: string | undefined, limitKey: keyof PlanConfig['limits']): number {
  const normalized = normalizePlanTier(planTier);
  return PLAN_CONFIGS[normalized].limits[limitKey] || 0;
}

/**
 * Central localized plan name accessor function.
 * Usage: getPlanName(shop.plan_tier, language)
 */
export function getPlanName(planTier: string | undefined, lang: 'en' | 'bn' | 'hi' = 'en'): string {
  const normalized = normalizePlanTier(planTier);
  const cfg = PLAN_CONFIGS[normalized];
  if (lang === 'bn') return cfg.nameBn;
  if (lang === 'hi') return cfg.nameHi;
  return cfg.name;
}

/**
 * Gets complete plan configuration details.
 */
export function getPlanConfig(planTier: string | undefined): PlanConfig {
  const normalized = normalizePlanTier(planTier);
  return PLAN_CONFIGS[normalized];
}
