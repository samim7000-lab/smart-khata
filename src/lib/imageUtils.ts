import { supabase, isSupabaseConfigured } from './supabase';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export const validateImageFile = (file: File): ImageValidationResult => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Please select a valid image file (JPEG, PNG, or WebP).',
    };
  }

  const maxSizeMB = 5;
  if (file.size > maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit. Please choose a smaller image.`,
    };
  }

  return { valid: true };
};

export const compressImage = (
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

export const uploadShopAsset = async (
  file: File,
  assetType: 'logo' | 'photo' | 'signature',
  shopId: string
): Promise<string> => {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file');
  }

  // Compress image client-side first
  const compressedDataUrl = await compressImage(file, 800, 800, 0.82);

  if (isSupabaseConfigured && supabase) {
    try {
      // Convert DataURL to Blob for Supabase Storage
      const res = await fetch(compressedDataUrl);
      const blob = await res.blob();

      const fileName = `${shopId}/${assetType}_${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('shop-assets')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.warn('Supabase storage upload error, using local compressed DataURL:', error.message);
        return compressedDataUrl;
      }

      const { data: publicUrlData } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl || compressedDataUrl;
    } catch (err) {
      console.warn('Storage upload exception, falling back to compressed DataURL', err);
      return compressedDataUrl;
    }
  }

  // Fallback for local / demo mode
  return compressedDataUrl;
};

/**
 * Uploads handwritten ledger proof photo to Supabase Storage ('ledger_photos' bucket).
 * Returns the public CDN URL to store in transactions.ledger_photo_url.
 * Falls back gracefully if storage is unconfigured.
 */
export const uploadLedgerPhotoProof = async (
  input: string | File,
  shopId: string
): Promise<string> => {
  if (!isSupabaseConfigured || !supabase) {
    if (typeof input === 'string') return input;
    return await compressImage(input, 600, 600, 0.75);
  }

  try {
    let blob: Blob;
    if (typeof input === 'string') {
      const res = await fetch(input);
      blob = await res.blob();
    } else {
      const compressedDataUrl = await compressImage(input, 1200, 1200, 0.82);
      const res = await fetch(compressedDataUrl);
      blob = await res.blob();
    }

    const fileName = `${shopId}/ledger_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;

    const { data, error } = await supabase.storage
      .from('ledger_photos')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: true,
      });

    if (error) {
      console.warn('[STORAGE] Upload to ledger_photos failed, falling back:', error.message);
      // Fallback to shop-assets if ledger_photos bucket does not exist
      const fallbackUpload = await supabase.storage
        .from('shop-assets')
        .upload(`ledger_${fileName}`, blob, { contentType: 'image/jpeg', upsert: true });

      if (fallbackUpload.error) {
        console.warn('[STORAGE] Fallback upload also failed, using compact thumbnail string:', fallbackUpload.error.message);
        return '';
      }
      const { data: publicUrlData } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(`ledger_${fileName}`);
      return publicUrlData.publicUrl;
    }

    const { data: publicUrlData } = supabase.storage
      .from('ledger_photos')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('[STORAGE] Error uploading ledger photo proof:', err);
    return '';
  }
};
