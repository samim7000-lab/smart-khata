import { supabase, isSupabaseConfigured } from './supabase';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export const validateImageFile = (file: File | Blob): ImageValidationResult => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Please select a valid image file (JPEG, PNG, or WebP).',
    };
  }

  const maxSizeMB = 10;
  if (file.size > maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit. Please choose a smaller image.`,
    };
  }

  return { valid: true };
};

export const compressImage = (
  file: File | Blob,
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
 * Bucket is private (public = false).
 * Returns the object path inside the bucket (e.g. `${shopId}/ledger_${Date.now()}_${random}.jpg`).
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
      // Fallback to shop-assets if ledger_photos bucket upload fails
      const fallbackUpload = await supabase.storage
        .from('shop-assets')
        .upload(`ledger_${fileName}`, blob, { contentType: 'image/jpeg', upsert: true });

      if (fallbackUpload.error) {
        console.warn('[STORAGE] Fallback upload also failed:', fallbackUpload.error.message);
        return '';
      }
      const { data: publicUrlData } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(`ledger_${fileName}`);
      return publicUrlData.publicUrl;
    }

    // Return the persistent relative path within the private bucket
    return data.path;
  } catch (err) {
    console.error('[STORAGE] Error uploading ledger photo proof:', err);
    return '';
  }
};

/**
 * Generates an authenticated signed URL for private ledger proof photos.
 * Preserves 100% backward compatibility for:
 * - Data URLs (data:image/...)
 * - Blob URLs (blob:...)
 * - Legacy public Supabase URLs (https://.../storage/v1/object/public/ledger_photos/...)
 * - Legacy signed Supabase URLs (https://.../storage/v1/object/sign/ledger_photos/...)
 * - Non-ledger external or shop-assets URLs
 * - Relative paths (${shopId}/ledger_....jpg)
 */
export const getLedgerPhotoSignedUrl = async (
  rawUrlOrPath: string,
  expiresInSeconds: number = 86400
): Promise<string> => {
  if (!rawUrlOrPath || typeof rawUrlOrPath !== 'string') return '';

  const clean = rawUrlOrPath.trim();
  if (!clean) return '';

  // 1. Data URLs or local blob URLs: return immediately
  if (clean.startsWith('data:') || clean.startsWith('blob:')) {
    return clean;
  }

  // 2. If Supabase is not configured, return as is
  if (!isSupabaseConfigured || !supabase) {
    return clean;
  }

  try {
    let objectPath = clean;

    const publicPrefix = '/storage/v1/object/public/ledger_photos/';
    const signPrefix = '/storage/v1/object/sign/ledger_photos/';

    if (objectPath.includes(publicPrefix)) {
      objectPath = objectPath.split(publicPrefix)[1];
    } else if (objectPath.includes(signPrefix)) {
      objectPath = objectPath.split(signPrefix)[1].split('?')[0];
    } else if (objectPath.startsWith('ledger_photos/')) {
      objectPath = objectPath.replace(/^ledger_photos\//, '');
    }

    // If it's a URL to shop-assets or another external host (not ledger_photos), return as is
    if (objectPath.startsWith('http://') || objectPath.startsWith('https://')) {
      return objectPath;
    }

    // Clean any leading slash
    objectPath = objectPath.replace(/^\/+/, '');

    const { data, error } = await supabase.storage
      .from('ledger_photos')
      .createSignedUrl(objectPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.warn('[STORAGE] createSignedUrl failed for ledger proof:', error?.message);
      return clean;
    }

    return data.signedUrl;
  } catch (err) {
    console.warn('[STORAGE] Exception in getLedgerPhotoSignedUrl:', err);
    return clean;
  }
};
