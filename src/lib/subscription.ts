import { PlanTier, SubscriptionPlan } from '../types';

export const SUBSCRIPTION_PLANS: Record<PlanTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    name: 'Free Starter Plan',
    monthlyPriceUSD: 0,
    monthlyPriceINR: 0,
    campaignRecipientLimit: 50,
    customerLimit: 50,
    txMonthlyLimit: 200,
    shopLimit: 1,
    staffLimit: 1,
    trialDays: 0,
    features: ['pdf_export', 'analytics_reports', 'gst_filing'],
  },
  pro: {
    tier: 'pro',
    name: 'Pro Merchant (Recommended ⭐)',
    monthlyPriceUSD: 9,
    monthlyPriceINR: 49,
    campaignRecipientLimit: 500,
    customerLimit: Infinity,
    txMonthlyLimit: Infinity,
    shopLimit: 3,
    staffLimit: 5,
    trialDays: 14,
    features: [
      'ocr_scanner',
      'pdf_export',
      'analytics_reports',
      'cloud_backup',
      'gst_filing',
      'inventory_management',
      'multi_shop',
      'staff_management',
    ],
  },
  business: {
    tier: 'business',
    name: 'Business Plan (High-Volume)',
    monthlyPriceUSD: 25,
    monthlyPriceINR: 149,
    campaignRecipientLimit: 10000,
    customerLimit: Infinity,
    txMonthlyLimit: Infinity,
    shopLimit: 10,
    staffLimit: 25,
    trialDays: 14,
    features: [
      'ocr_scanner',
      'pdf_export',
      'analytics_reports',
      'cloud_backup',
      'gst_filing',
      'inventory_management',
      'multi_shop',
      'staff_management',
      'voice_ai',
      'ai_assistant',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise Chain',
    monthlyPriceUSD: 99,
    monthlyPriceINR: 149,
    campaignRecipientLimit: Infinity,
    customerLimit: Infinity,
    txMonthlyLimit: Infinity,
    shopLimit: 100,
    staffLimit: 100,
    trialDays: 30,
    features: [
      'ocr_scanner',
      'pdf_export',
      'analytics_reports',
      'cloud_backup',
      'gst_filing',
      'inventory_management',
      'multi_shop',
      'staff_management',
      'voice_ai',
      'ai_assistant',
    ],
  },
};

/**
 * Get plan details for a specific plan tier
 */
export const getPlanDetails = (tier: PlanTier = 'free'): SubscriptionPlan => {
  return SUBSCRIPTION_PLANS[tier] || SUBSCRIPTION_PLANS.free;
};

/**
 * Validate Campaign Recipient Limit for a tier (Server-side compatible)
 */
export const validateCampaignRecipientLimit = (
  tier: PlanTier = 'free',
  selectedCount: number
): { allowed: boolean; maxLimit: number; remaining: number; upgradePromptRequired: boolean } => {
  const plan = getPlanDetails(tier);
  const maxLimit = plan.campaignRecipientLimit;

  if (maxLimit === Infinity) {
    return { allowed: true, maxLimit: Infinity, remaining: Infinity, upgradePromptRequired: false };
  }

  const allowed = selectedCount <= maxLimit;
  const remaining = Math.max(0, maxLimit - selectedCount);

  return {
    allowed,
    maxLimit,
    remaining,
    upgradePromptRequired: selectedCount >= maxLimit,
  };
};

/**
 * Check if current usage is within plan limits
 */
export const checkUsageLimit = (
  tier: PlanTier = 'free',
  limitType: 'customerLimit' | 'txMonthlyLimit' | 'shopLimit' | 'staffLimit' | 'campaignRecipientLimit',
  currentCount: number
): { allowed: boolean; limit: number; remaining: number } => {
  const plan = getPlanDetails(tier);
  const limit = plan[limitType];
  if (limit === Infinity) {
    return { allowed: true, limit: Infinity, remaining: Infinity };
  }
  const remaining = Math.max(0, limit - currentCount);
  return {
    allowed: currentCount < limit,
    limit,
    remaining,
  };
};

/**
 * Check if a plan tier is eligible for upgrade
 */
export const canUpgradePlan = (currentTier: PlanTier, targetTier: PlanTier): boolean => {
  const tierOrder: PlanTier[] = ['free', 'pro', 'business', 'enterprise'];
  return tierOrder.indexOf(targetTier) > tierOrder.indexOf(currentTier);
};
