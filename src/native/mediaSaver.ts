import { registerPlugin, Capacitor } from '@capacitor/core';

export interface SaveImageResult {
  success: boolean;
  uri?: string;
  fileName?: string;
  folder?: string;
  error?: string;
}

export interface MediaSaverPluginInterface {
  saveImageToGallery(options: { imageBase64: string; fileName: string }): Promise<SaveImageResult>;
}

// WhatsAppIntentPlugin exposes saveImageToGallery under "WhatsAppIntent"
const NativeMediaSaver = registerPlugin<MediaSaverPluginInterface>('WhatsAppIntent');

/**
 * Converts a Blob or File to a clean Base64 string without data: URL prefix.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves a receipt image to the device.
 * On Native Android:
 *   Saves into the Android Gallery/Photos under Pictures/SmartKhata using MediaStore.
 * On Web / Browser:
 *   Triggers standard browser file download via temporary anchor element.
 */
export async function saveReceiptImageToDevice(
  fileOrBlob: File | Blob,
  fileName: string
): Promise<{ success: boolean; message: string; uri?: string; folder?: string }> {
  // 1. Android Native Platform Path
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await blobToBase64(fileOrBlob);
      const res = await NativeMediaSaver.saveImageToGallery({
        imageBase64: base64,
        fileName,
      });

      if (res && res.success) {
        return {
          success: true,
          message: 'Saved to Phone Gallery (Pictures/SmartKhata)',
          uri: res.uri,
          folder: res.folder,
        };
      } else {
        throw new Error(res?.error || 'Native gallery save failed');
      }
    } catch (err: any) {
      console.error('[MEDIA-SAVER] Native gallery save failed:', err);
      // Fall through to browser download fallback
    }
  }

  // 2. Web Browser Fallback Path
  try {
    const url = URL.createObjectURL(fileOrBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: 'Receipt image downloaded successfully!',
    };
  } catch (err: any) {
    console.error('[MEDIA-SAVER] Browser download failed:', err);
    return {
      success: false,
      message: 'Failed to download receipt image.',
    };
  }
}
