import { COUNTRIES } from '../data/countries';

/**
 * Formats any raw mobile number string into a clean WhatsApp E.164 string (without + prefix for wa.me)
 */
export const formatWhatsAppNumber = (phone: string, defaultCountryCode: string = 'IN'): string => {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  // 1. Check if number explicitly begins with + or country calling code
  if (trimmed.startsWith('+91') || (digitsOnly.length === 12 && digitsOnly.startsWith('91'))) {
    return digitsOnly;
  }
  if (trimmed.startsWith('+880') || (digitsOnly.length === 13 && digitsOnly.startsWith('880'))) {
    return digitsOnly;
  }

  // 2. India specific (10 digits starting with 6-9)
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return '91' + digitsOnly;
  }

  // 3. Bangladesh specific (11 digits starting with 01)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('01')) {
    return '88' + digitsOnly;
  }

  // 4. Match against country catalog
  const targetCountry = COUNTRIES.find((c) => c.code === defaultCountryCode) || COUNTRIES.find((c) => c.code === 'IN') || COUNTRIES[0];
  const callingDigits = targetCountry.callingCode.replace(/\D/g, '');

  if (digitsOnly.startsWith(callingDigits)) {
    return digitsOnly;
  }

  const strippedLeadingZero = digitsOnly.replace(/^0+/, '');
  return `${callingDigits}${strippedLeadingZero}`;
};

/**
 * Generates a direct WhatsApp web/app URL for wa.me
 */
export const getWhatsAppUrl = (phone: string, text: string, countryCode: string = 'IN'): string => {
  const cleanE164 = formatWhatsAppNumber(phone, countryCode);
  return `https://wa.me/${cleanE164}?text=${encodeURIComponent(text)}`;
};
