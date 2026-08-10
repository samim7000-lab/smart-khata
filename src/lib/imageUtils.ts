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
