import { TransactionType } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { parseIndicAmount } from './indicNumerals';

export interface GeminiOcrResult {
  isValidLedger: boolean;
  status: 'success' | 'uncertain' | 'unreadable';
  reasonIfInvalid?: string;
  customerName: string;
  amount: number;
  type: TransactionType | 'unknown';
  confidence: number;
  currency?: string;
  rawText?: string;
  notes?: string;
  resolvedModel?: string;
  error?: string;
}

/**
 * Dispatches an image to the secure Supabase Edge Function (gemini-ocr),
 * which invokes Gemini 3.6 Flash server-side.
 */
export const analyzeHandwrittenLedger = async (
  imageBase64: string,
  timeoutMs: number = 30000
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

      // Create abort controller for timeout safety on slow 2G/3G mobile networks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const { data, error } = await supabase.functions.invoke('gemini-ocr', {
        body: {
          imageBase64: cleanBase64,
          mimeType,
        },
      });

      clearTimeout(timeoutId);

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
          status: 'unreadable',
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
        const rawStatus = data.status || (isValid ? 'success' : 'unreadable');

        // Parse amount using deterministic Indic numeral normalizer
        const parsedAmt = parseIndicAmount(data.amount);
        const cleanAmount = parsedAmt.isValid ? parsedAmt.amount : (Number(data.amount) || 0);

        let txType: TransactionType | 'unknown' = 'unknown';
        if (data.type === 'payment_received' || data.transaction_type === 'payment_received') {
          txType = 'payment_received';
        } else if (data.type === 'credit_given' || data.transaction_type === 'credit_given') {
          txType = 'credit_given';
        }

        return {
          isValidLedger: isValid,
          status: rawStatus,
          reasonIfInvalid: data.reason_if_invalid || (isValid ? '' : 'This image does not contain a clear handwritten ledger or bill entry.'),
          customerName: isValid ? String(data.customer_name || '').trim() : '',
          amount: cleanAmount,
          type: txType,
          confidence: Number(data.confidence) || (isValid ? 0.85 : 0),
          currency: data.currency || 'INR',
          rawText: data.raw_text || '',
          notes: data.notes || '',
          resolvedModel: data.resolved_model || 'gemini-3.6-flash',
          error: data.error,
        };
      }
    } catch (err: any) {
      console.error('[AI OCR] Edge Function catch error:', err);
      const isTimeout = err?.name === 'AbortError' || String(err).includes('aborted');
      return {
        isValidLedger: false,
        status: 'unreadable',
        reasonIfInvalid: isTimeout 
          ? 'Analysis timed out. Please check your internet connection and try again.'
          : `OCR Service Connection Error: ${err.message || 'Network error'}`,
        customerName: '',
        amount: 0,
        type: 'credit_given',
        confidence: 0,
        error: isTimeout ? 'Timeout' : (err.message || 'Connection Error'),
      };
    }
  }

  // 2. NO MOCK/DUMMY DATA FALLBACK: Return explicit unconfigured error
  console.warn('[AI OCR] Supabase is not configured. Real Edge Function required.');
  return {
    isValidLedger: false,
    status: 'unreadable',
    reasonIfInvalid: 'Supabase Cloud backend is not configured. Please connect Supabase to use AI Scanner.',
    customerName: '',
    amount: 0,
    type: 'credit_given',
    confidence: 0,
    error: 'Supabase Backend Unconfigured',
  };
};
