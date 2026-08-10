import React, { useState, useRef } from 'react';
import { Customer, Language, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import html2canvas from 'html2canvas';
import {
  MessageCircle,
  X,
  CheckCircle2,
  Printer,
  Copy,
  Share2,
  Check,
  MapPin,
  FileCheck2,
  Download,
  Loader2,
  ImageIcon,
  ShieldCheck
} from 'lucide-react';

import { printTransactionReceiptPDF } from '../lib/pdfGenerator';
import { getWhatsAppUrl } from '../lib/whatsappUtils';
import { formatShopCurrency } from '../lib/countryPricing';

interface Props {
  transaction: Transaction;
  customer: Customer;
  shop: Shop;
  language: Language;
  onClose: () => void;
}

export const ReceiptModal: React.FC<Props> = ({
  transaction,
  customer,
  shop,
  language,
  onClose,
}) => {
  const t = translations[language];
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const isCredit = transaction.type === 'credit_given';
  const isVoid = transaction.type === 'void_correction' || transaction.is_voided;
  const typeLabel = isVoid ? t.void_correction : isCredit ? t.credit_given : t.payment_received;
  const fmt = (amt: number) => formatShopCurrency(amt, shop?.country, shop?.currency_code);

  const dateFormatted = new Date(transaction.created_at).toLocaleString(
    language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );

  // Math balance breakdown
  const finalBalance = customer.balance || 0;
  const txAmt = Number(transaction.amount);
  const prevBalance = isVoid
    ? finalBalance
    : isCredit
    ? finalBalance - txAmt
    : finalBalance + txAmt;

  const hasGst = shop.gst_enabled && transaction.tax_amount && transaction.tax_amount > 0;

  // Formatted Text Receipt for Copy & WhatsApp text fallback
  const receiptText = `🧾 *${shop.shop_name.toUpperCase()}*
${shop.owner_name ? `${t.receipt_owner}: ${shop.owner_name}\n` : ''}${shop.full_address ? `${t.receipt_address}: ${shop.full_address}\n` : ''}${shop.phone ? `Phone: ${shop.phone}\n` : ''}${shop.gst_enabled && shop.gst_number ? `GSTIN: ${shop.gst_number}\n` : ''}----------------------------
👤 *${t.receipt_customer}:* ${customer.name} (${customer.phone_number})
${customer.state ? `Location: ${customer.state}\n` : ''}🆔 *${t.tx_id}:* ${transaction.id.slice(-8)}
📅 *${t.date}:* ${dateFormatted}

➡️ *${t.type}:* ${typeLabel}
${hasGst ? `${t.base_amount}: ${fmt(transaction.base_amount || 0)}\n` : ''}${hasGst && (transaction.cgst_amount || 0) > 0 ? `CGST (${(transaction.gst_rate || 0) / 2}%): ${fmt(transaction.cgst_amount || 0)}\n` : ''}${hasGst && (transaction.sgst_amount || 0) > 0 ? `SGST (${(transaction.gst_rate || 0) / 2}%): ${fmt(transaction.sgst_amount || 0)}\n` : ''}${hasGst && (transaction.igst_amount || 0) > 0 ? `IGST (${transaction.gst_rate}%): ${fmt(transaction.igst_amount || 0)}\n` : ''}💰 *${t.total_with_tax}:* ${fmt(txAmt)}
${transaction.note ? `📝 *Note:* ${transaction.note}\n` : ''}----------------------------
🔴 *${t.previous_balance.toUpperCase()}:* ${fmt(prevBalance)}
🔴 *${t.due_amount.toUpperCase()}:* ${fmt(finalBalance)}
----------------------------
${t.receipt_thank_you} - ${shop.owner_name}`;

  // Customer ID Linkage & Phone Number Validation
  const isIdMismatch = Boolean(transaction.customer_id && transaction.customer_id !== customer.id);
  const cleanCustomerPhone = (customer.phone_number || '').replace(/\D/g, '');
  const hasValidPhone = cleanCustomerPhone.length >= 8;
  const isPhoneMissing = !customer.phone_number || customer.phone_number.trim() === '';

  const waUrl = getWhatsAppUrl(customer.phone_number, receiptText, shop.country || 'IN');

  // Generate Ultra High Resolution Image via html2canvas (Scale: 3 for crisp readability)
  const generateCanvasFile = async (): Promise<File | null> => {
    if (!receiptRef.current) return null;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      } as any);
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const file = new File(
            [blob],
            `receipt_${customer.name.replace(/\s+/g, '_')}_${transaction.id.slice(-6)}.png`,
            { type: 'image/png' }
          );
          resolve(file);
        }, 'image/png');
      });
    } catch (err) {
      console.error('Failed to generate receipt image:', err);
      return null;
    }
  };

  // 1-Click Premium WhatsApp Share (Native Web Share API with File or Download Fallback)
  const handleShareNativeOrDownload = async () => {
    if (isIdMismatch) {
      setToastMsg('⚠️ Customer ID mismatch! Unable to verify recipient.');
      return;
    }
    if (isPhoneMissing) {
      setToastMsg('⚠️ Customer phone number is missing. Please add phone number in Customer profile.');
      return;
    }
    if (!hasValidPhone) {
      setToastMsg(`⚠️ Customer phone number is invalid (${customer.phone_number}).`);
      return;
    }

    setIsGenerating(true);
    const file = await generateCanvasFile();
    setIsGenerating(false);

    if (!file) {
      window.open(waUrl, '_blank');
      return;
    }

    // Check Native Web Share API File support
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `${shop.shop_name} Receipt`,
          text: `Receipt for ${customer.name} - ${shop.shop_name}`,
          files: [file],
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Native share cancelled or failed, falling back to download:', err);
      }
    }

    // Fallback: Download Image + Redirect to WhatsApp
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);

    setToastMsg('📸 High-Res Receipt Image downloaded! Attach it in WhatsApp.');
    setTimeout(() => setToastMsg(''), 5000);

    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 800);
  };

  // Download High Quality PNG Image
  const handleDownloadImage = async () => {
    setIsGenerating(true);
    const file = await generateCanvasFile();
    setIsGenerating(false);

    if (!file) return;

    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);

    setToastMsg('✅ Receipt Image downloaded successfully!');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <h3 className="font-extrabold text-lg">{t.receipt_title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Toast Alert Banner */}
        {toastMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg('')} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Printable Branded Receipt Card (Canvas Target) */}
        <div ref={receiptRef} className="p-5 space-y-4 bg-white text-slate-900 printable-receipt">
          {/* Top Brand Block */}
          <div className="text-center border-b border-slate-200 pb-3 space-y-1">
            {shop.logo_url && (
              <img
                src={shop.logo_url}
                alt="Shop Logo"
                className="w-20 h-20 max-h-20 object-contain rounded-2xl mx-auto mb-2 p-1 border border-slate-200 bg-white shadow-xs"
              />
            )}
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              {shop.shop_name}
            </h2>
            {shop.owner_name && (
              <p className="text-xs text-slate-600 font-extrabold">{t.receipt_owner}: {shop.owner_name}</p>
            )}
            {(shop.full_address || shop.city || shop.state) && (
              <p className="text-xs text-slate-500 font-medium flex items-center justify-center space-x-1">
                <MapPin className="w-3.5 h-3.5 mr-0.5 text-slate-400 shrink-0" />
                <span>
                  {[shop.full_address, shop.city, shop.state].filter(Boolean).join(', ')}
                </span>
              </p>
            )}
            {shop.phone && (
              <p className="text-xs text-slate-500 font-medium">
                📞 Contact: {shop.phone}
              </p>
            )}
            {shop.gst_enabled && shop.gst_number && (
              <p className="text-[11px] font-mono text-slate-700 font-bold bg-slate-100 inline-block px-2.5 py-0.5 rounded-md mt-1">
                GSTIN: {shop.gst_number}
              </p>
            )}
          </div>

          {/* Customer & Transaction Meta Grid (Direct Phone Linkage Verified) */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5 font-medium">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{t.customer_name}:</span>
              <span className="font-extrabold text-slate-900">{customer.display_label || customer.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{t.customer_phone}:</span>
              <span className="font-bold text-slate-900 flex items-center space-x-1">
                <span>{customer.phone_number || 'Missing'}</span>
                {hasValidPhone ? (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">Auto Target</span>
                ) : (
                  <span className="text-[9px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.5 rounded">Ineligible</span>
                )}
              </span>
            </div>
            {customer.state && (
              <div className="flex justify-between">
                <span className="text-slate-500">{t.customer_state}:</span>
                <span className="font-bold text-slate-800">{customer.state}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200/80">
              <span className="text-slate-500">{t.tx_id}:</span>
              <span className="font-mono font-bold text-slate-700">{transaction.id.slice(-8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t.date}:</span>
              <span className="text-slate-700">{dateFormatted}</span>
            </div>
          </div>

          {/* Amount & Tax Breakdown Table */}
          <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700 uppercase">{t.type}:</span>
              <span className={`font-black text-sm uppercase ${isCredit ? 'text-red-600' : 'text-green-600'}`}>
                {typeLabel}
              </span>
            </div>

            {hasGst && (
              <div className="bg-blue-50/70 p-3 rounded-xl space-y-1 text-slate-700 font-medium">
                <div className="flex justify-between">
                  <span>{t.base_amount}:</span>
                  <span className="font-bold">{fmt(transaction.base_amount || 0)}</span>
                </div>
                {(transaction.cgst_amount || 0) > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>{t.cgst} ({(transaction.gst_rate || 0) / 2}%):</span>
                    <span>+{fmt(transaction.cgst_amount || 0)}</span>
                  </div>
                )}
                {(transaction.sgst_amount || 0) > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>{t.sgst} ({(transaction.gst_rate || 0) / 2}%):</span>
                    <span>+{fmt(transaction.sgst_amount || 0)}</span>
                  </div>
                )}
                {(transaction.igst_amount || 0) > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>{t.igst} ({transaction.gst_rate}%):</span>
                    <span>+{fmt(transaction.igst_amount || 0)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-1">
              <span className="font-black text-sm text-slate-900">{t.total_with_tax}:</span>
              <span
                className={`text-2xl font-black ${
                  isCredit ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {isCredit ? '-' : '+'}{fmt(txAmt)}
              </span>
            </div>

            {transaction.note && (
              <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                📝 {transaction.note}
              </div>
            )}
          </div>

          {/* Balance Status Ledger Block */}
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1 text-xs">
            <div className="flex justify-between text-slate-400 font-medium">
              <span>{t.previous_balance}:</span>
              <span className="font-bold text-slate-300">{fmt(prevBalance)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800">
              <span className="font-extrabold text-white text-sm">{t.due_amount}:</span>
              <span
                className={`text-xl font-black ${
                  finalBalance > 0 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {fmt(finalBalance)}
              </span>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="flex items-end justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-600 shrink-0" />
              <span>Smart Khata • Verified Receipt</span>
            </div>

            {shop.signature_url && (
              <div className="text-right">
                <img
                  src={shop.signature_url}
                  alt="Signature"
                  className="h-9 object-contain ml-auto"
                />
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">Authorized Signature</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5 print:hidden">
          {/* Primary Action: Share Receipt Image / WhatsApp */}
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleShareNativeOrDownload}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>{t.send_whatsapp} (Image / Native Share)</span>
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-400 font-medium text-center leading-tight">
            💡 Generates high-res image & shares directly to WhatsApp.
          </p>

          {/* Multi Control Action Grid */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="py-2.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 shadow-xs transition-colors disabled:opacity-50"
              title="Download Receipt Image"
            >
              <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Image</span>
            </button>

            <button
              onClick={() => printTransactionReceiptPDF(transaction, customer, shop, language)}
              className="py-2.5 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 shadow-xs transition-colors"
              title="Download PDF"
            >
              <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Print</span>
            </button>

            <button
              onClick={handleCopyText}
              className="py-2.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 shadow-xs transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-600 shrink-0" /> : <Copy className="w-4 h-4 text-slate-600 shrink-0" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
