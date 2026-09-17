import { registerPlugin, Capacitor } from '@capacitor/core';

export interface WhatsAppCapabilities {
  whatsappInstalled: boolean;
  whatsappVersion?: string | null;
  whatsappBusinessInstalled: boolean;
  whatsappBusinessVersion?: string | null;
  viewSchemeResolves: boolean;
  viewActivities?: string[];
  sendImageResolves: boolean;
  sendImageActivities?: string[];
  wameResolves: boolean;
}

export interface IntentTestOptions {
  candidate: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  phone: string;
  text: string;
  imageBase64?: string | null;
  fileName?: string;
  delayMs?: number;
}

export interface IntentTestResult {
  success: boolean;
  candidate: string;
  mode: string;
  resolvedComponent?: string;
  contentUri?: string;
  executionTimeMs: number;
  details?: string;
  error?: string;
}

export interface WhatsAppIntentPluginInterface {
  discoverWhatsAppCapabilities(): Promise<WhatsAppCapabilities>;
  testIntentCandidate(options: IntentTestOptions): Promise<IntentTestResult>;
}

// Register native plugin bridge
export const WhatsAppIntentNative = registerPlugin<WhatsAppIntentPluginInterface>('WhatsAppIntent');

/**
 * Safe wrapper for querying installed WhatsApp capabilities.
 * Returns null if not running on native Android.
 */
export async function queryNativeWhatsAppCapabilities(): Promise<WhatsAppCapabilities | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  try {
    return await WhatsAppIntentNative.discoverWhatsAppCapabilities();
  } catch (err) {
    console.warn('[WHATSAPP-EXPERIMENT] Discovery failed:', err);
    return null;
  }
}

/**
 * Safe wrapper for testing an intent matrix candidate.
 * Returns simulated failure if not running on native platform.
 */
export async function executeIntentCandidate(options: IntentTestOptions): Promise<IntentTestResult> {
  if (!Capacitor.isNativePlatform()) {
    return {
      success: false,
      candidate: options.candidate,
      mode: 'web_simulation_only',
      executionTimeMs: 0,
      error: 'Not running on native Android platform.',
    };
  }

  try {
    return await WhatsAppIntentNative.testIntentCandidate(options);
  } catch (err: any) {
    return {
      success: false,
      candidate: options.candidate,
      mode: 'exception_thrown',
      executionTimeMs: 0,
      error: err?.message || String(err),
    };
  }
}

/**
 * Utility: Converts a Blob/File (such as from html2canvas) to raw Base64 data.
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip "data:image/png;base64," header
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
