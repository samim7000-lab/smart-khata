import { COUNTRIES } from '../data/countries';
import { Customer, Language, Shop, Transaction, ReceiptDetailsPayload } from '../types';
import { formatShopCurrency } from './countryPricing';
import { MetaCloudApiService } from './metaCloudApi';
import { replaceMessageVariables } from './communicationEngine';
import { unpackReceiptNote, getCanonicalReceiptDetails, cleanNoteString } from './receiptUtils';
import { EMIInstallmentDB, EMIAccountDB } from './emiService';

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
      const details = options.receiptDetails !== undefined
        ? options.receiptDetails
        : (tx ? getCanonicalReceiptDetails(tx, customer, shop) : null);

      const receiptNo = details?.receipt_number || (tx ? `INV-${tx.id.replace(/\D/g, '').slice(-6) || tx.id.slice(-6).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
      
      const txDate = tx?.created_at ? new Date(tx.created_at) : new Date();
      const dateStr = txDate.toLocaleDateString(language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = txDate.toLocaleTimeString(language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const mode = details?.mode || (tx?.type === 'credit_given' ? 'credit_sale' : 'due_payment');
      const isPurePayment = mode === 'due_payment';
      const txAmt = tx ? Number(tx.amount) : (details?.paid_amount || details?.subtotal || 0);

      // Customer Details
      const customerAddressStr = (details?.customer_address || customer.address || customer.state || '').trim();
      const customerGstinStr = (details?.customer_gstin || customer.gstin || '').trim();

      // Items
      const items = details?.items && details.items.length > 0 ? details.items : [];

      // Subtotal & Discount
      const subtotal = details?.subtotal !== undefined ? details.subtotal : (items.length > 0 ? items.reduce((s, i) => s + i.total, 0) : txAmt);
      const discountAmt = details?.discount_amount || 0;
      const discountLabel = details?.discount_type === 'percentage' && details?.discount_value ? `${details.discount_value}%` : (language === 'bn' ? 'নির্দিষ্ট' : language === 'hi' ? 'निश्चित' : 'Fixed');

      // GST Details
      const canonicalDetails = details || (tx ? getCanonicalReceiptDetails(tx, customer, shop) : null);
      const hasGst = Boolean(canonicalDetails?.gst_enabled ?? (shop.gst_enabled && tx?.tax_amount && tx.tax_amount > 0));
      const gstRate = canonicalDetails?.gst_rate || tx?.gst_rate || shop.default_gst_rate || 18;
      const halfRate = gstRate / 2;
      const gstPriceMode = canonicalDetails?.gst_price_mode || tx?.gst_price_mode || 'inclusive';

      let cgstAmt = canonicalDetails?.cgst_amount ?? tx?.cgst_amount ?? 0;
      let sgstAmt = canonicalDetails?.sgst_amount ?? tx?.sgst_amount ?? 0;
      let igstAmt = canonicalDetails?.igst_amount ?? tx?.igst_amount ?? 0;
      const totalTax = cgstAmt + sgstAmt + igstAmt || Number(tx?.tax_amount) || 0;

      if (hasGst && totalTax > 0 && cgstAmt === 0 && sgstAmt === 0 && igstAmt === 0) {
        if (canonicalDetails?.supply_type === 'inter') {
          igstAmt = totalTax;
        } else {
          cgstAmt = Math.round((totalTax / 2) * 100) / 100;
          sgstAmt = Math.round((totalTax - cgstAmt) * 100) / 100;
        }
      }

      const taxableBase = canonicalDetails?.taxable_amount !== undefined
        ? canonicalDetails.taxable_amount
        : (hasGst && gstPriceMode === 'inclusive' && totalTax > 0
            ? Math.round((txAmt - totalTax) * 100) / 100
            : Math.max(0, subtotal - discountAmt));

      // Balances
      const prevBal = details?.previous_balance !== undefined ? details.previous_balance : (customer.balance || 0);
      let currentBal = 0;
      if (mode === 'cash_sale') {
        currentBal = Math.max(0, prevBal);
      } else if (mode === 'credit_sale') {
        const newDue = details?.new_due_amount !== undefined ? details.new_due_amount : txAmt;
        currentBal = prevBal + newDue;
      } else if (mode === 'emi_plan') {
        const financed = details?.emi_details?.financed_amount || details?.new_due_amount || txAmt;
        currentBal = prevBal + financed;
      } else {
        currentBal = Math.max(0, prevBal - txAmt);
      }

      // EMI details
      const emi = details?.emi_details;

      // Payment method
      const paymentMethod = details?.payment_method;

      // Unpack note
      const noteText = cleanNoteString(tx ? unpackReceiptNote(tx).noteText : (details?.notes || ''));

      const fmt = (amt: number) => formatShopCurrency(amt, shop.country, shop.currency_code);

      if (language === 'bn') {
        let msg = `🧾 *${shopName.toUpperCase()}*\n`;
        if (shopAddress) msg += `📍 দোকানের ঠিকানা: ${shopAddress}\n`;
        if (ownerName) msg += `👤 প্রোপ্রাইটার: ${ownerName}\n`;
        if (shopPhone) msg += `📞 মোবাইল: ${shopPhone}\n`;
        if (shop.gst_enabled && shop.gst_number) msg += `🏛️ GSTIN: ${shop.gst_number}\n`;
        msg += `----------------------------\n`;
        msg += `📄 *রসিদ নং:* ${receiptNo}\n`;
        msg += `📅 *তারিখ ও সময়:* ${dateStr}, ${timeStr}\n`;
        if (paymentMethod) msg += `💳 *পরিশোধের মাধ্যম:* ${paymentMethod}\n`;
        msg += `----------------------------\n`;
        msg += `👤 *কাস্টমার:* ${custName}\n`;
        msg += `📱 *মোবাইল:* ${customer.phone_number || 'N/A'}\n`;
        if (customerAddressStr) msg += `📍 *কাস্টমারের ঠিকানা:* ${customerAddressStr}\n`;
        if (customerGstinStr) msg += `🏛️ *GSTIN:* ${customerGstinStr}\n`;
        msg += `----------------------------\n`;

        if (!isPurePayment && items.length > 0) {
          msg += `🛍️ *ক্রয়কৃত পণ্যের বিবরণ:*\n`;
          items.forEach((it) => {
            msg += `• ${it.name}\n  ${it.quantity} × ${fmt(it.unit_price)} = ${fmt(it.total)}\n`;
          });
          msg += `----------------------------\n`;
        }

        if (!isPurePayment) {
          msg += `মোট মূল্য: ${fmt(subtotal)}\n`;
          if (discountAmt > 0) {
            msg += `ছাড় (${discountLabel}): -${fmt(discountAmt)}\n`;
          }
          if (hasGst) {
            msg += `করযোগ্য মূল্য: ${fmt(taxableBase)}\n`;
            if (cgstAmt > 0) msg += `CGST (${halfRate}%): +${fmt(cgstAmt)}\n`;
            if (sgstAmt > 0) msg += `SGST (${halfRate}%): +${fmt(sgstAmt)}\n`;
            if (igstAmt > 0) msg += `IGST (${gstRate}%): +${fmt(igstAmt)}\n`;
          }
          const grandTotalAmt = hasGst && gstPriceMode === 'exclusive' && totalTax > 0
            ? (taxableBase + totalTax)
            : (canonicalDetails?.paid_amount || txAmt || Math.max(0, subtotal - discountAmt));
          msg += `💰 *সর্বমোট মূল্য:* ${fmt(grandTotalAmt)}\n`;
          msg += `----------------------------\n`;
        }

        if (mode === 'emi_plan' && emi) {
          msg += `🏦 *কিস্তি পরিশোধ পরিকল্পনা (EMI):*\n`;
          msg += `• মোট বিক্রয়: ${fmt(emi.total_amount)}\n`;
          msg += `• ডাউন পেমেন্ট (জমা): ${fmt(emi.down_payment)}\n`;
          msg += `• বাকি কিস্তি ঋণ: ${fmt(emi.financed_amount)}\n`;
          msg += `• প্রতি মাসে কিস্তি: ${fmt(emi.installment_amount)} × ${emi.installment_count} মাস\n`;
          msg += `• প্রথম কিস্তির তারিখ: ${emi.start_date}\n`;
          msg += `----------------------------\n`;
        }

        if (mode === 'cash_sale') {
          msg += `💰 *পরিশোধ:* ${fmt(txAmt)} (✅ সম্পূর্ণ পরিশোধিত)\n`;
          msg += `🔴 *অবশিষ্ট বাকি:* ${fmt(currentBal)}\n`;
        } else if (mode === 'credit_sale') {
          if (details?.paid_amount && details.paid_amount > 0) {
            msg += `💵 *নগদ জমা:* ${fmt(details.paid_amount)}\n`;
          }
          msg += `🧾 *নতুন বাকি:* ${fmt(details?.new_due_amount || txAmt)}\n`;
          if (prevBal > 0) {
            msg += `🔴 *পূর্বের বাকি:* ${fmt(prevBal)}\n`;
          }
          msg += `🔴 *বর্তমান মোট বাকি:* ${fmt(currentBal)}\n`;
        } else if (mode === 'emi_plan') {
          if (emi?.down_payment || details?.paid_amount) {
            msg += `💵 *ডাউন পেমেন্ট জমা:* ${fmt(emi?.down_payment || details?.paid_amount || 0)}\n`;
          }
          msg += `🧾 *বাকি কিস্তি ঋণ:* ${fmt(emi?.financed_amount || txAmt)}\n`;
          if (prevBal > 0) {
            msg += `🔴 *পূর্বের বাকি:* ${fmt(prevBal)}\n`;
          }
          msg += `🔴 *বর্তমান মোট বাকি:* ${fmt(currentBal)}\n`;
        } else {
          if (prevBal > 0) {
            msg += `🔴 *পূর্বের বাকি:* ${fmt(prevBal)}\n`;
          }
          msg += `💵 *জমা পেয়েছেন:* ${fmt(txAmt)}\n`;
          msg += `🔴 *অবশিষ্ট বাকি:* ${fmt(currentBal)}\n`;
        }

        if (noteText) {
          msg += `----------------------------\n📝 *নোট:* ${noteText}\n`;
        }
        msg += `----------------------------\nআমাদের সাথে কেনাকাটা করার জন্য ধন্যবাদ! — ${shopName}`;
        return msg;
      } else if (language === 'hi') {
        let msg = `🧾 *${shopName.toUpperCase()}*\n`;
        if (shopAddress) msg += `📍 दुकान का पता: ${shopAddress}\n`;
        if (ownerName) msg += `👤 मालिक: ${ownerName}\n`;
        if (shopPhone) msg += `📞 फोन: ${shopPhone}\n`;
        if (shop.gst_enabled && shop.gst_number) msg += `🏛️ GSTIN: ${shop.gst_number}\n`;
        msg += `----------------------------\n`;
        msg += `📄 *रसीद सं.:* ${receiptNo}\n`;
        msg += `📅 *तिथि व समय:* ${dateStr}, ${timeStr}\n`;
        if (paymentMethod) msg += `💳 *भुगतान विधि:* ${paymentMethod}\n`;
        msg += `----------------------------\n`;
        msg += `👤 *ग्राहक:* ${custName}\n`;
        msg += `📱 *मोबाइल:* ${customer.phone_number || 'N/A'}\n`;
        if (customerAddressStr) msg += `📍 *ग्राहक का पता:* ${customerAddressStr}\n`;
        if (customerGstinStr) msg += `🏛️ *GSTIN:* ${customerGstinStr}\n`;
        msg += `----------------------------\n`;

        if (!isPurePayment && items.length > 0) {
          msg += `🛍️ *खरीदे गए सामान:*\n`;
          items.forEach((it) => {
            msg += `• ${it.name}\n  ${it.quantity} × ${fmt(it.unit_price)} = ${fmt(it.total)}\n`;
          });
          msg += `----------------------------\n`;
        }

        if (!isPurePayment) {
          msg += `उप-योग: ${fmt(subtotal)}\n`;
          if (discountAmt > 0) {
            msg += `छूट (${discountLabel}): -${fmt(discountAmt)}\n`;
          }
          if (hasGst) {
            msg += `कर योग्य मूल्य: ${fmt(taxableBase)}\n`;
            if (cgstAmt > 0) msg += `CGST (${halfRate}%): +${fmt(cgstAmt)}\n`;
            if (sgstAmt > 0) msg += `SGST (${halfRate}%): +${fmt(sgstAmt)}\n`;
            if (igstAmt > 0) msg += `IGST (${gstRate}%): +${fmt(igstAmt)}\n`;
          }
          const grandTotalAmt = hasGst && gstPriceMode === 'exclusive' && totalTax > 0
            ? (taxableBase + totalTax)
            : (canonicalDetails?.paid_amount || txAmt || Math.max(0, subtotal - discountAmt));
          msg += `💰 *कुल योग:* ${fmt(grandTotalAmt)}\n`;
          msg += `----------------------------\n`;
        }

        if (mode === 'emi_plan' && emi) {
          msg += `🏦 *किस्त भुगतान योजना (EMI):*\n`;
          msg += `• कुल बिक्री: ${fmt(emi.total_amount)}\n`;
          msg += `• डाउन पेमेंट (जमा): ${fmt(emi.down_payment)}\n`;
          msg += `• किस्त ऋण बकाया: ${fmt(emi.financed_amount)}\n`;
          msg += `• मासिक किस्त: ${fmt(emi.installment_amount)} × ${emi.installment_count} महीने\n`;
          msg += `• पहली किस्त तिथि: ${emi.start_date}\n`;
          msg += `----------------------------\n`;
        }

        if (mode === 'cash_sale') {
          msg += `💰 *भुगतान:* ${fmt(txAmt)} (✅ पूर्ण भुगतान)\n`;
          msg += `🔴 *शेष बकाया:* ${fmt(currentBal)}\n`;
        } else if (mode === 'credit_sale') {
          if (details?.paid_amount && details.paid_amount > 0) {
            msg += `💵 *जमा राशि:* ${fmt(details.paid_amount)}\n`;
          }
          msg += `🧾 *नया बकाया:* ${fmt(details?.new_due_amount || txAmt)}\n`;
          if (prevBal > 0) {
            msg += `🔴 *पिछला बकाया:* ${fmt(prevBal)}\n`;
          }
          msg += `🔴 *वर्तमान कुल बकाया:* ${fmt(currentBal)}\n`;
        } else if (mode === 'emi_plan') {
          if (emi?.down_payment || details?.paid_amount) {
            msg += `💵 *डाउन पेमेंट जमा:* ${fmt(emi?.down_payment || details?.paid_amount || 0)}\n`;
          }
          msg += `🧾 *किस्त ऋण बकाया:* ${fmt(emi?.financed_amount || txAmt)}\n`;
          if (prevBal > 0) {
            msg += `🔴 *पिछला बकाया:* ${fmt(prevBal)}\n`;
          }
          msg += `🔴 *वर्तमान कुल बकाया:* ${fmt(currentBal)}\n`;
        } else {
          if (prevBal > 0) {
            msg += `🔴 *पिछला बकाया:* ${fmt(prevBal)}\n`;
          }
          msg += `💵 *प्राप्त भुगतान:* ${fmt(txAmt)}\n`;
          msg += `🔴 *शेष बकाया:* ${fmt(currentBal)}\n`;
        }

        if (noteText) {
          msg += `----------------------------\n📝 *नोट:* ${noteText}\n`;
        }
        msg += `----------------------------\nहमारे साथ व्यापार करने के लिए धन्यवाद! — ${shopName}`;
        return msg;
      } else {
        let msg = `🧾 *${shopName.toUpperCase()}*\n`;
        if (shopAddress) msg += `📍 Shop Address: ${shopAddress}\n`;
        if (ownerName) msg += `👤 Owner: ${ownerName}\n`;
        if (shopPhone) msg += `📞 Phone: ${shopPhone}\n`;
        if (shop.gst_enabled && shop.gst_number) msg += `🏛️ GSTIN: ${shop.gst_number}\n`;
        msg += `----------------------------\n`;
        msg += `📄 *RECEIPT NO:* ${receiptNo}\n`;
        msg += `📅 *Date & Time:* ${dateStr}, ${timeStr}\n`;
        if (paymentMethod) msg += `💳 *Payment Method:* ${paymentMethod}\n`;
        msg += `----------------------------\n`;
        msg += `👤 *CUSTOMER:* ${custName}\n`;
        msg += `📱 *Mobile:* ${customer.phone_number || 'N/A'}\n`;
        if (customerAddressStr) msg += `📍 *Customer Address:* ${customerAddressStr}\n`;
        if (customerGstinStr) msg += `🏛️ *GSTIN:* ${customerGstinStr}\n`;
        msg += `----------------------------\n`;

        if (!isPurePayment && items.length > 0) {
          msg += `🛍️ *PURCHASED ITEMS:*\n`;
          items.forEach((it) => {
            msg += `• ${it.name}\n  ${it.quantity} × ${fmt(it.unit_price)} = ${fmt(it.total)}\n`;
          });
          msg += `----------------------------\n`;
        }

        if (!isPurePayment) {
          msg += `Subtotal: ${fmt(subtotal)}\n`;
          if (discountAmt > 0) {
            msg += `Discount (${discountLabel}): -${fmt(discountAmt)}\n`;
          }
          if (hasGst) {
            msg += `Taxable Base: ${fmt(taxableBase)}\n`;
            if (cgstAmt > 0) msg += `CGST (${halfRate}%): +${fmt(cgstAmt)}\n`;
            if (sgstAmt > 0) msg += `SGST (${halfRate}%): +${fmt(sgstAmt)}\n`;
            if (igstAmt > 0) msg += `IGST (${gstRate}%): +${fmt(igstAmt)}\n`;
          }
          const grandTotalAmt = hasGst && gstPriceMode === 'exclusive' && totalTax > 0
            ? (taxableBase + totalTax)
            : (canonicalDetails?.paid_amount || txAmt || Math.max(0, subtotal - discountAmt));
          msg += `💰 *GRAND TOTAL:* ${fmt(grandTotalAmt)}\n`;
          msg += `----------------------------\n`;
        }

        if (mode === 'emi_plan' && emi) {
          msg += `🏦 *EMI PAYMENT SCHEDULE:*\n`;
          msg += `• Total Amount: ${fmt(emi.total_amount)}\n`;
          msg += `• Down Payment: ${fmt(emi.down_payment)}\n`;
          msg += `• Financed Amount: ${fmt(emi.financed_amount)}\n`;
          msg += `• Monthly EMI: ${fmt(emi.installment_amount)} × ${emi.installment_count} Months\n`;
          msg += `• First EMI Due Date: ${emi.start_date}\n`;
          msg += `----------------------------\n`;
        }

        if (mode === 'cash_sale') {
          msg += `💰 *Total Paid:* ${fmt(txAmt)} (✅ PAID IN FULL)\n`;
          msg += `🔴 *Remaining Due:* ${fmt(currentBal)}\n`;
        } else if (mode === 'credit_sale') {
          if (details?.paid_amount && details.paid_amount > 0) {
            msg += `💵 *Paid Now:* ${fmt(details.paid_amount)}\n`;
          }
          msg += `🧾 *New Purchase Due:* ${fmt(details?.new_due_amount || txAmt)}\n`;
          if (prevBal > 0) {
            msg += `🔴 *Previous Due:* ${fmt(prevBal)}\n`;
          }
          msg += `🔴 *Total Outstanding Due:* ${fmt(currentBal)}\n`;
        } else if (mode === 'emi_plan') {
          if (emi?.down_payment || details?.paid_amount) {
            msg += `💵 *Down Payment Paid:* ${fmt(emi?.down_payment || details?.paid_amount || 0)}\n`;
          }
          msg += `🧾 *Financed on EMI:* ${fmt(emi?.financed_amount || txAmt)}\n`;
          if (prevBal > 0) {
            msg += `🔴 *Previous Due:* ${fmt(prevBal)}\n`;
          }
          msg += `🔴 *Total Outstanding Due:* ${fmt(currentBal)}\n`;
        } else {
          if (prevBal > 0) {
            msg += `🔴 *Previous Due:* ${fmt(prevBal)}\n`;
          }
          msg += `💵 *Payment Received:* ${fmt(txAmt)}\n`;
          msg += `🔴 *Remaining Due:* ${fmt(currentBal)}\n`;
        }

        if (noteText) {
          msg += `----------------------------\n📝 *Note:* ${noteText}\n`;
        }
        msg += `----------------------------\nThank you for your business! — ${shopName}`;
        return msg;
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
 * Helper to detect mobile environment (Android, iOS, etc.)
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
}

/**
 * Universally launches WhatsApp on Mobile and Desktop:
 * - On Mobile (Android / iOS): Direct link navigation cleanly hands off to the native
 *   WhatsApp application via App Links / Universal Links, bypassing popup blockers entirely.
 * - On Desktop: Opens in a new tab so the merchant stays in the Smart Khata app.
 */
export function openWhatsAppChat(chatUrl: string): void {
  if (typeof window === 'undefined' || !chatUrl) return;

  if (isMobileDevice()) {
    // Canonical mobile navigation: reliable across Android Chrome, iOS Safari, Samsung Internet, and PWAs
    const link = document.createElement('a');
    link.href = chatUrl;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 100);
  } else {
    // Desktop browser: open new tab for WhatsApp Web
    window.open(chatUrl, '_blank', 'noopener,noreferrer');
  }
}

// Global in-memory diagnostic state for safe development troubleshooting
export interface WhatsAppDiagnosticRecord {
  timestamp: string;
  phoneInput: string;
  cleanPhone: string;
  valid: boolean;
  type: WhatsAppMessageType;
  messagePreview: string;
  chatUrl: string;
  isMobile: boolean;
  dispatchAction: string;
}

let lastDiagnostic: WhatsAppDiagnosticRecord | null = null;

export function getLastWhatsAppDiagnostic(): WhatsAppDiagnosticRecord | null {
  return lastDiagnostic;
}

/**
 * 5. UNIFIED DISPATCH SERVICE
 * The single canonical execution path for opening direct WhatsApp chat for any customer.
 * - Resolves & normalizes customer phone
 * - Validates phone
 * - Generates language-aware message
 * - Immediately hands off to WhatsApp directly without blocking popup blockers or hijacking to generic share sheets
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
  const chatUrl = getWhatsAppChatUrl(cleanPhone, formattedMessage, defaultCountry);
  const isMobile = isMobileDevice();

  // Record diagnostic
  lastDiagnostic = {
    timestamp: new Date().toISOString(),
    phoneInput: customer.phone_number || '',
    cleanPhone,
    valid: true,
    type: options.type,
    messagePreview: formattedMessage.slice(0, 80),
    chatUrl,
    isMobile,
    dispatchAction: 'opened_chat',
  };

  // Expose on window for easy developer inspection on physical phone (window.__SMART_KHATA_LAST_WA__)
  if (typeof window !== 'undefined') {
    (window as any).__SMART_KHATA_LAST_WA__ = lastDiagnostic;
    if (window.location?.search?.includes('debug_wa=true') || localStorage?.getItem('smart_khata_debug_wa') === 'true') {
      console.group('[WHATSAPP-DIAGNOSTICS]');
      console.log('1. Raw Input:', customer.phone_number);
      console.log('2. Normalized Number:', cleanPhone);
      console.log('3. Is Mobile:', isMobile);
      console.log('4. Destination URL:', chatUrl);
      console.log('5. Message Preview:', formattedMessage.slice(0, 100) + '...');
      console.groupEnd();
    }
  }

  // 2. Check Official Meta Cloud API ONLY IF explicitly enabled/connected in local storage cache
  // This avoids a blocking Supabase network query on every single click, maintaining instantaneous user-gesture responsiveness!
  try {
    const cachedConnRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(`smart_khata_wa_connection_${shop.id}`) : null;
    if (cachedConnRaw) {
      const cachedConn = JSON.parse(cachedConnRaw);
      if (cachedConn && cachedConn.status === 'CONNECTED') {
        console.log(`[WHATSAPP-SERVICE] Cached Meta Cloud API is CONNECTED. Dispatching official message to ${cleanPhone}`);
        const apiRes = await MetaCloudApiService.sendMessage({
          shop,
          recipient: customer,
          templateName: options.type === 'RECEIPT' ? 'receipt_notification' : 'payment_reminder',
          messageText: formattedMessage,
          mediaUrl: options.mediaUrl || undefined,
        });

        if (apiRes.success) {
          lastDiagnostic.dispatchAction = 'meta_cloud_sent';
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
    }
  } catch (cloudErr) {
    console.warn('[WHATSAPP-SERVICE] Meta Cloud API check failed, falling back to deep-link:', cloudErr);
  }

  // 3. Direct WhatsApp Chat Launch
  // Opens direct chat for that customer number WITHOUT requiring contact saving and WITHOUT generic OS share sheet
  openWhatsAppChat(chatUrl);

  return {
    success: true,
    action: 'opened_chat',
    statusMessage:
      language === 'bn'
        ? 'হোয়াটসঅ্যাপ খোলা হয়েছে! চ্যাটে সেন্ড বাটনে চাপ দিন।'
        : language === 'hi'
        ? 'व्हाट्सएप खुल गया! कृपया चैट में सेंड बटन दबाएं।'
        : 'WhatsApp opened / Ready to send (Tap Send in chat)',
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
