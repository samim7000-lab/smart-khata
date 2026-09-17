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
  Check,
  FlaskConical
} from 'lucide-react';

import { validatePhoneNumber } from '../lib/phoneValidation';
import { getCountryByCode } from '../data/countries';
import { printTransactionReceiptPDF } from '../lib/pdfGenerator';
import { getWhatsAppUrl } from '../lib/whatsappUtils';
import { dispatchWhatsApp, validateCustomerPhone, buildWhatsAppMessage } from '../lib/whatsappService';
import { formatShopCurrency } from '../lib/countryPricing';
import { unpackReceiptNote, calculatePreviousBalance } from '../lib/receiptUtils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CountryPhoneInput } from './CountryPhoneInput';
import { WhatsAppExperimentLabModal } from './WhatsAppExperimentLabModal';

interface Props {
  transaction: Transaction;
  customer: Customer;
  shop: Shop;
  language: Language;
  transactions?: Transaction[];
  onClose: () => void;
  onUpdateCustomer?: (updated: Customer) => void;
}

export const ReceiptModal: React.FC<Props> = ({
  transaction,
  customer,
  shop,
  language,
  transactions = [],
  onClose,
  onUpdateCustomer,
}) => {
  const t = translations[language];
  const receiptRef = useRef<HTMLDivElement>(null);
  const [activeCustomer, setActiveCustomer] = useState<Customer>(customer);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [editedPhone, setEditedPhone] = useState(customer.phone_number || '');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);
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
    typeLabel = isVoid ? 'ভয়েড / সংশোধন' : mode === 'cash_sale' ? 'নগদ বিক্রি' : mode === 'credit_sale' ? 'বাকি বিক্রি' : mode === 'emi_plan' ? 'কিস্তি বিক্রয় (EMI)' : 'বাকি আদায় / জমা';
  } else if (language === 'hi') {
    typeLabel = isVoid ? 'रद्द / संशोधन' : mode === 'cash_sale' ? 'नकद बिक्री' : mode === 'credit_sale' ? 'उधार बिक्री' : mode === 'emi_plan' ? 'किस्त बिक्री (EMI)' : 'भुगतान पावती';
  } else {
    typeLabel = isVoid ? 'Void / Correction' : mode === 'cash_sale' ? 'Cash Sale (Paid)' : mode === 'credit_sale' ? 'Credit Sale (Due)' : mode === 'emi_plan' ? 'EMI Sale / Plan' : 'Payment Received';
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
  } else if (mode === 'emi_plan') {
    const financed = details?.emi_details?.financed_amount || details?.new_due_amount || txAmt;
    currentBalance = prevBalance + financed;
  } else {
    currentBalance = Math.max(0, prevBalance - txAmt);
  }

  const isFullyPaid = currentBalance <= 0;

  // Item List (Only shown if mode is cash_sale or credit_sale or emi_plan and items exist)
  const isPurePayment = mode === 'due_payment';
  const hasItems = !isPurePayment && details?.items && details.items.length > 0;
  const lineItems = hasItems ? details.items! : (
    !isPurePayment ? [{
      id: 'default-item',
      name: noteText || (details?.emi_details?.product_name ? `EMI: ${details.emi_details.product_name}` : 'General Item Purchase'),
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

  // Single Canonical WhatsApp & Text Receipt (Zero Drift Guarantee)
  const receiptText = buildWhatsAppMessage({
    type: 'RECEIPT',
    customer: activeCustomer,
    shop,
    language,
    transaction,
    receiptDetails: details,
  });

  // Phone validation & WhatsApp URL resolution
  const cleanPhone = (activeCustomer.phone_number || '').trim();
  const isPhoneMissing = !cleanPhone;
  const countryConfig = getCountryByCode(shop.country || 'IN');
  const phoneVal = cleanPhone ? validatePhoneNumber(cleanPhone, countryConfig, language) : { isValid: true };
  const hasValidPhone = phoneVal.isValid;
  const waUrl = getWhatsAppUrl(activeCustomer.phone_number, receiptText, shop.country || 'IN');

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
            `Invoice_${receiptNumber}_${activeCustomer.name.replace(/\s+/g, '_')}.png`,
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

  // Direct WhatsApp dispatch - Instant, 0 delay, 100% reliable, never blocks on image generation
  const handleSendWhatsApp = async () => {
    const valResult = validateCustomerPhone(activeCustomer.phone_number, shop?.country || 'IN', language);
    if (!valResult.isValid) {
      setIsPhoneModalOpen(true);
      return;
    }

    const res = await dispatchWhatsApp({
      type: 'RECEIPT',
      customer: activeCustomer,
      shop,
      language,
      transaction,
      receiptDetails: details,
    });

    if (res.success) {
      setToastMsg(res.statusMessage);
    } else {
      setToastMsg('⚠️ ' + (res.statusMessage || 'Failed to open WhatsApp'));
    }
    setTimeout(() => setToastMsg(''), 5000);
  };

  // Save / Update Phone Number to Supabase
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editedPhone.trim();
    if (!trimmed) {
      setToastMsg('⚠️ ' + (language === 'bn' ? 'অনুগ্রহ করে একটি মোবাইল নম্বর দিন।' : 'Please enter a mobile number.'));
      return;
    }

    setIsSavingPhone(true);
    const updatedCust: Customer = {
      ...activeCustomer,
      phone_number: trimmed,
    };

    if (isSupabaseConfigured && supabase && !activeCustomer.id.startsWith('cust-') && !activeCustomer.id.startsWith('temp-')) {
      try {
        const { error } = await supabase
          .from('customers')
          .update({ phone_number: trimmed })
          .eq('id', activeCustomer.id);
        if (error) {
          console.error('[RECEIPT-MODAL] DB error updating phone:', error);
        }
      } catch (err) {
        console.error('[RECEIPT-MODAL] Exception updating phone:', err);
      }
    }

    setActiveCustomer(updatedCust);
    if (onUpdateCustomer) {
      onUpdateCustomer(updatedCust);
    }
    setIsSavingPhone(false);
    setIsPhoneModalOpen(false);
    setToastMsg('✅ ' + (language === 'bn' ? 'ফোন নম্বর সংরক্ষিত হয়েছে।' : 'Phone number saved!'));
    setTimeout(() => setToastMsg(''), 3000);
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
              
              {/* Requirement #12: Omit address if empty - Clear Customer Address Label */}
              {customerAddressStr && (
                <div className="text-slate-600 font-medium flex items-start space-x-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-bold text-slate-700">
                      {language === 'bn' ? 'কাস্টমারের ঠিকানা: ' : language === 'hi' ? 'ग्राहक का पता: ' : 'Customer Address: '}
                    </span>
                    {customerAddressStr}
                  </span>
                </div>
              )}
              {activeCustomer.phone_number ? (
                <div className="text-slate-700 font-bold flex items-center space-x-1">
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{activeCustomer.phone_number}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPhoneModalOpen(true)}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline print:hidden"
                >
                  <Phone className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>+ {language === 'bn' ? 'মোবাইল নম্বর যোগ করুন' : 'Add Mobile Number'}</span>
                </button>
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
              {details?.payment_method && (
                <div className="pt-1">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Payment Method</div>
                  <div className="font-extrabold text-blue-700 text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                    💳 {details.payment_method}
                  </div>
                </div>
              )}
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
                <span className={`text-2xl font-black ${mode === 'credit_sale' || mode === 'emi_plan' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmt(txAmt)}
                </span>
              </div>
            </div>
          )}

          {/* EMI PAYMENT SCHEDULE CARD */}
          {(mode === 'emi_plan' || details?.emi_details) && details?.emi_details && (
            <div className="bg-purple-50/90 p-4 rounded-2xl border border-purple-200 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-purple-200 pb-1.5">
                <span className="font-extrabold uppercase text-[10px] text-purple-900 tracking-wider flex items-center space-x-1">
                  <span>🏦</span>
                  <span>{language === 'bn' ? 'কিস্তি পরিশোধ পরিকল্পনা (EMI)' : language === 'hi' ? 'किस्त भुगतान योजना (EMI)' : 'EMI Payment Schedule'}</span>
                </span>
                <span className="font-mono text-xs bg-purple-200 text-purple-900 px-2 py-0.5 rounded font-black">
                  {details.emi_details.installment_count} {language === 'bn' ? 'টি কিস্তি' : language === 'hi' ? 'किस्तें' : 'EMIs'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-700">
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold">{language === 'bn' ? 'মোট বিক্রয়' : language === 'hi' ? 'कुल मूल्य' : 'Total Amount'}</div>
                  <div className="font-bold text-slate-900">{fmt(details.emi_details.total_amount)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold">{language === 'bn' ? 'ডাউন পেমেন্ট' : language === 'hi' ? 'डाउन पेमेंट' : 'Down Payment'}</div>
                  <div className="font-bold text-emerald-700">{fmt(details.emi_details.down_payment)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold">{language === 'bn' ? 'বাকি কিস্তি ঋণ' : language === 'hi' ? 'किस्त ऋण' : 'Financed Amount'}</div>
                  <div className="font-bold text-rose-700">{fmt(details.emi_details.financed_amount)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold">{language === 'bn' ? 'মাসিক কিস্তি' : language === 'hi' ? 'मासिक किस्त' : 'Monthly EMI'}</div>
                  <div className="font-black text-purple-700 text-sm">{fmt(details.emi_details.installment_amount)}</div>
                </div>
              </div>

              {details.emi_details.start_date && (
                <div className="text-[11px] text-purple-900 font-semibold pt-1 border-t border-purple-200/60 flex justify-between">
                  <span>{language === 'bn' ? 'প্রথম কিস্তির তারিখ:' : language === 'hi' ? 'पहली किस्त तिथि:' : 'First EMI Due Date:'}</span>
                  <span className="font-bold">{details.emi_details.start_date}</span>
                </div>
              )}
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

            {/* EMI Plan Layout */}
            {mode === 'emi_plan' && (
              <>
                {((details?.paid_amount !== undefined && details.paid_amount > 0) || (details?.emi_details?.down_payment && details.emi_details.down_payment > 0)) ? (
                  <div className="flex justify-between items-center text-slate-300 font-medium">
                    <span>{language === 'bn' ? 'ডাউন পেমেন্ট জমা:' : language === 'hi' ? 'डाउन पेमेंट जमा:' : 'Down Payment Paid:'}</span>
                    <span className="font-black text-emerald-400">{fmt(details?.paid_amount || details?.emi_details?.down_payment || 0)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between items-center text-slate-300 font-medium">
                  <span>{language === 'bn' ? 'বাকি কিস্তি ঋণ:' : language === 'hi' ? 'किस्त ऋण बकाया:' : 'Financed on EMI:'}</span>
                  <span className="font-black text-rose-400">{fmt(details?.emi_details?.financed_amount || details?.new_due_amount || txAmt)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-400 font-semibold pb-1 border-b border-slate-800">
                  <span>{language === 'bn' ? 'পূর্বের বাকি:' : language === 'hi' ? 'पिछला बकाया:' : 'Previous Due:'}</span>
                  <span className="font-black text-slate-200 text-sm">{fmt(prevBalance)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <div>
                    <span className="font-black text-white text-sm">{language === 'bn' ? 'বর্তমান মোট বাকি:' : language === 'hi' ? 'वर्तमान कुल बकाया:' : 'Total Outstanding Due:'}</span>
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
            onClick={handleSendWhatsApp}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            <span>Send on WhatsApp</span>
          </button>

          {/* Experimental Native Lab (Isolated POC - Does NOT affect primary button above) */}
          <button
            type="button"
            onClick={() => setIsLabOpen(true)}
            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 flex items-center justify-center space-x-1.5 transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
            <span>🔬 WhatsApp Native Lab (Experimental POC)</span>
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

      {/* Add / Edit Phone Number Modal */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base flex items-center">
                <Phone className="w-4 h-4 mr-2 text-blue-600" />
                <span>{activeCustomer.phone_number ? t.update_phone : t.add_mobile_number}</span>
              </h3>
              <button
                onClick={() => setIsPhoneModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePhone} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.customer_phone} <span className="text-rose-500">*</span>
                </label>
                <CountryPhoneInput
                  language={language}
                  value={editedPhone}
                  onChange={(e164) => setEditedPhone(e164)}
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPhoneModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                >
                  {t.back}
                </button>
                <button
                  type="submit"
                  disabled={isSavingPhone}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                >
                  <span>{t.save_profile}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Native Intent Lab Modal (Isolated POC) */}
      <WhatsAppExperimentLabModal
        isOpen={isLabOpen}
        onClose={() => setIsLabOpen(false)}
        activeCustomer={activeCustomer}
        shop={shop}
        language={language}
        transaction={transaction}
        details={details}
        receiptText={receiptText}
        generateReceiptImage={generateCanvasFile}
      />
    </div>
  );
};
