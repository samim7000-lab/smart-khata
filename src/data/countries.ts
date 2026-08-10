import { CountryConfig } from '../types';

export const COUNTRIES: CountryConfig[] = [
  {
    code: 'BD',
    name: { en: 'Bangladesh', bn: 'বাংলাদেশ', hi: 'बांग्लादेश' },
    callingCode: '+880',
    flag: '🇧🇩',
    currencySymbol: '৳',
    currencyCode: 'BDT',
    currencyName: { en: 'Taka', bn: 'টাকা', hi: 'टका' },
    phoneLength: 10,
  },
  {
    code: 'IN',
    name: { en: 'India', bn: 'ভারত', hi: 'भारत' },
    callingCode: '+91',
    flag: '🇮🇳',
    currencySymbol: '₹',
    currencyCode: 'INR',
    currencyName: { en: 'Rupee', bn: 'রুপি', hi: 'रुपया' },
    phoneLength: 10,
  },
  {
    code: 'PK',
    name: { en: 'Pakistan', bn: 'পাকিস্তান', hi: 'पाकिस्तान' },
    callingCode: '+92',
    flag: '🇵🇰',
    currencySymbol: 'Rs',
    currencyCode: 'PKR',
    currencyName: { en: 'Rupee', bn: 'রুপি', hi: 'रुपया' },
    phoneLength: 10,
  },
  {
    code: 'AE',
    name: { en: 'United Arab Emirates', bn: 'সংযুক্ত আরব আমিরাত', hi: 'संयुक्त अरब अमीरात' },
    callingCode: '+971',
    flag: '🇦🇪',
    currencySymbol: 'AED',
    currencyCode: 'AED',
    currencyName: { en: 'Dirham', bn: 'দিরহাম', hi: 'दिरहम' },
    phoneLength: 9,
  },
  {
    code: 'SA',
    name: { en: 'Saudi Arabia', bn: 'সৌদি আরব', hi: 'सऊदी अरब' },
    callingCode: '+966',
    flag: '🇸🇦',
    currencySymbol: 'SAR',
    currencyCode: 'SAR',
    currencyName: { en: 'Riyal', bn: 'রিয়াল', hi: 'रियाल' },
    phoneLength: 9,
  },
  {
    code: 'US',
    name: { en: 'United States', bn: 'যুক্তরাষ্ট্র', hi: 'संयुक्त राज्य अमेरिका' },
    callingCode: '+1',
    flag: '🇺🇸',
    currencySymbol: '$',
    currencyCode: 'USD',
    currencyName: { en: 'Dollar', bn: 'ডলার', hi: 'डॉलर' },
    phoneLength: 10,
  },
  {
    code: 'GB',
    name: { en: 'United Kingdom', bn: 'যুক্তরাজ্য', hi: 'यूनाइटेड किंगडम' },
    callingCode: '+44',
    flag: '🇬🇧',
    currencySymbol: '£',
    currencyCode: 'GBP',
    currencyName: { en: 'Pound', bn: 'পাউন্ড', hi: 'पाउंड' },
    phoneLength: 10,
  },
  {
    code: 'NP',
    name: { en: 'Nepal', bn: 'নেপাল', hi: 'नेपाल' },
    callingCode: '+977',
    flag: '🇳🇵',
    currencySymbol: 'NRs',
    currencyCode: 'NPR',
    currencyName: { en: 'Rupee', bn: 'রুপি', hi: 'रुपया' },
    phoneLength: 10,
  },
  {
    code: 'LK',
    name: { en: 'Sri Lanka', bn: 'শ্রীলঙ্কা', hi: 'श्रीलंका' },
    callingCode: '+94',
    flag: '🇱🇰',
    currencySymbol: 'LKR',
    currencyCode: 'LKR',
    currencyName: { en: 'Rupee', bn: 'রুপি', hi: 'रुपया' },
    phoneLength: 9,
  },
  {
    code: 'MY',
    name: { en: 'Malaysia', bn: 'মালয়েশিয়া', hi: 'मलेशिया' },
    callingCode: '+60',
    flag: '🇲🇾',
    currencySymbol: 'RM',
    currencyCode: 'MYR',
    currencyName: { en: 'Ringgit', bn: 'রিঙ্গিত', hi: 'रिंगिट' },
    phoneLength: 9,
  },
  {
    code: 'SG',
    name: { en: 'Singapore', bn: 'সিঙ্গাপুর', hi: 'सिंगापुर' },
    callingCode: '+65',
    flag: '🇸🇬',
    currencySymbol: 'S$',
    currencyCode: 'SGD',
    currencyName: { en: 'Dollar', bn: 'ডলার', hi: 'डॉलर' },
    phoneLength: 8,
  },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Bangladesh

export const getCountryByCode = (code: string): CountryConfig => {
  const found = COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
  return found || DEFAULT_COUNTRY;
};

export const getBrowserCountry = (): CountryConfig => {
  if (typeof navigator === 'undefined') return DEFAULT_COUNTRY;

  const saved = localStorage.getItem('smart_khata_last_country');
  if (saved) {
    const found = COUNTRIES.find((c) => c.code === saved);
    if (found) return found;
  }

  const lang = navigator.language || '';
  if (lang.includes('BD') || lang.includes('bn')) return getCountryByCode('BD');
  if (lang.includes('IN') || lang.includes('hi')) return getCountryByCode('IN');
  if (lang.includes('PK')) return getCountryByCode('PK');
  if (lang.includes('AE')) return getCountryByCode('AE');
  if (lang.includes('US')) return getCountryByCode('US');
  if (lang.includes('GB')) return getCountryByCode('GB');

  return DEFAULT_COUNTRY;
};

export const formatE164 = (callingCode: string, inputNumber: string): string => {
  let digits = inputNumber.replace(/\D/g, '');
  
  // Strip leading zero if present for local input (e.g. 017... -> 17...)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  const cleanCallingCode = callingCode.replace(/\D/g, '');
  
  // If digits already include calling code at start, don't duplicate
  if (digits.startsWith(cleanCallingCode)) {
    return `+${digits}`;
  }

  return `${callingCode}${digits}`;
};

export const formatLocalPhone = (e164Phone: string): string => {
  if (!e164Phone) return '';
  // If already clean local format, return
  const found = COUNTRIES.find((c) => e164Phone.startsWith(c.callingCode));
  if (found) {
    const localPart = e164Phone.replace(found.callingCode, '');
    return `${found.callingCode} ${localPart}`;
  }
  return e164Phone;
};
