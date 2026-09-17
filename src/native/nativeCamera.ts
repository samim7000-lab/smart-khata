import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeCameraCaptureResult {
  success: boolean;
  cancelled?: boolean;
  dataUrl?: string;
  format?: string;
  error?: string;
}

export interface NativeCameraPluginInterface {
  capturePhoto(): Promise<NativeCameraCaptureResult>;
}

// Registered under "WhatsAppIntent" in MainActivity.java
const NativeCameraPlugin = registerPlugin<NativeCameraPluginInterface>('WhatsAppIntent');

/**
 * Captures a photo using the native Android camera intent with explicit FileProvider permissions.
 * Bypasses fragile WebView file chooser inputs on Android.
 * Returns a standard Blob ready for the canonical processing pipeline.
 */
export async function captureNativePhoto(): Promise<{
  success: boolean;
  cancelled?: boolean;
  blob?: Blob;
  error?: string;
  useWebFallback?: boolean;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, useWebFallback: true };
  }

  try {
    const res = await NativeCameraPlugin.capturePhoto();
    if (res.cancelled) {
      return { success: false, cancelled: true };
    }

    if (res.success && res.dataUrl) {
      const base64Data = res.dataUrl.includes(';base64,')
        ? res.dataUrl.split(';base64,')[1]
        : res.dataUrl;

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      return { success: true, blob };
    }

    return { success: false, error: res.error || 'Failed to capture photo' };
  } catch (err: any) {
    console.warn('[NATIVE-CAMERA] Exception in native capture, falling back to web input:', err);
    return { success: false, error: err.message, useWebFallback: true };
  }
}
