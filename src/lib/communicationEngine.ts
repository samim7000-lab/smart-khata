import { Customer, Shop } from '../types';
import { formatShopCurrency } from './countryPricing';
import { MetaCloudApiService } from './metaCloudApi';
import { formatWhatsAppNumber } from './whatsappUtils';

export interface DispatchMessagePayload {
  recipient: Customer;
  shop: Shop;
  rawText: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'pdf' | null;
  mediaFile?: File | null;
  campaignId?: string;
}

export interface DispatchResult {
  success: boolean;
  messageId: string;
  provider: 'manual_share' | 'meta_cloud_api';
  status: 'Prepared' | 'Opened' | 'Shared Manually' | 'Cancelled' | 'Failed';
  dispatchedAt: string;
  formattedText: string;
  error?: string;
}

/**
 * Universal Delivery Provider Interface
 * Mode A: Manual / Official-Compatible WhatsApp Sharing
 * Mode B: Meta WhatsApp Business Cloud API (Future Automation Ready)
 */
export interface IDeliveryProvider {
  name: string;
  type: 'manual_share' | 'meta_cloud_api';
  dispatch(payload: DispatchMessagePayload): Promise<DispatchResult>;
}

/**
 * Parse dynamic message variables from real customer/shop data
 */
export function replaceMessageVariables(
  template: string,
  customer: Customer,
  shop: Shop,
  customVars?: Record<string, string>
): string {
  const custName = customer.display_label || customer.name || 'Valued Customer';
  const shopName = shop?.shop_name || 'Smart Khata Store';
  const ownerName = shop?.owner_name || 'Store Owner';
  const dueAmt = customer.balance && customer.balance > 0 ? customer.balance : 0;
  const formattedDue = formatShopCurrency(dueAmt, shop?.country, shop?.currency_code);
  const todayStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const shopAddr = shop?.full_address || shop?.city || shop?.state || '';

  let res = template
    .replace(/{{?customer_name}}?/gi, custName)
    .replace(/{{?customerName}}?/g, custName)
    .replace(/{{?store_name}}?/gi, shopName)
    .replace(/{{?shop_name}}?/gi, shopName)
    .replace(/{{?shopName}}?/g, shopName)
    .replace(/{{?owner_name}}?/gi, ownerName)
    .replace(/{{?ownerName}}?/g, ownerName)
    .replace(/{{?due_amount}}?/gi, formattedDue)
    .replace(/{{?amount_due}}?/gi, formattedDue)
    .replace(/{{?dueAmount}}?/g, formattedDue)
    .replace(/{{?phone}}?/gi, customer.phone_number || '')
    .replace(/{{?payment_link}}?/gi, 'https://smartkhata.app/pay')
    .replace(/{{?today}}?/gi, todayStr)
    .replace(/{{?invoice_ref}}?/gi, `INV-${Date.now().toString().slice(-6)}`)
    .replace(/{{?invoice_number}}?/gi, `INV-${Date.now().toString().slice(-6)}`)
    .replace(/{{?shop_address}}?/gi, shopAddr)
    .replace(/{{?shopAddress}}?/g, shopAddr);

  if (customVars) {
    Object.entries(customVars).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        const regex = new RegExp(`{{?${k}}}?`, 'gi');
        res = res.replace(regex, v);
      }
    });
  }

  // Gracefully clean up any unreplaced {{variable}} or {variable} tags so broken placeholders never appear
  return res.replace(/{{?[a-zA-Z0-9_]+}}?/g, '').trim();
}

/**
 * Mode A Provider: Manual / Official-Compatible WhatsApp Sharing (100% Policy Compliant)
 * Status is explicitly tracked as Opened / Shared Manually. Never claims fake automated delivery.
 */
export class WhatsAppDirectLinkProvider implements IDeliveryProvider {
  name = 'Manual / Official WhatsApp Share';
  type = 'manual_share' as const;

