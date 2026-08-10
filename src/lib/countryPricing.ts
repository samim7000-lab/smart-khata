import { PlanTier } from '../types';

export interface CountryPricingConfig {
  countryCode: string;
  countryName: string;
  currencySymbol: string;
  currencyCode: string;
  callingCode: string;
  timezone: string;
  plans: Record<
    PlanTier,
    {
      priceFormatted: string;
      priceNumeric: number;
      campaignRecipientLimit: number;
      weeklyAiQuota: number; // 0 for free, 15 for pro, 100 for business
    }
  >;
}

export const font_country_configs: Record<string, CountryPricingConfig> = {
  IN: {
    countryCode: 'IN',
    countryName: 'India',
    currencySymbol: '₹',
    currencyCode: 'INR',
    callingCode: '+91',
    timezone: 'Asia/Kolkata',
    plans: {
      free: {
        priceFormatted: '₹0',
        priceNumeric: 0,
        campaignRecipientLimit: 50,
        weeklyAiQuota: 0,
      },
      pro: {
        priceFormatted: '₹49/month',
        priceNumeric: 49,
        campaignRecipientLimit: 500,
        weeklyAiQuota: 15,
      },
      business: {
        priceFormatted: '₹149/month',
        priceNumeric: 149,
        campaignRecipientLimit: Infinity,
        weeklyAiQuota: 100,
      },
      enterprise: {
        priceFormatted: '₹149/month',
        priceNumeric: 149,
        campaignRecipientLimit: Infinity,
        weeklyAiQuota: 100,
      },
    },
  },
  BD: {
    countryCode: 'BD',
    countryName: 'Bangladesh',
    currencySymbol: '৳',
    currencyCode: 'BDT',
    callingCode: '+880',
    timezone: 'Asia/Dhaka',
    plans: {
      free: {
        priceFormatted: '৳0',
        priceNumeric: 0,
        campaignRecipientLimit: 50,
        weeklyAiQuota: 0,
      },
      pro: {
        priceFormatted: '৳69/month',
        priceNumeric: 69,
        campaignRecipientLimit: 500,
        weeklyAiQuota: 15,
      },
      business: {
        priceFormatted: '৳199/month',
        priceNumeric: 199,
        campaignRecipientLimit: Infinity,
        weeklyAiQuota: 100,
      },
      enterprise: {
        priceFormatted: '৳199/month',
        priceNumeric: 199,
        campaignRecipientLimit: Infinity,
        weeklyAiQuota: 100,
      },
    },
  },
  DEFAULT: {
    countryCode: 'US',
    countryName: 'Global / US',
    currencySymbol: '$',
    currencyCode: 'USD',
    callingCode: '+1',
    timezone: 'America/New_York',
    plans: {
      free: {
        priceFormatted: '$0',
        priceNumeric: 0,
        campaignRecipientLimit: 50,
        weeklyAiQuota: 0,
      },
      pro: {
        priceFormatted: '$9/month',
        priceNumeric: 9,
        campaignRecipientLimit: 500,
        weeklyAiQuota: 15,
      },
      business: {
        priceFormatted: '$25/month',
        priceNumeric: 25,
        campaignRecipientLimit: Infinity,
        weeklyAiQuota: 100,
      },
      enterprise: {
        priceFormatted: '$99/month',
        priceNumeric: 99,
        campaignRecipientLimit: Infinity,
        weeklyAiQuota: 100,
      },
    },
  },
};

/**
 * Resolve currency symbol strictly based on shop country or shop currency code.
 * UI language selection MUST NEVER alter currency formatting or symbols.
 */
export function resolveCurrencySymbol(countryOrCurrency?: string | null, currencyCode?: string | null): string {
  const c1 = (countryOrCurrency || '').toUpperCase().trim();
  const c2 = (currencyCode || '').toUpperCase().trim();
  const combined = `${c1} ${c2}`;

  // 1. India / INR matches
  if (
    c1 === 'IN' ||
    c2 === 'INR' ||
    combined.includes('INR') ||
    combined.includes('RUPEE') ||
    combined.includes('INDIA') ||
    combined.includes('+91')
  ) {
    return '₹';
  }

  // 2. Bangladesh / BDT matches
  if (
    c1 === 'BD' ||
    c2 === 'BDT' ||
    combined.includes('BDT') ||
    combined.includes('TAKA') ||
    combined.includes('BANGLADESH') ||
    combined.includes('+880')
  ) {
    return '৳';
  }

  // 3. UAE / AED
  if (combined.includes('AED') || combined.includes('UAE') || combined.includes('EMIRATES') || c1 === 'AE') {
    return 'د.إ';
  }

  // 4. Saudi Arabia / SAR
  if (combined.includes('SAR') || combined.includes('SAUDI') || c1 === 'SA') {
    return 'ر.س';
  }

  // 5. UK / GBP
  if (combined.includes('GBP') || combined.includes('POUND') || combined.includes('KINGDOM') || c1 === 'GB' || c1 === 'UK') {
    return '£';
  }

  // 6. US / USD
  if (combined.includes('USD') || combined.includes('DOLLAR') || combined.includes('STATES') || c1 === 'US') {
    return '$';
  }

  // 7. Check saved localStorage country preference if shop country was unpopulated/null
  if (typeof localStorage !== 'undefined') {
    const savedCountry = (localStorage.getItem('smart_khata_last_country') || '').toUpperCase().trim();
    if (savedCountry === 'IN' || savedCountry.includes('INDIA') || savedCountry.includes('INR')) {
      return '₹';
    }
    if (savedCountry === 'BD' || savedCountry.includes('BANGLADESH') || savedCountry.includes('BDT')) {
      return '৳';
    }
  }

  // 8. Fallback lookup in font_country_configs or default to INR for India / BD for Bangladesh
  const configKey = font_country_configs[c1] ? c1 : font_country_configs[c2] ? c2 : 'IN';
  return (font_country_configs[configKey] || font_country_configs.IN || font_country_configs.DEFAULT).currencySymbol;
}

/**
 * Get country pricing configuration based on shop country code or name
 */
export function getCountryPricing(countryCode?: string): CountryPricingConfig {
  if (!countryCode) {
    const savedCountry = typeof localStorage !== 'undefined' ? (localStorage.getItem('smart_khata_last_country') || '').toUpperCase() : '';
    if (savedCountry === 'BD' || savedCountry.includes('BANGLADESH')) {
      return font_country_configs.BD;
    }
    return font_country_configs.IN;
  }
  const raw = countryCode.toUpperCase().trim();

  if (raw === 'IN' || raw.includes('INDIA') || raw.includes('INR') || raw.includes('+91')) {
    return font_country_configs.IN;
  }
  if (raw === 'BD' || raw.includes('BANGLADESH') || raw.includes('BDT') || raw.includes('+880')) {
    return font_country_configs.BD;
  }

  const key = font_country_configs[raw] ? raw : 'IN';
  return font_country_configs[key] || font_country_configs.IN || font_country_configs.DEFAULT;
}

/**
 * Format currency strictly according to shop country/currency with zero trailing language words
 */
export function formatShopCurrency(amount: number | null | undefined, countryCode?: string, currencyCode?: string): string {
  const num = amount || 0;
  const symbol = resolveCurrencySymbol(countryCode, currencyCode);
  return `${symbol}${Math.abs(num).toLocaleString()}`;
}
