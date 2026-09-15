import { COUNTRIES } from '../data/countries';
import { Customer, Language, Shop, Transaction, ReceiptDetailsPayload } from '../types';
import { formatShopCurrency } from './countryPricing';
import { MetaCloudApiService } from './metaCloudApi';
import { EMIInstallmentDB, EMIAccountDB } from './emiService';
import { replaceMessageVariables } from './communicationEngine';

export type WhatsAppMessageType =
  | 'RECEIPT'
  | 'PAYMENT_RECEIVED'
  | 'DUE_REMINDER'
  | 'EMI_REMINDER'
  | 'CAMPAIGN'
  | 'CUSTOMER_GREETING'
  | 'CUSTOM';

export interface WhatsAppMessageOptions {
  type: WhatsAppMessageType;
  customer: Customer;
  shop: Shop;
  language: Language;

  // Context-specific optional fields
  transaction?: Transaction;
  receiptDetails?: ReceiptDetailsPayload | null;
  dueAmount?: number;
  paidAmount?: number;
  emiInstallment?: EMIInstallmentDB;
  emiAccount?: EMIAccountDB;
  campaignText?: string;
  customText?: string;
  mediaFile?: File | null;
  mediaUrl?: string | null;
}

export interface WhatsAppSendResult {
  success: boolean;
  action: 'opened_chat' | 'native_shared' | 'meta_cloud_sent' | 'cancelled' | 'failed';
  statusMessage: string;
  cleanPhone: string;
  chatUrl?: string;
  formattedMessage: string;
  error?: string;
}

/**
 * 1. UNIFIED PHONE NORMALIZATION
 * Formats any raw mobile number string into a clean, normalized WhatsApp-ready string of digits.
 * Guaranteed to produce digits-only string without '+' or spaces, avoiding duplicate country calling codes.
 */
export function normalizeWhatsAppPhone(rawPhone: string, defaultCountryCode: string = 'IN'): string {
  if (!rawPhone) return '';
  const trimmed = rawPhone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) return '';

  // 1. Explicitly check if number begins with known country prefixes
  // India (+91 or 91 with 12 digits)
  if (trimmed.startsWith('+91') || (digitsOnly.length === 12 && digitsOnly.startsWith('91'))) {
    return digitsOnly;
  }

  // Bangladesh (+880 or 880 with 13 digits)
  if (trimmed.startsWith('+880') || (digitsOnly.length === 13 && digitsOnly.startsWith('880'))) {
    return digitsOnly;
  }

  // 2. India-specific 10 digits starting with 6-9
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return '91' + digitsOnly;
  }

  // 3. Bangladesh-specific 11 digits starting with 01
  if (digitsOnly.length === 11 && digitsOnly.startsWith('01')) {
    return '88' + digitsOnly;
  }

  // 4. Resolve default country from catalog
  const targetCountry =
    COUNTRIES.find((c) => c.code === defaultCountryCode) ||
    COUNTRIES.find((c) => c.code === 'IN') ||
    COUNTRIES[0];
  const callingDigits = (targetCountry?.callingCode || '+91').replace(/\D/g, '');

  if (digitsOnly.startsWith(callingDigits)) {
    return digitsOnly;
  }

  const strippedLeadingZero = digitsOnly.replace(/^0+/, '');
  return `${callingDigits}${strippedLeadingZero}`;
}

/**
 * 2. PHONE VALIDATION
 */
export function validateCustomerPhone(
  phone: string | undefined | null,
  defaultCountryCode: string = 'IN',
  language: Language = 'en'
): { isValid: boolean; cleanPhone: string; errorMsg?: string } {
  if (!phone || !phone.trim()) {
    const errorMsg =
      language === 'bn'
        ? 'কাস্টমারের ফোন নম্বর পাওয়া যায়নি।'
        : language === 'hi'
        ? 'ग्राहक का फोन नंबर नहीं मिला।'
        : 'Customer phone number is missing.';
    return { isValid: false, cleanPhone: '', errorMsg };
  }

  const cleanPhone = normalizeWhatsAppPhone(phone, defaultCountryCode);
  if (cleanPhone.length < 9 || cleanPhone.length > 15) {
    const errorMsg =
      language === 'bn'
        ? 'সঠিক মোবাইল নম্বর দিন।'
        : language === 'hi'
        ? 'कृपया एक वैध मोबाइल नंबर दर्ज करें।'
        : 'Please enter a valid mobile number.';
    return { isValid: false, cleanPhone, errorMsg };
  }

  return { isValid: true, cleanPhone };
}

