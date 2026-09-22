import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeCameraCaptureResult {
  success: boolean;
  cancelled?: boolean;
  dataUrl?: string;
  format?: string;
  error?: string;
  hasPending?: boolean;
  captureRequestId?: string;
}

export interface NativeCameraPluginInterface {
  capturePhoto(options?: { captureRequestId?: string }): Promise<NativeCameraCaptureResult>;
  getPendingCapturedPhoto(): Promise<NativeCameraCaptureResult>;
  clearPendingCapturedPhoto(): Promise<{ success: boolean }>;
}

// Registered under "WhatsAppIntent" in MainActivity.java
const NativeCameraPlugin = registerPlugin<NativeCameraPluginInterface>('WhatsAppIntent');

function dataUrlToBlob(dataUrl: string): Blob {
  const base64Data = dataUrl.includes(';base64,') ? dataUrl.split(';base64,')[1] : dataUrl;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/jpeg' });
}

/**
 * Captures a photo using the native Android camera intent with explicit FileProvider permissions.
 * Bypasses fragile WebView file chooser inputs on Android.
 * Returns a standard Blob ready for the canonical processing pipeline.
 */
export async function captureNativePhoto(captureRequestId?: string): Promise<{
  success: boolean;
  cancelled?: boolean;
  blob?: Blob;
  captureRequestId?: string;
  error?: string;
  useWebFallback?: boolean;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, useWebFallback: true };
  }

  try {
    const res = await NativeCameraPlugin.capturePhoto({ captureRequestId });
    if (res.cancelled) {
      return { success: false, cancelled: true };
    }

    if (res.success && res.dataUrl) {
      const blob = dataUrlToBlob(res.dataUrl);
      return { success: true, blob, captureRequestId: res.captureRequestId || captureRequestId };
    }

    return { success: false, error: res.error || 'Failed to capture photo' };
  } catch (err: any) {
    console.warn('[NATIVE-CAMERA] Exception in native capture, falling back to web input:', err);
    return { success: false, error: err.message, useWebFallback: true };
  }
}

/**
 * Recovers a pending completed camera photo after Activity / React remount.
 * Enforces one-time consumption.
 */
export async function recoverPendingNativePhoto(): Promise<{
  hasPending: boolean;
  blob?: Blob;
  captureRequestId?: string;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { hasPending: false };
  }

  try {
    const res = await NativeCameraPlugin.getPendingCapturedPhoto();
    if (res.success && res.hasPending && res.dataUrl) {
      const blob = dataUrlToBlob(res.dataUrl);
      return {
        hasPending: true,
        blob,
        captureRequestId: res.captureRequestId,
      };
    }
    return { hasPending: false };
  } catch (err) {
    console.warn('[NATIVE-CAMERA] Error querying pending camera photo:', err);
    return { hasPending: false };
  }
}

/**
 * Clears any residual pending camera photo in native storage.
 */
export async function clearPendingNativePhoto(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativeCameraPlugin.clearPendingCapturedPhoto();
  } catch {}
}
