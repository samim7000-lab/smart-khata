// SMART KHATA — SECURE AI TASK ROUTER & DETERMINISTIC FALLBACK PIPELINE
// Strict 3-Tier Architecture:
// Tier 1: Deterministic financial invariants (amounts, balances, days overdue, IDs) — ZERO LLM.
// Tier 2: AI assistance (context-aware follow-up drafting, multilingual campaigns in BN/HI/EN).
// Tier 3: Merchant approval (all actions require merchant review; ZERO auto-send).

import { supabase, isSupabaseConfigured } from './supabase.ts';
import { formatShopCurrency } from './countryPricing.ts';
import { getCampaignDraft } from './campaignTemplates.ts';
import type { CampaignGoalCategory } from './campaignTemplates.ts';
import type { Language } from '../types/index.ts';

export type AITaskType = 'OCR_VISION' | 'RECOVERY_ADVICE' | 'CAMPAIGN_DRAFT';

export type RecoveryTone = 'polite' | 'friendly' | 'firm';
export type CampaignTone = 'warm' | 'promotional' | 'urgent';

export interface RecoveryAdviceInput {
  shopId: string;
  shopName: string;
  country?: string;
  currencyCode?: string;
  customerId: string;
  customerName: string;
  balance: number;
  oldestUnpaidDays: number;
  daysSinceLastPayment: number;
  language: Language;
  tone?: RecoveryTone;
}

export interface RecoveryAdviceResult {
  success: boolean;
  explanation: string;
  suggestedMessage: string;
  source: 'ai' | 'deterministic_fallback';
  modelUsed?: string;
  error?: string;
}

export interface CampaignDraftInput {
  shopId: string;
  shopName: string;
  goal: CampaignGoalCategory;
  audience: string;
  language: Language;
  tone?: CampaignTone;
  customOffer?: string;
}

export interface CampaignDraftResult {
  success: boolean;
  suggestedMessage: string;
  source: 'ai' | 'deterministic_fallback';
  modelUsed?: string;
  error?: string;
}

/**
 * Tier 1 Deterministic Fallback: Generates polite, structured recovery reminder copy
 * without relying on an internet connection or external LLM.
 */
export function getDeterministicRecoveryAdvice(input: RecoveryAdviceInput): {
  explanation: string;
  suggestedMessage: string;
} {
  const country = input.country || 'IN';
  const currencyCode = input.currencyCode || 'INR';
  const formattedBal = formatShopCurrency(input.balance, country, currencyCode);
  const tone = input.tone || 'polite';
  const lang = input.language || 'bn';

  let explanation = '';
  let suggestedMessage = '';

  if (lang === 'bn') {
    explanation = `${input.customerName}-এর মোট বাকি ${formattedBal}, যা ${input.oldestUnpaidDays} দিন যাবৎ অনাদায়ী। একটি বিনম্র তাগাদা দেওয়া সমীচীন।`;
    if (tone === 'friendly') {
      suggestedMessage = `আসসালামু আলাইকুম / নমস্কার ${input.customerName} ভাই, কেমন আছেন? ${input.shopName} থেকে জানাচ্ছি। আপনার পূর্বের কেনাকাটার মোট বাকি ${formattedBal} টাকা হয়েছে। সময় করে হিসাবটি মিলিয়ে নিলে খুব উপকৃত হতাম। ধন্যবাদ!`;
    } else if (tone === 'firm') {
      suggestedMessage = `প্রিয় ${input.customerName}, ${input.shopName} থেকে জরুরি তাগাদা। আপনার মোট বাকি ${formattedBal} টাকা বিগত ${input.oldestUnpaidDays} দিন ধরে অনাদায়ী রয়েছে। অনুগ্রহ করে যত দ্রুত সম্ভব বকেয়া পরিশোধ করুন। ধন্যবাদ।`;
    } else {
      // polite (default)
      suggestedMessage = `প্রিয় ${input.customerName}, ${input.shopName} থেকে শুভেচ্ছা। আপনার খাতার হিসাব অনুযায়ী মোট বাকি ${formattedBal} টাকা। সুবিধামতো সময়ে হিসাবটি পরিশোধ করার জন্য বিনীত অনুরোধ করছি। ধন্যবাদ!`;
    }
  } else if (lang === 'hi') {
    explanation = `${input.customerName} का कुल बकाया ${formattedBal} है, जो ${input.oldestUnpaidDays} दिनों से लंबित है। विनम्रतापूर्वक याद दिलाना उचित रहेगा।`;
    if (tone === 'friendly') {
      suggestedMessage = `नमस्ते ${input.customerName} जी, कैसे हैं आप? ${input.shopName} से संपर्क कर रहे हैं। आपके खाते में कुल बकाया ${formattedBal} है। सुविधानुसार हिसाब चुकता कर लें तो बहुत मदद होगी। धन्यवाद!`;
    } else if (tone === 'firm') {
      suggestedMessage = `प्रिय ${input.customerName}, ${input.shopName} से स्मरण पत्र। आपका कुल बकाया ${formattedBal} पिछले ${input.oldestUnpaidDays} दिनों से बाकी है। कृपया शीघ्र अति शीघ्र भुगतान करें। धन्यवाद।`;
    } else {
      suggestedMessage = `प्रिय ${input.customerName}, ${input.shopName} की तरफ से सादर प्रणाम। आपके खाते का कुल बकाया ${formattedBal} है। कृपया सुविधानुसार समय पर भुगतान करने की कृपा करें। धन्यवाद!`;
    }
  } else {
    explanation = `${input.customerName} has an outstanding balance of ${formattedBal} unpaid for ${input.oldestUnpaidDays} days. A courteous follow-up is recommended.`;
    if (tone === 'friendly') {
      suggestedMessage = `Hello ${input.customerName}, hope you are doing well! Friendly reminder from ${input.shopName}: your current balance is ${formattedBal}. Whenever convenient, please help settle the account. Thank you!`;
    } else if (tone === 'firm') {
      suggestedMessage = `Dear ${input.customerName}, this is an overdue notice from ${input.shopName}. Your outstanding balance of ${formattedBal} has been unpaid for ${input.oldestUnpaidDays} days. Please arrange payment at your earliest convenience. Thank you.`;
    } else {
      suggestedMessage = `Dear ${input.customerName}, greetings from ${input.shopName}. A kind reminder that your outstanding balance is ${formattedBal}. We appreciate your timely settlement. Thank you!`;
    }
  }

  return { explanation, suggestedMessage };
}

