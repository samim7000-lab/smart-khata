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
  FileCheck2,
  Loader2,
  ImageIcon,
  ShieldCheck,
  Building2,
  User,
  Phone,
  MapPin,
  FileText,
  Tag,
  Check
} from 'lucide-react';

import { validatePhoneNumber } from '../lib/phoneValidation';
import { getCountryByCode } from '../data/countries';
import { printTransactionReceiptPDF } from '../lib/pdfGenerator';
import { getWhatsAppUrl } from '../lib/whatsappUtils';
import { formatShopCurrency } from '../lib/countryPricing';
import { unpackReceiptNote, calculatePreviousBalance } from '../lib/receiptUtils';

interface Props {
  transaction: Transaction;
  customer: Customer;
  shop: Shop;
  language: Language;
  transactions?: Transaction[];
  onClose: () => void;
}

export const ReceiptModal: React.FC<Props> = ({
  transaction,
  customer,
  shop,
  language,
  transactions = [],
  onClose,
}) => {
  const t = translations[language];
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const isCredit = transaction.type === 'credit_given';
  const isVoid = transaction.type === 'void_correction' || transaction.is_voided;
  const fmt = (amt: number) => formatShopCurrency(amt, shop?.country, shop?.currency_code);

  const dateObj = new Date(transaction.created_at);
  const dateFormatted = dateObj.toLocaleDateString(
    language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' }
  );
  const timeFormatted = dateObj.toLocaleTimeString(
    language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US',
    { hour: '2-digit', minute: '2-digit' }
  );

  // Unpack line items & receipt payload details
  const { noteText, details } = unpackReceiptNote(transaction);
  const mode = details?.mode || (isCredit ? 'credit_sale' : 'due_payment');

  // Dynamic Type Labels adhering strictly to Requirement #13 (Proper English Terminology)
  let typeLabel = '';
  if (language === 'bn') {
    typeLabel = isVoid ? 'ভয়েড / সংশোধন' : mode === 'cash_sale' ? 'নগদ বিক্রি' : mode === 'credit_sale' ? 'বাকি বিক্রি' : 'বাকি আদায় / জমা';
  } else {
    typeLabel = isVoid ? 'Void / Correction' : mode === 'cash_sale' ? 'Cash Sale (Paid)' : mode === 'credit_sale' ? 'Credit Sale (Due)' : 'Payment Received';
  }

  // Mathematical balance calculations (CRITICAL BAKI FIX: Previous Due before this transaction)
  const prevBalance = calculatePreviousBalance(transaction, customer, transactions);
  const txAmt = Number(transaction.amount) || 0;
  
  let currentBalance = 0;
  if (mode === 'cash_sale') {
    currentBalance = Math.max(0, prevBalance);
  } else if (mode === 'credit_sale') {
    const newDue = details?.new_due_amount !== undefined ? details.new_due_amount : txAmt;
    currentBalance = prevBalance + newDue;
  } else {
    currentBalance = Math.max(0, prevBalance - txAmt);
  }

  const isFullyPaid = currentBalance <= 0;

  // Item List (Only shown if mode is cash_sale or credit_sale and items exist)
  const isPurePayment = mode === 'due_payment';
  const hasItems = !isPurePayment && details?.items && details.items.length > 0;
  const lineItems = hasItems ? details.items! : (
    !isPurePayment ? [{
      id: 'default-item',
      name: noteText || 'General Item Purchase',
      quantity: 1,
      unit_price: txAmt,
      total: txAmt,
    }] : []
  );

  const subtotal = details?.subtotal !== undefined ? details.subtotal : txAmt;
  const discountAmt = details?.discount_amount || 0;
  const taxableAmt = details?.taxable_amount !== undefined ? details.taxable_amount : Math.max(0, subtotal - discountAmt);
  
  // Requirement #5 & #12: GST must be OPTIONAL. If disabled, do not render GST block!
  const hasGst = Boolean(details?.gst_enabled ?? (shop.gst_enabled && transaction.tax_amount && transaction.tax_amount > 0));
  const gstPriceMode = details?.gst_price_mode || transaction.gst_price_mode || 'exclusive';

  // Receipt / Invoice Number
  const receiptNumber = details?.receipt_number || `INV-${transaction.id.replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6)}`;

  // Shop Address & Customer Address display formatting (Omitted if empty - Requirement #12)
  const shopAddressStr = shop.full_address || [shop.city, shop.state, shop.postal_code].filter(Boolean).join(', ');
  const customerAddressStr = (details?.customer_address || customer.address || customer.state || '').trim();
  const customerGstinStr = (details?.customer_gstin || customer.gstin || '').trim();

  // Formatted Text Receipt for Copy & WhatsApp text fallback
  const labelPrevDue = language === 'bn' ? 'পূর্বের বাকি' : 'Previous Due';
  const labelCurrentDue = language === 'bn' ? 'বর্তমান মোট বাকি' : 'Total Outstanding Due';
  const labelPaymentRecv = language === 'bn' ? 'জমা পেয়েছেন' : 'Payment Received';

  const receiptText = `🧾 *${shop.shop_name.toUpperCase()}*
${shopAddressStr ? `Address: ${shopAddressStr}\n` : ''}${shop.owner_name ? `Owner: ${shop.owner_name}\n` : ''}${shop.phone ? `Phone: ${shop.phone}\n` : ''}${shop.gst_enabled && shop.gst_number ? `GSTIN: ${shop.gst_number}\n` : ''}----------------------------
📄 *RECEIPT NO:* ${receiptNumber}
📅 *Date:* ${dateFormatted} ${timeFormatted}
----------------------------
👤 *CUSTOMER:* ${customer.display_label || customer.name}
📱 *Mobile:* ${customer.phone_number || 'N/A'}
${customerAddressStr ? `📍 *Address:* ${customerAddressStr}\n` : ''}${customerGstinStr ? `GSTIN: ${customerGstinStr}\n` : ''}----------------------------
💰 *${typeLabel.toUpperCase()}:* ${fmt(txAmt)}
${prevBalance > 0 || isCredit ? `🔴 *${labelPrevDue}:* ${fmt(prevBalance)}\n` : ''}🔴 *${labelCurrentDue}:* ${fmt(currentBalance)}
----------------------------
Thank you for your business! - ${shop.shop_name}`;

  // Phone validation & WhatsApp URL resolution
  const cleanPhone = (customer.phone_number || '').trim();
  const isPhoneMissing = !cleanPhone;
  const countryConfig = getCountryByCode(shop.country || 'IN');
  const phoneVal = cleanPhone ? validatePhoneNumber(cleanPhone, countryConfig, language) : { isValid: true };
  const hasValidPhone = phoneVal.isValid;
  const waUrl = getWhatsAppUrl(customer.phone_number, receiptText, shop.country || 'IN');

  // Ultra High Resolution 4K Image Generation via html2canvas (Scale 4.0 for sharp font rendering)
  const generateCanvasFile = async (): Promise<File | null> => {
    if (!receiptRef.current) return null;
    try {
      const targetScale = 4.0;
      const canvas = await html2canvas(receiptRef.current, {
        scale: targetScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        removeContainer: true,
      } as any);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const file = new File(
            [blob],
            `Invoice_${receiptNumber}_${customer.name.replace(/\s+/g, '_')}.png`,
            { type: 'image/png' }
          );
          resolve(file);
        }, 'image/png', 1.0);
      });
    } catch (err) {
      console.error('Failed to generate receipt image:', err);
      return null;
    }
  };

  // WhatsApp Native Share or Direct Link Share
  const handleShareNativeOrDownload = async () => {
    if (isPhoneMissing) {
      setToastMsg('⚠️ Customer phone number is missing.');
      return;
    }
    if (!hasValidPhone) {
      setToastMsg(`⚠️ ${phoneVal.errorMsg || (language === 'bn' ? 'সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.')}`);
      return;
    }

    setIsGenerating(true);
    const file = await generateCanvasFile();
    setIsGenerating(false);

    if (!file) {
      window.open(waUrl, '_blank');
      return;
    }

    // Native Web Share API (File attachment on mobile Safari / Chrome)
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Receipt from ${shop.shop_name}`,
          text: `Hello ${customer.display_label || customer.name}, your receipt from ${shop.shop_name} is ready.`,
          files: [file],
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Native share cancelled, falling back to direct link:', err);
      }
    }

    // Fallback: Download High-Res Image + Open WhatsApp Web/App Link
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);

    setToastMsg('📸 High-Res Receipt Image downloaded! Opening WhatsApp...');
    setTimeout(() => setToastMsg(''), 4000);

    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 600);
  };

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
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-slate-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-base tracking-tight">{t.receipt_title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
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

        {/* ========================================================================= */}
        {/* PRINTABLE HIGH-QUALITY BUSINESS INVOICE CARD (Target for html2canvas & Print) */}
        {/* ========================================================================= */}
        <div ref={receiptRef} className="p-6 space-y-5 bg-white text-slate-900 printable-receipt font-sans">
          
          {/* TOP SECTION: LOGO & HEADER ORDER (Address -> Owner Name -> Shop Name) */}
          <div className="text-center space-y-2 border-b border-slate-200 pb-4">
            {shop.logo_url && (
              <div className="mb-2">
                <img
                  src={shop.logo_url}
                  alt="Shop Logo"
                  crossOrigin="anonymous"
                  className="w-24 h-24 max-h-24 object-contain rounded-2xl mx-auto p-1.5 border border-slate-200 bg-white shadow-xs"
                />
              </div>
            )}

            {/* REQUIREMENT #4 HEADER ORDER: 1. SHOP ADDRESS, 2. OWNER NAME, 3. SHOP NAME */}
            {shopAddressStr && (
              <p className="text-xs text-slate-600 font-semibold flex items-center justify-center space-x-1">
                <MapPin className="w-3.5 h-3.5 mr-0.5 text-slate-400 shrink-0" />
                <span>{shopAddressStr}</span>
              </p>
            )}

            {shop.owner_name && (
              <p className="text-xs text-slate-700 font-extrabold uppercase tracking-wide">
                Proprietor: {shop.owner_name}
              </p>
            )}

            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              {shop.shop_name}
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-x-3 text-xs text-slate-500 font-medium">
              {shop.phone && <span>📞 Contact: {shop.phone}</span>}
              {shop.gst_enabled && shop.gst_number && (
                <span className="font-mono text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  GSTIN: {shop.gst_number}
                </span>
              )}
            </div>
          </div>

          {/* INVOICE META & CUSTOMER DETAILS ORDER */}
          {/* Customer Name -> Customer Address -> Customer Mobile -> GSTIN */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            {/* Left Column: Customer Details */}
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Customer Details</div>
              <div className="font-black text-slate-900 text-sm">{customer.display_label || customer.name}</div>
              
              {/* Requirement #12: Omit address if empty */}
              {customerAddressStr && (
                <div className="text-slate-600 font-medium flex items-start space-x-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                  <span>{customerAddressStr}</span>
                </div>
              )}
              {customer.phone_number && (
                <div className="text-slate-700 font-bold flex items-center space-x-1">
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{customer.phone_number}</span>
                </div>
              )}
              {customerGstinStr && (
                <div className="font-mono text-[11px] text-slate-700 font-bold">
                  GSTIN: {customerGstinStr}
                </div>
              )}
            </div>

            {/* Right Column: Invoice Meta */}
            <div className="text-right space-y-1 divide-y divide-slate-100">
              <div className="pb-1">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Receipt No</div>
                <div className="font-mono font-black text-blue-600 text-sm">{receiptNumber}</div>
              </div>
              <div className="pt-1">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Date & Time</div>
                <div className="font-semibold text-slate-700">{dateFormatted}</div>
                <div className="text-[11px] text-slate-500">{timeFormatted}</div>
              </div>
            </div>
          </div>

          {/* ITEM DETAILS TABLE (Only rendered if NOT pure payment received!) */}
          {!isPurePayment && lineItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                Itemized Invoice Summary
              </div>

              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                    <th className="py-2 px-2">Item Description</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Unit Price</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {lineItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-2 px-2 font-bold">{item.name}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{fmt(item.unit_price)}</td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* FINANCIAL BREAKDOWN (For Sale Transactions) */}
          {!isPurePayment && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Subtotal:</span>
                <span className="font-bold text-slate-900">{fmt(subtotal)}</span>
              </div>

              {/* Requirement #12: Omit discount if 0 */}
              {discountAmt > 0 && (
                <div className="flex justify-between text-emerald-700 font-extrabold">
                  <span>Discount ({details?.discount_type === 'percentage' ? `${details.discount_value}%` : 'Fixed'}):</span>
                  <span>-{fmt(discountAmt)}</span>
                </div>
              )}

              {/* Requirement #5 & #12: Omit GST section if GST disabled */}
              {hasGst && (
                <>
                  <div className="flex justify-between text-slate-700 font-semibold pt-1 border-t border-slate-200/60">
                    <span>Taxable Base Amount:</span>
                    <span className="font-bold">{fmt(taxableAmt)}</span>
                  </div>

                  <div className="bg-blue-50/70 p-2.5 rounded-xl space-y-1 text-slate-700 border border-blue-100 text-[11px] font-semibold">
                    <div className="flex justify-between text-blue-900 font-extrabold text-[10px] uppercase">
                      <span>GST Mode: {gstPriceMode === 'inclusive' ? 'Price Includes GST' : 'GST Added to Price'}</span>
                      <span>Rate: {transaction.gst_rate || 18}%</span>
                    </div>

                    {(transaction.cgst_amount || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>CGST ({(transaction.gst_rate || 0) / 2}%):</span>
                        <span>+{fmt(transaction.cgst_amount || 0)}</span>
                      </div>
                    )}
                    {(transaction.sgst_amount || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>SGST ({(transaction.gst_rate || 0) / 2}%):</span>
                        <span>+{fmt(transaction.sgst_amount || 0)}</span>
                      </div>
                    )}
                    {(transaction.igst_amount || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>IGST ({transaction.gst_rate}%):</span>
                        <span>+{fmt(transaction.igst_amount || 0)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-300">
                <div>
                  <span className="font-black text-sm text-slate-900 uppercase">Grand Total:</span>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{typeLabel}</div>
                </div>
                <span className={`text-2xl font-black ${mode === 'credit_sale' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmt(txAmt)}
                </span>
              </div>
            </div>
          )}

          {/* LEDGER & BAKI BALANCE BREAKDOWN BLOCK (REQUIREMENT #6, #7, #8, #9, #13) */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs">
            
            {/* Cash Sale Layout */}
            {mode === 'cash_sale' && (
              <>
                <div className="flex justify-between items-center text-slate-300 font-medium">
                  <span>Payment Amount:</span>
                  <span className="font-black text-emerald-400">{fmt(txAmt)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <div>
                    <span className="font-black text-white text-sm">Payment Status:</span>
                    <div className="mt-0.5">
                      <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-black text-[10px] uppercase">
                        ✓ PAID IN FULL
                      </span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-emerald-400">
                    Remaining Due: {fmt(currentBalance)}
                  </span>
                </div>
              </>
            )}

            {/* Credit Sale Layout */}
            {mode === 'credit_sale' && (
              <>
                {details?.paid_amount && details.paid_amount > 0 ? (
                  <div className="flex justify-between items-center text-slate-300 font-medium">
                    <span>Paid Now / Down Payment:</span>
                    <span className="font-black text-emerald-400">{fmt(details.paid_amount)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between items-center text-slate-300 font-medium">
                  <span>New Purchase Due:</span>
                  <span className="font-black text-rose-400">{fmt(details?.new_due_amount || txAmt)}</span>
                </div>

                {/* Requirement #6: Show Previous Due (0 if first transaction) */}
                <div className="flex justify-between items-center text-slate-400 font-semibold pb-1 border-b border-slate-800">
                  <span>Previous Due:</span>
                  <span className="font-black text-slate-200 text-sm">{fmt(prevBalance)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <div>
                    <span className="font-black text-white text-sm">Total Outstanding Due:</span>
                  </div>
                  <span className="text-2xl font-black text-rose-400">
                    {fmt(currentBalance)}
                  </span>
                </div>
              </>
            )}

            {/* Payment Received / Due Clearance Layout */}
            {mode === 'due_payment' && (
              <>
                <div className="flex justify-between items-center text-slate-400 font-semibold pb-1 border-b border-slate-800">
                  <span>Previous Due:</span>
                  <span className="font-black text-slate-200 text-sm">{fmt(prevBalance)}</span>
                </div>

                <div className="flex justify-between items-center text-emerald-400 font-extrabold">
                  <span>Payment Received:</span>
                  <span className="font-black text-emerald-400">-{fmt(txAmt)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <div>
                    <span className="font-black text-white text-sm">Remaining Due:</span>
                    <div className="text-[10px] font-extrabold uppercase mt-0.5">
                      {isFullyPaid ? (
                        <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-black">
                          ✓ PAID / DUE CLEARED
                        </span>
                      ) : (
                        <span className="bg-rose-500 text-white px-2 py-0.5 rounded font-black">
                          ⚠️ DUE REMAINING
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-2xl font-black ${currentBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fmt(currentBalance)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* NOTE BLOCK */}
          {noteText && (
            <div className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              📝 Note: {noteText}
            </div>
          )}

          {/* FOOTER & AUTHORIZED SIGNATURE (REQUIREMENT #16 & #17) */}
          <div className="flex items-end justify-between pt-3 border-t border-slate-200">
            <div className="space-y-1">
              <div className="flex items-center text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-600 shrink-0" />
                <span>Smart Khata • Business Invoice</span>
              </div>
              <p className="text-[11px] text-slate-500 font-bold">Thank you for your business!</p>
            </div>

            {shop.signature_url && (
              <div className="text-right">
                <img
                  src={shop.signature_url}
                  alt="Signature"
                  crossOrigin="anonymous"
                  className="h-12 max-h-12 object-contain ml-auto"
                />
                <p className="text-[10px] text-slate-600 font-black uppercase tracking-wider mt-0.5 border-t border-slate-300 pt-0.5">
                  Authorized Signature
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ACTION CONTROLS BAR (PRINT, PDF, WHATSAPP, IMAGE) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5 print:hidden">
          {/* Primary Action: Send on WhatsApp */}
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleShareNativeOrDownload}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>Send on WhatsApp</span>
              </>
            )}
          </button>

          {/* Multi Control Action Grid */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="py-2.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 shadow-xs transition-colors disabled:opacity-50 min-w-0"
              title="Download 4K Receipt Image"
            >
              <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Image</span>
            </button>

            <button
              onClick={() => printTransactionReceiptPDF(transaction, customer, shop, language, transactions)}
              className="py-2.5 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 shadow-xs transition-colors min-w-0"
              title="Download Printable PDF Invoice"
            >
              <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 shadow-xs transition-colors min-w-0"
            >
              <Printer className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="truncate">Print</span>
            </button>

            <button
              onClick={handleCopyText}
              className="py-2.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 shadow-xs transition-colors min-w-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-slate-600 shrink-0" />}
              <span className="truncate">{copied ? 'Done' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
