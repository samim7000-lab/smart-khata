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
