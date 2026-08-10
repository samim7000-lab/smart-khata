import { supabase, isSupabaseConfigured } from './supabase';
import { BusinessMediaItem } from './mediaUtils';

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
}

export interface WhatsAppCompatibleAsset {
  url: string;
  file?: File;
  type: 'image' | 'video' | 'pdf';
  isBlob: boolean;
}

export class MediaService {
  /**
   * Validate media file constraints before uploading or sharing
   */
  static validate(file: File): MediaValidationResult {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    const maxSizeMB = file.type.includes('video') ? 25 : file.type.includes('pdf') ? 15 : 10;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed limit of ${maxSizeMB}MB`,
      };
    }

    const isValidType =
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      file.type === 'application/pdf';

    if (!isValidType) {
      return {
        valid: false,
        error: 'Unsupported file format. Please upload an Image, Video, or PDF.',
      };
    }

    return { valid: true };
  }

  /**
   * Upload media file to Supabase Storage or create local fallback object
   */
  static async upload(
    file: File,
    shopId: string,
    title: string,
    category: BusinessMediaItem['category']
  ): Promise<BusinessMediaItem> {
    const validation = this.validate(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file');
    }

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

        return {
          id: `media-${Date.now()}`,
          shop_id: shopId,
          title,
          category,
          media_url: urlData.publicUrl,
          file_type: fileType,
          file_size_bytes: file.size,
          created_at: new Date().toISOString(),
          file,
        };
      } catch (err: any) {
        console.warn('[MEDIA SERVICE] Storage upload fallback to local file:', err);
      }
    }

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
      file,
    };
  }

  /**
   * Get preview URL for UI rendering
   */
  static getPreview(item: BusinessMediaItem): string {
    return item.media_url;
  }

  /**
   * Resolve WhatsApp delivery asset (ensures file object and safe URL resolution)
   */
  static getWhatsAppCompatibleAsset(item: BusinessMediaItem): WhatsAppCompatibleAsset {
    const isBlob = item.media_url.startsWith('blob:');
    return {
      url: item.media_url,
      file: item.file,
      type: item.file_type,
      isBlob,
    };
  }
}