  async dispatch(payload: DispatchMessagePayload): Promise<DispatchResult> {
    const formattedText = replaceMessageVariables(payload.rawText, payload.recipient, payload.shop);

    // 1. Check Web Share API with files if media file is attached (Mobile Chrome / Safari)
    if (payload.mediaFile && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const canShareFiles = navigator.canShare({ files: [payload.mediaFile] });
        if (canShareFiles) {
          console.log('[WHATSAPP DISPATCH] Web Share API file attachment supported. Triggering native share sheet...');
          await navigator.share({
            files: [payload.mediaFile],
            text: formattedText,
          });

          return {
            success: true,
            messageId: `manual-${Date.now()}`,
            provider: 'manual_share',
            status: 'Shared Manually',
            dispatchedAt: new Date().toISOString(),
            formattedText,
          };
        }
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          console.log('[WHATSAPP DISPATCH] Native share sheet dismissed by merchant');
          return {
            success: false,
            messageId: `manual-${Date.now()}`,
            provider: 'manual_share',
            status: 'Cancelled',
            dispatchedAt: new Date().toISOString(),
            formattedText,
            error: 'User cancelled share dialog',
          };
        }
        console.warn('[WHATSAPP DISPATCH] Native file share error, falling back to direct link:', shareErr);
      }
    }

    // 2. Direct WhatsApp Web / Mobile App URL Launch
    let fullText = '';
    if (payload.mediaUrl && !payload.mediaUrl.startsWith('blob:')) {
      fullText = `📄 Attached Media: ${payload.mediaUrl}\n\n${formattedText}`;
    } else {
      fullText = formattedText;
    }

    const cleanPhone = formatWhatsAppNumber(payload.recipient.phone_number, payload.shop?.country);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullText)}`;

    window.open(url, '_blank');

    return {
      success: true,
      messageId: `manual-${Date.now()}`,
      provider: 'manual_share',
      status: 'Opened',
      dispatchedAt: new Date().toISOString(),
      formattedText,
    };
  }
}

/**
 * Mode B Provider: Meta WhatsApp Business Cloud API (Official Integration)
 * Fallback to Mode A Manual Share if disconnected or unconfigured.
 */
export class MetaCloudApiProvider implements IDeliveryProvider {
  name = 'Official Meta WhatsApp Cloud API';
  type = 'meta_cloud_api' as const;

  private apiKey?: string;
  private phoneNumberId?: string;

  constructor(apiKey?: string, phoneNumberId?: string) {
    this.apiKey = apiKey;
    this.phoneNumberId = phoneNumberId;
  }

  async dispatch(payload: DispatchMessagePayload): Promise<DispatchResult> {
    const formattedText = replaceMessageVariables(payload.rawText, payload.recipient, payload.shop);

    const conn = await MetaCloudApiService.getConnection(payload.shop.id);
    if (!conn || conn.status !== 'CONNECTED') {
      console.log('[META CLOUD API] Connection not active. Falling back to Mode A Manual Share...');
      const fallback = new WhatsAppDirectLinkProvider();
      return fallback.dispatch(payload);
    }

    try {
      console.log(`[META CLOUD API] Dispatching official message to ${payload.recipient.phone_number}`);
      const res = await MetaCloudApiService.sendMessage({
        shop: payload.shop,
        recipient: payload.recipient,
        templateName: 'payment_reminder',
        messageText: formattedText,
        mediaUrl: payload.mediaUrl,
      });

      if (res.success) {
        return {
          success: true,
          messageId: res.metaMessageId || `meta-${Date.now()}`,
          provider: 'meta_cloud_api',
          status: 'Shared Manually',
          dispatchedAt: new Date().toISOString(),
          formattedText,
        };
      } else {
        throw new Error(res.error || 'Meta Cloud API dispatch failed');
      }
    } catch (err: any) {
      return {
        success: false,
        messageId: `err-${Date.now()}`,
        provider: 'meta_cloud_api',
        status: 'Failed',
        dispatchedAt: new Date().toISOString(),
        formattedText,
        error: err.message || 'Meta Cloud API dispatch failed',
      };
    }
  }
}
