import { supabase, isSupabaseConfigured } from './supabase';
import { Customer, Shop } from '../types';

export type DeliveryMode = 'manual_share' | 'meta_cloud_api';
export type RecipientStatus = 'pending' | 'opened_for_manual_share' | 'shared_manually' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped';
export type CampaignStatus = 'draft' | 'ready' | 'manual_in_progress' | 'completed_manually' | 'sending_api' | 'completed_api' | 'cancelled';

export interface CampaignRecord {
  id: string;
  shop_id: string;
  created_by?: string;
  title: string;
  message: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'pdf' | null;
  delivery_mode: DeliveryMode;
  status: CampaignStatus;
  recipient_count: number;
  shared_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  scheduled_at?: string | null;
  completed_at?: string | null;
}

export interface CampaignRecipientRecord {
  id: string;
  campaign_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  due_amount: number;
  status: RecipientStatus;
  provider?: DeliveryMode;
  provider_message_id?: string | null;
  provider_status?: string | null;
  provider_error_code?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
}

const STORAGE_KEY_CAMPAIGNS = 'smart_khata_campaigns_history';
const STORAGE_KEY_RECIPIENTS = 'smart_khata_campaign_recipients';

export const CampaignService = {
  /**
   * Fetch all campaigns for a specific shop
   */
  async getCampaigns(shopId: string): Promise<CampaignRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false });

        if (!error && data) return data as CampaignRecord[];
      } catch (err) {
        console.warn('[CAMPAIGN SERVICE] Supabase campaigns fetch error, falling back to storage:', err);
      }
    }

    // LocalStorage Fallback
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_CAMPAIGNS}_${shopId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return [];
  },

  /**
   * Save or create a new campaign
   */
  async saveCampaign(campaign: CampaignRecord, recipients: CampaignRecipientRecord[]): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaigns').upsert(campaign);
        if (recipients.length > 0) {
          await supabase.from('campaign_recipients').upsert(recipients);
        }
      } catch (err) {
        console.warn('[CAMPAIGN SERVICE] Error persisting campaign to Supabase:', err);
      }
    }

    // Always update local storage cache for offline/instant UI responsiveness
    try {
      const shopId = campaign.shop_id;
      const existing = await this.getCampaigns(shopId);
      const updated = [campaign, ...existing.filter((c) => c.id !== campaign.id)];
      localStorage.setItem(`${STORAGE_KEY_CAMPAIGNS}_${shopId}`, JSON.stringify(updated));

      const existingRecipientsRaw = localStorage.getItem(`${STORAGE_KEY_RECIPIENTS}_${campaign.id}`);
      const existingRecipients: CampaignRecipientRecord[] = existingRecipientsRaw ? JSON.parse(existingRecipientsRaw) : [];
      const mergedRecipients = [...recipients, ...existingRecipients.filter((r) => !recipients.some((nr) => nr.id === r.id))];
      localStorage.setItem(`${STORAGE_KEY_RECIPIENTS}_${campaign.id}`, JSON.stringify(mergedRecipients));
    } catch (err) {
      console.warn('[CAMPAIGN SERVICE] LocalStorage save exception:', err);
    }
  },

  /**
   * Fetch recipients for a specific campaign
   */
  async getCampaignRecipients(campaignId: string): Promise<CampaignRecipientRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('campaign_recipients')
          .select('*')
          .eq('campaign_id', campaignId);

        if (!error && data) return data as CampaignRecipientRecord[];
      } catch (err) {
        console.warn('[CAMPAIGN SERVICE] Error fetching recipients from Supabase:', err);
      }
    }

    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_RECIPIENTS}_${campaignId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return [];
  },

  /**
   * Update status of an individual campaign recipient (e.g. after manual share)
   */
  async updateRecipientStatus(
    campaignId: string,
    recipientId: string,
    status: RecipientStatus,
    providerMessageId?: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const updatePayload: Partial<CampaignRecipientRecord> = {
      status,
      provider_message_id: providerMessageId || null,
      sent_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('campaign_recipients')
          .update(updatePayload)
          .eq('id', recipientId);
      } catch (err) {
        console.warn('[CAMPAIGN SERVICE] Supabase recipient update error:', err);
      }
    }

    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_RECIPIENTS}_${campaignId}`);
      if (raw) {
        const recipients: CampaignRecipientRecord[] = JSON.parse(raw);
        const updated = recipients.map((r) => (r.id === recipientId ? { ...r, ...updatePayload } : r));
        localStorage.setItem(`${STORAGE_KEY_RECIPIENTS}_${campaignId}`, JSON.stringify(updated));
      }
    } catch {
      // Ignore
    }
  }
};
