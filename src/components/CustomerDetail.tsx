import React, { useState } from 'react';
import { Customer, Language, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import {
  ArrowLeft,
  Phone,
  PlusCircle,
  MinusCircle,
  Clock,
  Send,
  Calendar,
  MessageCircle,
  Download,
  MapPin,
  Check,
  AlertCircle,
  X,
  Edit3,
  CheckCircle2,
  FileText,
  FileImage
} from 'lucide-react';

import { formatShopCurrency } from '../lib/countryPricing';
import { unpackReceiptNote } from '../lib/receiptUtils';
import { printCustomerStatementPDF } from '../lib/pdfGenerator';
import { dispatchWhatsApp, generateVCard, validateCustomerPhone } from '../lib/whatsappService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLedgerPhotoSignedUrl } from '../lib/imageUtils';
import { CountryPhoneInput } from './CountryPhoneInput';
import { validateGstin, INDIAN_GST_STATES } from '../lib/gstInvoiceEngine';

interface Props {
  customer: Customer;
  transactions: Transaction[];
  shop: Shop;
  language: Language;
  onBack: () => void;
  onOpenAddTx: (type?: 'credit_given' | 'payment_received') => void;
  onSelectReceiptTx: (tx: Transaction) => void;
  onUpdateCustomer?: (updated: Customer) => void;
}

export const CustomerDetail: React.FC<Props> = ({
  customer,
  transactions,
  shop,
  language,
  onBack,
  onOpenAddTx,
  onSelectReceiptTx,
  onUpdateCustomer,
}) => {
  const t = translations[language];
  const balance = customer.balance || 0;
  const owesMoney = balance > 0;

  // Toast / Status Message State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  // Customer Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(customer.name || '');
  const [editPhone, setEditPhone] = useState(customer.phone_number || '');
  const [editAddress, setEditAddress] = useState(customer.address || '');
  const [editState, setEditState] = useState(customer.state || '');
  const [editCreditLimit, setEditCreditLimit] = useState(customer.credit_limit ? String(customer.credit_limit) : '');
  const [editGstin, setEditGstin] = useState(customer.gstin || '');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [editError, setEditError] = useState('');

  const openEditModal = () => {
    setEditName(customer.name || customer.display_label || '');
    setEditPhone(customer.phone_number || '');
    setEditAddress(customer.address || '');
    setEditState(customer.state || '');
    setEditCreditLimit(customer.credit_limit ? String(customer.credit_limit) : '');
    setEditGstin(customer.gstin || '');
    setEditError('');
    setIsEditModalOpen(true);
  };

  // Validate phone presence
  const phoneValidation = validateCustomerPhone(customer.phone_number, shop?.country || 'IN', language);
  const hasValidPhone = phoneValidation.isValid;

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Direct WhatsApp Chat Handoff
  const handleOpenWhatsAppChat = async () => {
    if (!hasValidPhone) {
      openEditModal();
      return;
    }

    const res = await dispatchWhatsApp({
      type: 'CUSTOMER_GREETING',
      customer,
      shop,
      language,
    });

    if (res.success) {
      showToast(res.statusMessage, 'success');
    } else {
      showToast(res.statusMessage || t.missing_phone_notice, 'error');
    }
  };

  // Direct Due Reminder WhatsApp Handoff
  const handleSendDueReminder = async () => {
    if (!hasValidPhone) {
      openEditModal();
      return;
    }

    const res = await dispatchWhatsApp({
      type: 'DUE_REMINDER',
      customer,
      shop,
      dueAmount: balance,
      language,
    });

    if (res.success) {
      showToast(res.statusMessage, 'success');
    } else {
      showToast(res.statusMessage || t.missing_phone_notice, 'error');
    }
  };

  // Contact Export to .vcf vCard
  const handleSaveContact = () => {
    generateVCard(customer, shop);
    showToast(t.contact_saved_notice, 'success');
  };

  // Save / Update Customer Profile with Supabase Schema-Adaptive Fallback
  const handleSaveCustomerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = editName.trim() || customer.name;
    const phoneTrimmed = editPhone.trim();

    if (editGstin.trim()) {
      const gVal = validateGstin(editGstin.trim());
      if (!gVal.isValid) {
        setEditError(gVal.error || 'Invalid GSTIN');
        return;
      }
    }

    setIsSavingCustomer(true);
    setEditError('');

    const fullUpdatePayload: any = {
      name: nameTrimmed,
      display_label: nameTrimmed,
      phone_number: phoneTrimmed,
      address: editAddress.trim() || null,
      state: editState.trim() || null,
      credit_limit: parseFloat(editCreditLimit) || 0,
      gstin: editGstin.trim().toUpperCase() || null,
    };

    if (isSupabaseConfigured && supabase && !customer.id.startsWith('cust-') && !customer.id.startsWith('temp-')) {
      try {
        let { error } = await supabase
          .from('customers')
          .update(fullUpdatePayload)
          .eq('id', customer.id);

        // Schema resilience: If extended columns are not yet in remote schema cache (PGRST204)
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
          console.warn('[CUSTOMER-UPDATE] Column missing in remote schema cache, retrying with core fields:', error.message);
          const corePayload = {
            name: nameTrimmed,
            display_label: nameTrimmed,
            phone_number: phoneTrimmed,
          };
          const retryRes = await supabase
            .from('customers')
            .update(corePayload)
            .eq('id', customer.id);
          error = retryRes.error;
        }

        if (error) {
          console.error('[CUSTOMER-UPDATE] Failed to update customer in DB:', error);
          setEditError(error.message);
          setIsSavingCustomer(false);
          return;
        }
      } catch (err: any) {
        console.error('[CUSTOMER-UPDATE] DB update exception:', err);
        setEditError(err.message || 'Database update failed');
        setIsSavingCustomer(false);
        return;
      }
    }

    const updatedCustomer: Customer = {
      ...customer,
      name: nameTrimmed,
      display_label: nameTrimmed,
      phone_number: phoneTrimmed,
      address: editAddress.trim() || undefined,
      state: editState.trim() || undefined,
      credit_limit: parseFloat(editCreditLimit) || 0,
      gstin: editGstin.trim().toUpperCase() || undefined,
    };

    if (onUpdateCustomer) {
      onUpdateCustomer(updatedCustomer);
    }

    setIsSavingCustomer(false);
    setIsEditModalOpen(false);
    showToast(
      language === 'bn'
        ? 'কাস্টমার প্রোফাইল সফলভাবে আপডেট করা হয়েছে'
        : language === 'hi'
        ? 'ग्राहक प्रोफ़ाइल सफलतापूर्वक अपडेट की गई'
        : 'Customer profile updated successfully',
      'success'
    );
  };

  // Format date helper
  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString(
      language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US',
      {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col max-w-md mx-auto transition-colors">
      {/* Header */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 sticky top-0 z-20 shadow-md border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-extrabold text-base sm:text-lg leading-tight truncate">{customer.display_label || customer.name}</h1>
              <p className="text-xs text-slate-400 flex items-center mt-0.5 truncate">
                <Phone className="w-3 h-3 mr-1 shrink-0" />
                <span className="truncate">{customer.phone_number || t.missing_phone_notice}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={openEditModal}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-700"
              title="Edit Profile"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => printCustomerStatementPDF(customer, transactions, shop, language)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center space-x-1 transition-colors"
              title="Download Statement PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Customer Address, State, Credit Limit & GSTIN Display */}
        {(customer.address || customer.state || customer.gstin || (customer.credit_limit || 0) > 0) && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300 space-y-1">
            {(customer.address || customer.state) && (
              <div className="flex items-center space-x-1 truncate">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">
                  {customer.address}
                  {customer.address && customer.state ? `, ${customer.state}` : customer.state}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px]">
              {customer.gstin && (
                <div className="font-mono text-blue-300 font-bold">
                  GSTIN: {customer.gstin}
                </div>
              )}
              {(customer.credit_limit || 0) > 0 && (
                <div className="text-emerald-400 font-bold ml-auto">
                  Limit: {formatShopCurrency(customer.credit_limit, shop?.country, shop?.currency_code)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WhatsApp & Contact Action Strip */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center gap-2 flex-wrap">
          {hasValidPhone ? (
            <>
              {/* Direct WhatsApp Chat */}
              <button
                type="button"
                onClick={handleOpenWhatsAppChat}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98] min-w-0"
              >
                <MessageCircle className="w-4 h-4 fill-current shrink-0" />
                <span className="truncate">{t.whatsapp_chat}</span>
              </button>

              {/* Optional Save Contact vCard */}
              <button
                type="button"
                onClick={handleSaveContact}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 flex items-center justify-center space-x-1.5 transition-colors shrink-0"
                title="Download contact vCard file (.vcf)"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.save_contact}</span>
              </button>
            </>
          ) : (
            /* Add Mobile Number CTA */
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition-all"
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span>{t.add_mobile_number}</span>
            </button>
          )}

          {/* Quick Edit Phone Button */}
          {hasValidPhone && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700 shrink-0"
              title={t.update_phone}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Toast Alert Banner */}
      {toastMsg && (
        <div
          className={`px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-in fade-in transition-all ${
            toastType === 'success'
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-b border-emerald-300 dark:border-emerald-800'
              : toastType === 'error'
              ? 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border-b border-rose-300 dark:border-rose-800'
              : 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 border-b border-blue-300 dark:border-blue-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {toastType === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-4 pb-20">
        {/* Balance Card */}
        <div
          className={`p-6 rounded-3xl text-center border-2 shadow-sm ${
            owesMoney
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-100'
              : balance === 0
              ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
              : 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/60 text-green-900 dark:text-green-100'
          }`}
        >
          <div className="text-xs uppercase font-extrabold tracking-wider opacity-80 mb-1">
            {t.due_amount}
          </div>
          <div className="text-4xl font-black tracking-tight">
            {formatShopCurrency(Math.abs(balance), shop?.country, shop?.currency_code)}
          </div>
          <div
            className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              owesMoney
                ? 'bg-red-200 dark:bg-red-900/80 text-red-800 dark:text-red-200'
                : balance === 0
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                : 'bg-green-200 dark:bg-green-900/80 text-green-800 dark:text-green-200'
            }`}
          >
            {owesMoney ? t.owe_money : balance === 0 ? t.all_settled : t.paid_up}
          </div>

          {/* Dedicated WhatsApp Due Reminder Button (Phase 8 Requirement) */}
          {owesMoney && (
            <div className="mt-4 pt-3 border-t border-red-200/80 dark:border-red-900/60">
              <button
                type="button"
                onClick={handleSendDueReminder}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
              >
                <MessageCircle className="w-4 h-4 fill-current shrink-0" />
                <span>{t.send_due_reminder}</span>
              </button>
            </div>
          )}
        </div>

        {/* AI Recovery Insight Card */}
        {owesMoney && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:bg-slate-900 p-4 rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-black text-purple-700 dark:text-purple-300 flex items-center">
                <span className="mr-1">🧠</span> AI Recovery Insight
              </span>
              <span className="bg-purple-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded-full">
                Priority Score
              </span>
            </div>
            <p className="text-xs text-purple-950 dark:text-purple-200 font-semibold leading-relaxed">
              {balance > 2000
                ? `High priority because ${formatShopCurrency(balance, shop?.country, shop?.currency_code)} has remained unpaid. Recommended action: Send gentle WhatsApp payment reminder.`
                : `Moderate balance of ${formatShopCurrency(balance, shop?.country, shop?.currency_code)}. Recommended action: Follow up within 7 days.`}
            </p>
          </div>
        )}

        {/* Quick Transaction Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => onOpenAddTx('credit_given')}
            className="py-3.5 px-2 sm:px-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-red-600/20 flex items-center justify-center space-x-1 sm:space-x-1.5 transition-all active:scale-[0.98] min-w-0"
          >
            <MinusCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="truncate">+ {t.credit_given}</span>
          </button>

          <button
            onClick={() => onOpenAddTx('payment_received')}
            className="py-3.5 px-2 sm:px-3 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center space-x-1 sm:space-x-1.5 transition-all active:scale-[0.98] min-w-0"
          >
            <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="truncate">+ {t.payment_received}</span>
          </button>
        </div>

        {/* Transaction History Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-extrabold text-base mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="w-5 h-5 text-blue-600 shrink-0" />
            <span>{t.transaction_history}</span>
          </div>

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              {t.no_transactions}
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isCredit = tx.type === 'credit_given';
                const { noteText, details } = unpackReceiptNote(tx);
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between space-x-2"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                            isCredit ? 'bg-red-600' : 'bg-green-600'
                          }`}
                        />
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                          {isCredit ? t.credit_given : t.payment_received}
                        </span>
                        {details?.payment_method && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 shrink-0">
                            💳 {details.payment_method}
                          </span>
                        )}
                      </div>

                      {noteText && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium pl-4 truncate">
                          📝 {noteText}
                        </div>
                      )}

                      {tx.ledger_photo_url && (
                        <div className="pl-4 pt-0.5">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (tx.ledger_photo_url) {
                                const signedUrl = await getLedgerPhotoSignedUrl(tx.ledger_photo_url);
                                window.open(signedUrl || tx.ledger_photo_url, '_blank', 'noopener,noreferrer');
                              }
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md hover:underline cursor-pointer"
                          >
                            <FileImage className="w-3 h-3" />
                            <span>Ledger Proof</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center text-[11px] text-slate-400 font-medium pl-4">
                        <Calendar className="w-3 h-3 mr-1 shrink-0" />
                        <span className="truncate">{formatDate(tx.created_at)}</span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end space-y-2 shrink-0">
                      <div
                        className={`text-base sm:text-lg font-black ${
                          isCredit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {isCredit ? '-' : '+'}{formatShopCurrency(Number(tx.amount), shop?.country, shop?.currency_code)}
                      </div>

                      <button
                        onClick={() => onSelectReceiptTx(tx)}
                        className="inline-flex items-center space-x-1 text-xs font-extrabold text-emerald-600 hover:text-emerald-700 hover:underline"
                        title={t.send_whatsapp}
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        <span>{t.send_again}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Customer Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base flex items-center">
                <Edit3 className="w-4 h-4 mr-2 text-blue-600" />
                <span>{language === 'bn' ? 'কাস্টমার প্রোফাইল সম্পাদনা' : language === 'hi' ? 'ग्राहक प्रोफ़ाइल संपादित करें' : 'Edit Customer Profile'}</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-2.5 rounded-xl font-bold flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCustomerProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  {t.customer_name} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  {t.customer_phone} <span className="text-rose-500">*</span>
                </label>
                <CountryPhoneInput
                  language={language}
                  value={editPhone}
                  onChange={(e164) => setEditPhone(e164)}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  {t.full_address} ({language === 'bn' ? 'ঐচ্ছিক' : language === 'hi' ? 'वैकल्पिक' : 'Optional'})
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Street, locality, city..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    State / Province
                  </label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    placeholder="e.g. West Bengal"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Credit Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(e.target.value)}
                    placeholder="0 = No limit"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {shop?.gst_enabled && (
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    GSTIN ({language === 'bn' ? 'ঐচ্ছিক' : language === 'hi' ? 'वैकल्पिक' : 'Optional'})
                  </label>
                  <input
                    type="text"
                    value={editGstin}
                    onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                    placeholder="15-digit GSTIN (e.g. 19AAAAA0000A1Z5)"
                    maxLength={15}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold uppercase outline-none focus:border-blue-600"
                  />
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                >
                  {t.back}
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                >
                  <span>{isSavingCustomer ? (language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : t.save_profile}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
