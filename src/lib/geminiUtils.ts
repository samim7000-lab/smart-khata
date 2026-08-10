import { TransactionType } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

export interface GeminiOcrResult {
  isValidLedger: boolean;
  reasonIfInvalid?: string;
  customerName: string;
  amount: number;
  type: TransactionType;
  confidence: number;
  notes?: string;
  error?: string;
}

export const analyzeHandwrittenLedger = async (
  imageBase64: string
): Promise<GeminiOcrResult> => {
  // Strip prefix data URL scheme if present (e.g. data:image/jpeg;base64,...)
  let cleanBase64 = imageBase64;
  let mimeType = 'image/jpeg';
  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  // 1. ROUTE ALL OCR REQUESTS SECURELY THROUGH SUPABASE EDGE FUNCTION
  if (isSupabaseConfigured && supabase) {
    try {
      console.log('[AI OCR] Invoking Supabase Edge Function (gemini-ocr)...');
      
      const { data, error } = await supabase.functions.invoke('gemini-ocr', {
        body: {
          imageBase64: cleanBase64,
          mimeType,
        },
      });

      if (error) {
        console.error('[AI OCR] Supabase Edge Function invoke error:', error);
        let errMsg = error.message || 'Failed to call Edge Function';
        if (error.context && typeof error.context.text === 'function') {
          try {
            const txt = await error.context.text();
            if (txt) errMsg += `: ${txt}`;
          } catch (_) {}
        }
        return {
          isValidLedger: false,
          reasonIfInvalid: `Supabase Edge Function error: ${errMsg}`,
          customerName: '',
          amount: 0,
          type: 'credit_given',
          confidence: 0,
          error: errMsg,
        };
      }

      if (data) {
        console.log('[AI OCR] Real Edge Function structural response:', data);
        const isValid = Boolean(data.is_valid_ledger);
        return {
          isValidLedger: isValid,
          reasonIfInvalid: data.reason_if_invalid || (isValid ? '' : 'This image does not contain a valid ledger or receipt.'),
          customerName: isValid ? (data.customer_name || '') : '',
          amount: isValid ? (Number(data.amount) || 0) : 0,
          type: data.type === 'payment_received' ? 'payment_received' : 'credit_given',
          confidence: Number(data.confidence) || (isValid ? 0.9 : 0),
          notes: data.notes || '',
          error: data.error,
        };
      }
    } catch (err: any) {
      console.error('[AI OCR] Edge Function catch error:', err);
      return {
        isValidLedger: false,
        reasonIfInvalid: `OCR Service Connection Error: ${err.message || 'Network error'}`,
        customerName: '',
        amount: 0,
        type: 'credit_given',
        confidence: 0,
        error: err.message || 'Connection Error',
      };
    }
  }

  // 2. NO MOCK/DUMMY DATA FALLBACK: Return explicit unconfigured error
  console.warn('[AI OCR] Supabase is not configured. Real Edge Function required.');
  return {
    isValidLedger: false,
    reasonIfInvalid: 'Supabase Cloud backend is not configured. Please connect Supabase to use AI Scanner.',
    customerName: '',
    amount: 0,
    type: 'credit_given',
    confidence: 0,
    error: 'Supabase Backend Unconfigured',
  };
};
