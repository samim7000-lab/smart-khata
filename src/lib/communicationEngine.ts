import { Customer, Shop } from '../types';
import { formatShopCurrency } from './countryPricing';
import { MetaCloudApiService } from './metaCloudApi';

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
  const dueAmt = customer.balance && customer.balance > 0 ? customer.balance : 0;
  const formattedDue = formatShopCurrency(dueAmt, shop?.country, shop?.currency_code);
  const todayStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return template
    .replace(/{{customer_name}}/g, customer.display_label || customer.name || 'Valued Customer')
    .replace(/{customer_name}/g, customer.display_label || customer.name || 'Valued Customer')
    .replace(/{{store_name}}/g, shop.shop_name || 'Smart Khata Store')
    .replace(/{shop_name}/g, shop.shop_name || 'Smart Khata Store')
    .replace(/{{owner_name}}/g, shop.owner_name || 'Store Owner')
    .replace(/{{due_amount}}/g, formattedDue)
    .replace(/{{amount_due}}/g, formattedDue)
    .replace(/{due_amount}/g, formattedDue)
    .replace(/{amount_due}/g, formattedDue)
    .replace(/{{phone}}/g, customer.phone_number || '')
    .replace(/{{payment_link}}/g, 'https://smartkhata.app/pay')
    .replace(/{{today}}/g, todayStr)
    .replace(/{{invoice_ref}}/g, `INV-${Date.now().toString().slice(-6)}`)
    .replace(/{{invoice_number}}/g, `INV-${Date.now().toString().slice(-6)}`)
    .replace(/{{shop_address}}/g, shop.full_address || shop.city || shop.state || 'Main Market');
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

    const cleanPhone = payload.recipient.phone_number.replace(/\D/g, '');
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