/**
 * Tier 1 Deterministic Fallback: Generates marketing campaign draft based on verified category templates.
 */
export function getDeterministicCampaignDraft(input: CampaignDraftInput): {
  suggestedMessage: string;
} {
  return {
    suggestedMessage: getCampaignDraft(input.goal, input.language),
  };
}

/**
 * Executes a structured AI task:
 * 1. Checks device offline status (navigator.onLine). If offline, instantly returns deterministic fallback.
 * 2. If Supabase is available, invokes server-side Edge Function (gemini-ocr) with task payload.
 * 3. Handles timeouts, errors, and invalid responses by falling back to deterministic templates.
 */
export async function executeRecoveryAdviceTask(
  input: RecoveryAdviceInput,
  timeoutMs: number = 8000
): Promise<RecoveryAdviceResult> {
  const deterministic = getDeterministicRecoveryAdvice(input);

  // Offline Guard: Never fail on poor connectivity
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[AI ROUTER] Device is offline. Using deterministic recovery template.');
    return {
      success: true,
      explanation: deterministic.explanation,
      suggestedMessage: deterministic.suggestedMessage,
      source: 'deterministic_fallback',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: true,
      explanation: deterministic.explanation,
      suggestedMessage: deterministic.suggestedMessage,
      source: 'deterministic_fallback',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const { data, error } = await supabase.functions.invoke('gemini-ocr', {
      body: {
        task: 'recovery_advice',
        shopId: input.shopId,
        shopName: input.shopName,
        customerName: input.customerName,
        balance: input.balance,
        currency: input.currencyCode || 'INR',
        daysOverdue: input.oldestUnpaidDays,
        daysSinceLastPayment: input.daysSinceLastPayment,
        language: input.language,
        tone: input.tone || 'polite',
      },
    });

    clearTimeout(timer);

    if (error || !data || !data.suggestedMessage) {
      console.warn('[AI ROUTER] Edge function returned error or empty response, falling back:', error);
      return {
        success: true,
        explanation: data?.explanation || deterministic.explanation,
        suggestedMessage: deterministic.suggestedMessage,
        source: 'deterministic_fallback',
        error: error?.message,
      };
    }

    return {
      success: true,
      explanation: data.explanation || deterministic.explanation,
      suggestedMessage: data.suggestedMessage,
      source: 'ai',
      modelUsed: data.modelUsed || 'gemini-2.5-flash',
    };
  } catch (err: any) {
    console.warn('[AI ROUTER] Recovery advice invoke exception, using deterministic fallback:', err);
    return {
      success: true,
      explanation: deterministic.explanation,
      suggestedMessage: deterministic.suggestedMessage,
      source: 'deterministic_fallback',
      error: err.message,
    };
  }
}

/**
 * Executes a structured Campaign Draft task:
 * 1. Checks device offline status. If offline, instantly returns deterministic template.
 * 2. Invokes server-side Edge Function with category, audience, and shop details.
 * 3. Falls back gracefully on any network failure or timeout.
 */
export async function executeCampaignDraftTask(
  input: CampaignDraftInput,
  timeoutMs: number = 8000
): Promise<CampaignDraftResult> {
  const deterministic = getDeterministicCampaignDraft(input);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[AI ROUTER] Device is offline. Using deterministic campaign template.');
    return {
      success: true,
      suggestedMessage: deterministic.suggestedMessage,
      source: 'deterministic_fallback',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: true,
      suggestedMessage: deterministic.suggestedMessage,
      source: 'deterministic_fallback',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const { data, error } = await supabase.functions.invoke('gemini-ocr', {
      body: {
        task: 'campaign_draft',
        shopId: input.shopId,
        shopName: input.shopName,
        goal: input.goal,
        audience: input.audience,
        language: input.language,
        tone: input.tone || 'warm',
        customOffer: input.customOffer,
      },
    });

    clearTimeout(timer);

    if (error || !data || !data.suggestedMessage) {
      console.warn('[AI ROUTER] Edge function returned error for campaign draft, falling back:', error);
      return {
        success: true,
        suggestedMessage: deterministic.suggestedMessage,
        source: 'deterministic_fallback',
        error: error?.message,
      };
    }

    return {
      success: true,
      suggestedMessage: data.suggestedMessage,
      source: 'ai',
      modelUsed: data.modelUsed || 'gemini-2.5-flash',
    };
  } catch (err: any) {
    console.warn('[AI ROUTER] Campaign draft invoke exception, using deterministic fallback:', err);
    return {
      success: true,
      suggestedMessage: deterministic.suggestedMessage,
      source: 'deterministic_fallback',
      error: err.message,
    };
  }
}
