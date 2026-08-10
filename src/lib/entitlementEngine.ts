import { PlanTier, Shop } from '../types';
import { getPlanDetails } from './subscription';
import { getCountryPricing } from './countryPricing';

export interface EntitlementLimits {
  tier: PlanTier;
  planName: string;
  campaignRecipientLimit: number;
  weeklyAiQuota: number;
  customerLimit: number;
  txMonthlyLimit: number;
  shopLimit: number;
  staffLimit: number;
  canUseAIRecovery: boolean;
  canUseAdvancedSegmentation: boolean;
  canUseAdvancedAnalytics: boolean;
  canUseAutomaticDelivery: boolean;
  canConnectMetaWhatsApp: boolean;
}

export class EntitlementService {
  /**
   * Get complete entitlement profile for a shop
   */
  static getEntitlements(shop: Shop): EntitlementLimits {
    const tier: PlanTier = shop.plan_tier || 'free';
    const planInfo = getPlanDetails(tier);
    const countryPricing = getCountryPricing(shop.country);
    const countryPlan = countryPricing.plans[tier] || countryPricing.plans.free;

    const recipientLimit = countryPlan.campaignRecipientLimit !== undefined
      ? countryPlan.campaignRecipientLimit
      : planInfo.campaignRecipientLimit;

    const weeklyAiQuota = countryPlan.weeklyAiQuota !== undefined
      ? countryPlan.weeklyAiQuota
      : (tier === 'free' ? 0 : tier === 'pro' ? 15 : 100);

    return {
      tier,
      planName: tier === 'business' ? 'Business Plan' : planInfo.name,
      campaignRecipientLimit: recipientLimit,
      weeklyAiQuota,
      customerLimit: planInfo.customerLimit,
      txMonthlyLimit: planInfo.txMonthlyLimit,
      shopLimit: planInfo.shopLimit,
      staffLimit: planInfo.staffLimit,
      canUseAIRecovery: tier === 'pro' || tier === 'business' || tier === 'enterprise',
      canUseAdvancedSegmentation: tier === 'pro' || tier === 'business' || tier === 'enterprise',
      canUseAdvancedAnalytics: tier === 'pro' || tier === 'business' || tier === 'enterprise',
      canUseAutomaticDelivery: tier === 'business' || tier === 'enterprise',
      canConnectMetaWhatsApp: tier === 'business' || tier === 'enterprise',
    };
  }

  /**
   * Check if shop can create campaigns
   */
  static canCreateCampaign(shop: Shop): boolean {
    const entitlements = this.getEntitlements(shop);
    return entitlements.campaignRecipientLimit > 0;
  }

  /**
   * Get maximum campaign recipient limit for a shop
   */
  static getCampaignRecipientLimit(shop: Shop): number {
    const entitlements = this.getEntitlements(shop);
    return entitlements.campaignRecipientLimit;
  }

  /**
   * Check if shop can access AI Recovery features
   */
  static canUseAIRecovery(shop: Shop): boolean {
    const entitlements = this.getEntitlements(shop);
    return entitlements.canUseAIRecovery;
  }

  /**
   * Get weekly AI Recovery priorities quota for a shop
   */
  static getWeeklyRecoveryLimit(shop: Shop): number {
    const entitlements = this.getEntitlements(shop);
    return entitlements.weeklyAiQuota;
  }

  /**
   * Check if shop can use specific media type
   */
  static canUseMediaType(shop: Shop, mediaType: 'image' | 'video' | 'pdf'): boolean {
    const entitlements = this.getEntitlements(shop);
    if (mediaType === 'image') return true;
    if (mediaType === 'pdf' || mediaType === 'video') {
      return entitlements.tier !== 'free';
    }
    return true;
  }

  /**
   * Check if automatic WhatsApp delivery is permitted
   */
  static canUseAutomaticDelivery(shop: Shop, metaConfigured: boolean = false, optInRecorded: boolean = false): boolean {
    const entitlements = this.getEntitlements(shop);
    return entitlements.canUseAutomaticDelivery && metaConfigured && optInRecorded;
  }

  /**
   * Check if shop can connect Meta WhatsApp Business Cloud API
   */
  static canConnectMetaWhatsApp(shop: Shop): boolean {
    const entitlements = this.getEntitlements(shop);
    return entitlements.canConnectMetaWhatsApp;
  }
}