/**
 * 3. WHATSAPP DIRECT CHAT DEEP-LINK URL GENERATOR
 * Concepts: https://wa.me/<normalized_number>?text=<encoded_text>
 * Direct handoff opens WhatsApp directly even if the customer is NOT in phone contacts
 * and whether or not a previous chat exists.
 */
export function getWhatsAppChatUrl(phone: string, text: string, defaultCountryCode: string = 'IN'): string {
  const cleanPhone = normalizeWhatsAppPhone(phone, defaultCountryCode);
  if (!cleanPhone) {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * 4. CENTRALIZED, RELIGION-NEUTRAL MESSAGE GENERATOR
 * Builds natural, professional WhatsApp messages in the selected application language.
 */
export function buildWhatsAppMessage(options: WhatsAppMessageOptions): string {
  const { type, customer, shop, language } = options;
  const custName = customer.display_label || customer.name || 'Customer';
  const shopName = shop?.shop_name || 'Store';
  const ownerName = shop?.owner_name || '';
  const shopPhone = shop?.phone || shop?.whatsapp_number || '';
  const shopAddress = shop?.full_address || [shop?.city, shop?.state, shop?.postal_code].filter(Boolean).join(', ');
  const todayStr = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  switch (type) {
    case 'RECEIPT': {
      const tx = options.transaction;
      const details = options.receiptDetails;
      const receiptNo = details?.receipt_number || (tx ? `INV-${tx.id.slice(-6).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
      const txAmt = tx ? Number(tx.amount) : (details?.paid_amount || details?.subtotal || 0);
      const isCredit = tx?.type === 'credit_given' || details?.mode === 'credit_sale';
      const typeLabel = isCredit
        ? (language === 'bn' ? 'বাকি বিক্রয়' : language === 'hi' ? 'उधार बिक्री' : 'Due Sale')
        : (language === 'bn' ? 'নগদ বিক্রয়' : language === 'hi' ? 'नकद बिक्री' : 'Cash Sale');

      const prevBal = details?.previous_balance !== undefined ? details.previous_balance : (customer.balance || 0);
      const currentBal = customer.balance !== undefined ? customer.balance : prevBal;

      if (language === 'bn') {
        return (
          `🧾 *${shopName.toUpperCase()}*\n` +
          `${shopAddress ? `ঠিকানা: ${shopAddress}\n` : ''}` +
          `${ownerName ? `প্রোপ্রাইটার: ${ownerName}\n` : ''}` +
          `${shopPhone ? `মোবাইল: ${shopPhone}\n` : ''}` +
          `----------------------------\n` +
          `📄 *রসিদ নং:* ${receiptNo}\n` +
          `📅 *তারিখ:* ${todayStr}\n` +
          `----------------------------\n` +
          `👤 *কাস্টমার:* ${custName}\n` +
          `📱 *মোবাইল:* ${customer.phone_number || 'N/A'}\n` +
          `----------------------------\n` +
          `💰 *${typeLabel}:* ${formatShopCurrency(txAmt, shop.country, shop.currency_code)}\n` +
          `${prevBal > 0 ? `🔴 *পূর্বের বাকি:* ${formatShopCurrency(prevBal, shop.country, shop.currency_code)}\n` : ''}` +
          `🔴 *বর্তমান মোট বাকি:* ${formatShopCurrency(currentBal, shop.country, shop.currency_code)}\n` +
          `----------------------------\n` +
          `আমাদের সাথে কেনাকাটা করার জন্য ধন্যবাদ! — ${shopName}`
        );
      } else if (language === 'hi') {
        return (
          `🧾 *${shopName.toUpperCase()}*\n` +
          `${shopAddress ? `पता: ${shopAddress}\n` : ''}` +
          `${ownerName ? `मालिक: ${ownerName}\n` : ''}` +
          `${shopPhone ? `फोन: ${shopPhone}\n` : ''}` +
          `----------------------------\n` +
          `📄 *रसीद सं.:* ${receiptNo}\n` +
          `📅 *तिथि:* ${todayStr}\n` +
          `----------------------------\n` +
          `👤 *ग्राहक:* ${custName}\n` +
          `📱 *मोबाइल:* ${customer.phone_number || 'N/A'}\n` +
          `----------------------------\n` +
          `💰 *${typeLabel}:* ${formatShopCurrency(txAmt, shop.country, shop.currency_code)}\n` +
          `${prevBal > 0 ? `🔴 *पिछला बकाया:* ${formatShopCurrency(prevBal, shop.country, shop.currency_code)}\n` : ''}` +
          `🔴 *वर्तमान कुल बकाया:* ${formatShopCurrency(currentBal, shop.country, shop.currency_code)}\n` +
          `----------------------------\n` +
          `हमारे साथ व्यापार करने के लिए धन्यवाद! — ${shopName}`
        );
      } else {
        return (
          `🧾 *${shopName.toUpperCase()}*\n` +
          `${shopAddress ? `Address: ${shopAddress}\n` : ''}` +
          `${ownerName ? `Owner: ${ownerName}\n` : ''}` +
          `${shopPhone ? `Phone: ${shopPhone}\n` : ''}` +
          `----------------------------\n` +
          `📄 *RECEIPT NO:* ${receiptNo}\n` +
          `📅 *Date:* ${todayStr}\n` +
          `----------------------------\n` +
          `👤 *CUSTOMER:* ${custName}\n` +
          `📱 *Mobile:* ${customer.phone_number || 'N/A'}\n` +
          `----------------------------\n` +
          `💰 *${typeLabel.toUpperCase()}:* ${formatShopCurrency(txAmt, shop.country, shop.currency_code)}\n` +
          `${prevBal > 0 ? `🔴 *Previous Due:* ${formatShopCurrency(prevBal, shop.country, shop.currency_code)}\n` : ''}` +
          `🔴 *Total Outstanding Due:* ${formatShopCurrency(currentBal, shop.country, shop.currency_code)}\n` +
          `----------------------------\n` +
          `Thank you for your business! — ${shopName}`
        );
      }
    }

    case 'PAYMENT_RECEIVED': {
      const paidAmt = options.paidAmount || (options.transaction ? Number(options.transaction.amount) : 0);
      const remaining = options.dueAmount !== undefined ? options.dueAmount : Math.max(0, (customer.balance || 0));

      if (language === 'bn') {
        return (
          `✅ *পেমেন্ট প্রাপ্তি স্বীকার — ${shopName}*\n\n` +
          `হ্যালো ${custName},\n` +
          `আপনার থেকে ${formatShopCurrency(paidAmt, shop.country, shop.currency_code)} পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে।\n\n` +
          `📅 তারিখ: ${todayStr}\n` +
          `🔴 বর্তমান বাকি: ${formatShopCurrency(remaining, shop.country, shop.currency_code)}\n\n` +
          `ধন্যবাদ!\n${shopName}`
        );
      } else if (language === 'hi') {
        return (
          `✅ *भुगतान पावती — ${shopName}*\n\n` +
          `नमस्ते ${custName},\n` +
          `आपका ${formatShopCurrency(paidAmt, shop.country, shop.currency_code)} का भुगतान सफलतापूर्वक प्राप्त हुआ।\n\n` +
          `📅 तिथि: ${todayStr}\n` +
          `🔴 वर्तमान बकाया: ${formatShopCurrency(remaining, shop.country, shop.currency_code)}\n\n` +
          `धन्यवाद!\n${shopName}`
        );
      } else {
        return (
          `✅ *Payment Received — ${shopName}*\n\n` +
          `Hello ${custName},\n` +
          `We have successfully received your payment of ${formatShopCurrency(paidAmt, shop.country, shop.currency_code)}.\n\n` +
          `📅 Date: ${todayStr}\n` +
          `🔴 Remaining Due: ${formatShopCurrency(remaining, shop.country, shop.currency_code)}\n\n` +
          `Thank you!\n${shopName}`
        );
      }
    }

    case 'DUE_REMINDER': {
      const due = options.dueAmount !== undefined ? options.dueAmount : (customer.balance || 0);
      const formattedDue = formatShopCurrency(due, shop.country, shop.currency_code);

      if (language === 'bn') {
        return (
          `হ্যালো ${custName},\n\n` +
          `${shopName} থেকে বকেয়া পরিশোধের বিনীত অনুরোধ। ` +
          `${todayStr} তারিখ পর্যন্ত আপনার মোট বাকি টাকার পরিমাণ ${formattedDue}।\n\n` +
          `অনুগ্রহ করে সুবিধামতো পরিশোধ করে দিন।\n` +
          `${shopAddress ? `দোকানের ঠিকানা: ${shopAddress}\n` : ''}` +
          `\nধন্যবাদ!\n${shopName}`
        );
      } else if (language === 'hi') {
        return (
          `नमस्ते ${custName},\n\n` +
          `${shopName} से बकाया भुगतान का विनम्र निवेदन। ` +
          `${todayStr} तक आपकी कुल बकाया राशि ${formattedDue} है।\n\n` +
          `कृपया अपनी सुविधानुसार भुगतान करें।\n` +
          `${shopAddress ? `दुकान का पता: ${shopAddress}\n` : ''}` +
          `\nधन्यवाद!\n${shopName}`
        );
      } else {
        return (
          `Hello ${custName},\n\n` +
          `This is a friendly payment reminder from ${shopName}. ` +
          `Your outstanding balance is ${formattedDue} as of ${todayStr}.\n\n` +
          `Please clear it at your earliest convenience.\n` +
          `${shopAddress ? `Store Address: ${shopAddress}\n` : ''}` +
          `\nThank you!\n${shopName}`
        );
      }
    }

    case 'EMI_REMINDER': {
      const inst = options.emiInstallment;
      const acc = options.emiAccount;
      const emiNum = inst?.installment_number || 1;
      const emiTotal = acc?.installment_count || 1;
      const emiAmt = inst ? Math.max((Number(inst.amount) || 0) - (Number(inst.paid_amount) || 0), 0) : 0;
      const dueDate = inst?.due_date || todayStr;
      const productName = acc?.product_name || 'Item';

      if (language === 'bn') {
        return (
          `হ্যালো ${custName},\n\n` +
          `${shopName} থেকে কিস্তি পরিশোধের বিনীত অনুরোধ:\n` +
          `পণ্য: ${productName}\n` +
          `কিস্তি নং: ${emiNum} / ${emiTotal}\n` +
          `কিস্তির পরিমাণ: ${formatShopCurrency(emiAmt, shop.country, shop.currency_code)}\n` +
          `পরিশোধের শেষ তারিখ: ${dueDate}\n\n` +
          `অনুগ্রহ করে নির্দিষ্ট সময়ের মধ্যে কিস্তি জমা দিন।\n` +
          `ধন্যবাদ!\n${shopName}`
        );
      } else if (language === 'hi') {
        return (
          `नमस्ते ${custName},\n\n` +
          `${shopName} से किश्त भुगतान का विनम्र निवेदन:\n` +
          `उत्पाद: ${productName}\n` +
          `किश्त सं.: ${emiNum} / ${emiTotal}\n` +
          `किश्त राशि: ${formatShopCurrency(emiAmt, shop.country, shop.currency_code)}\n` +
          `देय तिथि: ${dueDate}\n\n` +
          `कृपया समय पर अपनी किश्त का भुगतान करें।\n` +
          `धन्यवाद!\n${shopName}`
        );
      } else {
        return (
          `Hello ${custName},\n\n` +
          `Friendly installment reminder from ${shopName}:\n` +
          `Product: ${productName}\n` +
          `Installment: #${emiNum} of ${emiTotal}\n` +
          `Amount Due: ${formatShopCurrency(emiAmt, shop.country, shop.currency_code)}\n` +
          `Due Date: ${dueDate}\n\n` +
          `Please ensure timely installment clearance.\n` +
          `Thank you!\n${shopName}`
        );
      }
    }

    case 'CAMPAIGN': {
      if (options.campaignText) {
        return replaceMessageVariables(options.campaignText, customer, shop);
      }
      return `Hello ${custName}, greetings from ${shopName}!`;
    }

    case 'CUSTOMER_GREETING': {
      if (language === 'bn') {
        return `হ্যালো ${custName},\n\n${shopName}-এ যোগাযোগ করার জন্য ধন্যবাদ। কোনো পণ্য বা সেবার তথ্য জানতে আমাদের মেসেজ দিন।`;
      } else if (language === 'hi') {
        return `नमस्ते ${custName},\n\n${shopName} से संपर्क करने के लिए धन्यवाद। किसी भी पूछताछ के लिए बेझिझक संदेश भेजें।`;
      } else {
        return `Hello ${custName},\n\nThank you for connecting with ${shopName}. Please let us know if you need any assistance with products or orders.`;
      }
    }

    case 'CUSTOM':
    default: {
      return options.customText || `Hello ${custName}, from ${shopName}.`;
    }
  }
}

/**
 * 5. UNIFIED DISPATCH SERVICE
 * The single canonical execution path for sending or opening WhatsApp for any customer.
 * - Resolves customer phone
 * - Normalizes and validates phone
 * - Generates language-aware message
 * - Dispatches via native Web Share API (if media file present), official Meta Cloud API (if configured),
 *   or direct wa.me deep-link handoff.
 * - Returns honest status: NEVER claims "Message sent" for deep link handoff.
 */
export async function dispatchWhatsApp(options: WhatsAppMessageOptions): Promise<WhatsAppSendResult> {
  const { customer, shop, language } = options;
  const defaultCountry = shop?.country || 'IN';

  // 1. Phone validation
  const valResult = validateCustomerPhone(customer.phone_number, defaultCountry, language);
  if (!valResult.isValid) {
    return {
      success: false,
      action: 'failed',
      statusMessage: valResult.errorMsg || 'Invalid phone number',
      cleanPhone: '',
      formattedMessage: '',
      error: valResult.errorMsg,
    };
  }

  const cleanPhone = valResult.cleanPhone;
  const formattedMessage = buildWhatsAppMessage(options);

  // 2. Check Official Meta Cloud API (if enabled and connected)
  try {
    const conn = await MetaCloudApiService.getConnection(shop.id);
    if (conn && conn.status === 'CONNECTED') {
      console.log(`[WHATSAPP-SERVICE] Meta Cloud API is CONNECTED. Dispatching official message to ${cleanPhone}`);
      const apiRes = await MetaCloudApiService.sendMessage({
        shop,
        recipient: customer,
        templateName: options.type === 'RECEIPT' ? 'receipt_notification' : 'payment_reminder',
        messageText: formattedMessage,
        mediaUrl: options.mediaUrl || undefined,
      });

      if (apiRes.success) {
        return {
          success: true,
          action: 'meta_cloud_sent',
          statusMessage: language === 'bn' ? 'বার্তা পাঠানো হয়েছে (Official Meta API)' : 'Message sent via Official Meta API',
          cleanPhone,
          formattedMessage,
        };
      }
      console.warn('[WHATSAPP-SERVICE] Meta Cloud API call returned error, falling back to direct chat deep-link:', apiRes.error);
    }
  } catch (cloudErr) {
    console.warn('[WHATSAPP-SERVICE] Meta Cloud API check failed, falling back to deep-link:', cloudErr);
  }

  // 3. Web Share API with File Attachment (Mobile Safari / Chrome)
  if (options.mediaFile && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const canShareFiles = navigator.canShare({ files: [options.mediaFile] });
      if (canShareFiles) {
        console.log('[WHATSAPP-SERVICE] Web Share API file attachment supported. Triggering native share sheet...');
        await navigator.share({
          title: `${shop.shop_name} Receipt`,
          text: formattedMessage,
          files: [options.mediaFile],
        });

        return {
          success: true,
          action: 'native_shared',
          statusMessage: language === 'bn' ? 'শেয়ার উইন্ডো খোলা হয়েছে' : 'Shared via device sheet',
          cleanPhone,
          formattedMessage,
        };
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        return {
          success: false,
          action: 'cancelled',
          statusMessage: language === 'bn' ? 'বাতিল করা হয়েছে' : 'Share cancelled by merchant',
          cleanPhone,
          formattedMessage,
        };
      }
      console.warn('[WHATSAPP-SERVICE] Web Share error, falling back to direct wa.me link:', shareErr);
    }
  }

  // 4. Standard Direct Deep-Link WhatsApp Launch
  // Open direct chat for the customer number without requiring contact to be saved in phone address book.
  const chatUrl = getWhatsAppChatUrl(cleanPhone, formattedMessage, defaultCountry);

  if (typeof window !== 'undefined') {
    window.open(chatUrl, '_blank');
  }

  return {
    success: true,
    action: 'opened_chat',
    statusMessage:
      language === 'bn'
        ? 'হোয়াটসঅ্যাপ খোলা হয়েছে! চ্যাটে সেন্ড বাটনে চাপ দিন।'
        : language === 'hi'
        ? 'व्हाट्सएप खुल गया! कृपया चैट में सेंड बटन दबाएं।'
        : 'WhatsApp opened! Please tap Send inside chat.',
    cleanPhone,
    chatUrl,
    formattedMessage,
  };
}

/**
 * 6. CONTACT VCARD (.vcf) EXPORT UTILITY
 * Generates an RFC 6350 compliant vCard so merchants can optionally export contacts to their device.
 * WhatsApp messaging never depends on this.
 */
export function generateVCard(customer: Customer, shop?: Shop): void {
  const cleanPhone = customer.phone_number || '';
  const fullName = customer.display_label || customer.name || 'Customer';
  const orgName = shop?.shop_name ? `${shop.shop_name} Customer` : 'Smart Khata';

  const vCardContent = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fullName}`,
    `N:;${fullName};;;`,
    `TEL;TYPE=CELL,VOICE:${cleanPhone}`,
    `ORG:${orgName}`,
    customer.address ? `ADR;TYPE=HOME:;;${customer.address};;;;` : '',
    'NOTE:Saved from Smart Khata Digital Ledger',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([vCardContent], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fullName.replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
