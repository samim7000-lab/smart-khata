import { CountryConfig, Language } from '../types';

export interface PhoneValidationResult {
  isValid: boolean;
  errorMsg?: string;
  normalizedE164?: string;
}

/**
 * Validates a mobile number against country rules and returns localized error messages.
 */
export function validatePhoneNumber(
  phone: string,
  country: CountryConfig,
  language: Language = 'en'
): PhoneValidationResult {
  if (!phone || !phone.trim()) {
    return {
      isValid: false,
      errorMsg:
        language === 'bn'
          ? 'মোবাইল নম্বর দেওয়া আবশ্যক।'
          : language === 'hi'
          ? 'मोबाइल नंबर आवश्यक है।'
          : 'Mobile number is required.',
    };
  }

  const rawDigits = phone.replace(/\D/g, '');
  const cleanCallingDigits = country.callingCode.replace(/\D/g, '');

  let localDigits = rawDigits;
  if (localDigits.startsWith(cleanCallingDigits)) {
    localDigits = localDigits.slice(cleanCallingDigits.length);
  }

  // Strip leading zero for local format e.g. 01712345678 -> 1712345678
  if (localDigits.startsWith('0')) {
    localDigits = localDigits.slice(1);
  }

  const expectedLength = country.phoneLength || 10;

  // 1. India (+91)
  if (country.code === 'IN') {
    if (localDigits.length < 10) {
      return {
        isValid: false,
        errorMsg:
          language === 'bn'
            ? 'সঠিক মোবাইল নম্বর দিন।'
            : language === 'hi'
            ? 'कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।'
            : 'Please enter a valid 10-digit mobile number.',
      };
    }
    if (localDigits.length > 10) {
      return {
        isValid: false,
        errorMsg:
          language === 'bn'
            ? 'মোবাইল নম্বরটি সঠিক নয়।'
            : language === 'hi'
            ? 'मोबाइल नंबर सही नहीं है (10 अंक होने चाहिए)।'
            : 'Mobile number is invalid (must be 10 digits).',
      };
    }
    if (!/^[6-9]\d{9}$/.test(localDigits)) {
      return {
        isValid: false,
        errorMsg:
          language === 'bn'
            ? 'মোবাইল নম্বরটি সঠিক নয়।'
            : language === 'hi'
            ? 'अमान्य भारतीय मोबाइल नंबर।'
            : 'Invalid Indian mobile number format.',
      };
    }
  }

  // 2. Bangladesh (+880)
  else if (country.code === 'BD') {
    if (localDigits.length < 10) {
      return {
        isValid: false,
        errorMsg:
          language === 'bn'
            ? 'সঠিক মোবাইল নম্বর দিন।'
            : language === 'hi'
            ? 'कृपया सही बांग्लादेशी मोबाइल नंबर दर्ज करें।'
            : 'Please enter a valid Bangladesh mobile number.',
      };
    }
    if (localDigits.length > 10) {
      return {
        isValid: false,
        errorMsg:
          language === 'bn'
            ? 'মোবাইল নম্বরটি সঠিক নয়।'
            : language === 'hi'
            ? 'मोबाइल नंबर सही नहीं है।'
            : 'Mobile number is invalid.',
      };
    }
    if (!/^1[3-9]\d{8}$/.test(localDigits)) {
      return {
        isValid: false,
        errorMsg:
          language === 'bn'
            ? 'মোবাইল নম্বরটি সঠিক নয়।'
            : language === 'hi'
            ? 'अमान्य बांग्लादेशी मोबाइल नंबर।'
            : 'Invalid Bangladesh mobile number format.',
      };
    }
  }

  // 3. Other Countries
  else {
    if (localDigits.length < expectedLength) {
      return {
        isValid: false,
        errorMsg:
          language === 'bn'
            ? 'সঠিক মোবাইল নম্বর দিন।'
            : language === 'hi'
            ? 'कृपया सही मोबाइल नंबर दर्ज करें।'
            : 'Please enter a valid mobile number.',
      };
    }
    if (localDigits.length > expectedLength) {
      return {
        isValid: false,
        errorMsg:
          language === 'bn'
            ? 'মোবাইল নম্বরটি সঠিক নয়।'
            : language === 'hi'
            ? 'मोबाइल नंबर अमान्य है।'
            : 'Mobile number is invalid.',
      };
    }
  }

  const normalizedE164 = `${country.callingCode}${localDigits}`;

  return {
    isValid: true,
    normalizedE164,
  };
}

/**
 * Validates optional email format if filled.
 */
export function validateEmail(email: string, language: Language = 'en'): { isValid: boolean; errorMsg?: string } {
  if (!email || !email.trim()) return { isValid: true };
  const trimmed = email.trim();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (!isValid) {
    return {
      isValid: false,
      errorMsg:
        language === 'bn'
          ? 'সঠিক ইমেইল অ্যাড্রেস দিন।'
          : language === 'hi'
          ? 'कृपया सही ईमेल पता दर्ज करें।'
          : 'Please enter a valid email address.',
    };
  }
  return { isValid: true };
}

/**
 * Validates optional GSTIN structure if filled (for India/generic).
 */
export function validateGSTIN(gstNumber: string, language: Language = 'en'): { isValid: boolean; errorMsg?: string } {
  if (!gstNumber || !gstNumber.trim()) return { isValid: true };
  const trimmed = gstNumber.trim().toUpperCase();
  // 15 alphanumeric format (standard Indian GSTIN format or generic length check)
  if (trimmed.length !== 15 || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(trimmed)) {
    return {
      isValid: false,
      errorMsg:
        language === 'bn'
          ? 'GST নম্বরটি ১৫ অক্ষরের সঠিক ফরম্যাটে হতে হবে।'
          : language === 'hi'
          ? 'GST नंबर 15 अंकों का सही प्रारूप होना चाहिए।'
          : 'GST number must be a valid 15-character format (e.g., 22AAAAA0000A1Z5).',
    };
  }
  return { isValid: true };
}

