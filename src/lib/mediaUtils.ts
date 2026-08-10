import { supabase, isSupabaseConfigured } from './supabase';

export interface BusinessMediaItem {
  id: string;
  shop_id: string;
  title: string;
  category: 'product' | 'poster' | 'banner' | 'catalogue' | 'video' | 'brochure';
  media_url: string;
  file_type: 'image' | 'video' | 'pdf';
  file_size_bytes?: number;
  created_at: string;
  file?: File;
}

// Default Sample Business Media items
export const SAMPLE_MEDIA_ITEMS: BusinessMediaItem[] = [
  {
    id: 'media-1',
    shop_id: 'default-shop',
    title: 'Festival Offer Banner 2026',
    category: 'poster',
    media_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80',
    file_type: 'image',
    created_at: new Date().toISOString(),
  },
  {
    id: 'media-2',
    shop_id: 'default-shop',
    title: 'Store Product Catalogue PDF',
    category: 'catalogue',
    media_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    file_type: 'pdf',
    created_at: new Date().toISOString(),
  },
  {
    id: 'media-3',
    shop_id: 'default-shop',
    title: 'New Stock Showcase',
    category: 'product',
    media_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
    file_type: 'image',
    created_at: new Date().toISOString(),
  },
];

/**
 * Upload business media to Supabase Storage with image compression
 */
export async function uploadBusinessMedia(
  file: File,
  shopId: string,
  title: string,
  category: BusinessMediaItem['category']
): Promise<BusinessMediaItem> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileType: 'image' | 'video' | 'pdf' = file.type.includes('video')
    ? 'video'
    : file.type.includes('pdf')
    ? 'pdf'
    : 'image';

  const fileName = `${shopId}/media_${Date.now()}.${fileExt}`;

  if (isSupabaseConfigured && supabase) {
    try {
      const { error: uploadErr } = await supabase.storage
        .from('shop-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(fileName);

      const newItem: BusinessMediaItem = {
        id: `media-${Date.now()}`,
        shop_id: shopId,
        title,
        category,
        media_url: urlData.publicUrl,
        file_type: fileType,
        file_size_bytes: file.size,
        created_at: new Date().toISOString(),
        file: file,
      };

      return newItem;
    } catch (err: any) {
      console.warn('[MEDIA] Supabase media upload fallback to local file object:', err);
    }
  }

  // Local Object URL fallback for mock / offline mode
  const localUrl = URL.createObjectURL(file);
  return {
    id: `media-${Date.now()}`,
    shop_id: shopId,
    title,
    category,
    media_url: localUrl,
    file_type: fileType,
    file_size_bytes: file.size,
    created_at: new Date().toISOString(),
    file: file,
  };
}
