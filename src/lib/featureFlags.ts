import { FeatureFlag, FeatureKey, PlanTier } from '../types';
import { getPlanDetails } from './subscription';

// Feature Flag Definitions
export const FEATURE_FLAGS: Record<FeatureKey, FeatureFlag> = {
  ocr_scanner: {
    key: 'ocr_scanner',
    name: 'AI Handwriting Scanner',
    description: 'Scan physical paper ledger pages with OCR AI',
    enabled: true,
    minTier: 'pro',
  },
  pdf_export: {
    key: 'pdf_export',
    name: 'PDF Statement & Receipt Export',
    description: 'Export transaction statements & branded receipts to PDF',
    enabled: true,
    minTier: 'free',
  },
  analytics_reports: {
    key: 'analytics_reports',
    name: 'Business Analytics & Reports',
    description: 'Detailed revenue, debt, and cash flow reports',
    enabled: true,
    minTier: 'free',
  },
  cloud_backup: {
    key: 'cloud_backup',
    name: 'Real-time Cloud Sync & Backup',
    description: 'Automatic encrypted cloud backup',
    enabled: true,
    minTier: 'pro',
  },
  gst_filing: {
    key: 'gst_filing',
    name: 'GST Tax Calculation & Invoicing',
    description: 'Automatic CGST/SGST/IGST breakdown',
    enabled: true,
    minTier: 'free',
  },
  inventory_management: {
    key: 'inventory_management',
    name: 'Stock & Inventory Management',
    description: 'Track items, stock levels, and low-stock alerts',
    enabled: true,
    minTier: 'pro',
  },
  multi_shop: {
    key: 'multi_shop',
    name: 'Multi-Shop & Branch Management',
    description: 'Manage multiple shop outlets from one account',
    enabled: true,
    minTier: 'pro',
  },
  staff_management: {
    key: 'staff_management',
    name: 'Staff Roles & Permissions',
    description: 'Assign Cashier, Manager, and Admin roles to staff',
    enabled: true,
    minTier: 'pro',
  },
  voice_ai: {
    key: 'voice_ai',
    name: 'Voice Transaction Input',
    description: 'Dictate transactions in Bengali, Hindi, or English',
    enabled: true,
    minTier: 'business',
  },
  ai_assistant: {
    key: 'ai_assistant',
    name: 'Khata AI Business Assistant',
    description: 'Smart debt collection insights and cashflow forecasts',
    enabled: true,
    minTier: 'business',
  },
};

/**
 * Check if a feature is enabled for a given plan tier
 */
export const isFeatureEnabled = (
  featureKey: FeatureKey,
  userTier: PlanTier = 'pro'
): boolean => {
  const flag = FEATURE_FLAGS[featureKey];
  if (!flag || !flag.enabled) return false;

  const plan = getPlanDetails(userTier);
  return plan.features.includes(featureKey);
};

/**
 * Get all available feature flags
 */
export const getAllFeatureFlags = (): FeatureFlag[] => {
  return Object.values(FEATURE_FLAGS);
};
