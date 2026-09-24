import React, { useState } from 'react';
import { Customer, Language, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import {
  History,
  Search,
  Filter,
  Calendar,
  MessageCircle,
  AlertCircle,
  FileCheck2,
  Ban,
  X,
  CheckCircle2,
  Loader2,
  ChevronDown
} from 'lucide-react';

import { formatShopCurrency } from '../lib/countryPricing';
import { unpackReceiptNote, cleanNoteString } from '../lib/receiptUtils';

interface Props {
  transactions: Transaction[];
  customers: Customer[];
  shop: Shop;
  language: Language;
  onSelectReceiptTx: (tx: Transaction, customer: Customer) => void;
  onVoidTransaction: (originalTx: Transaction, reason: string) => Promise<void>;
}

export const HistoryScreen: React.FC<Props> = ({
  transactions,
  customers,
  shop,
  language,
  onSelectReceiptTx,
  onVoidTransaction,
}) => {
  const t = translations[language];

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'sales' | 'payments' | 'emi' | 'gst'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit_given' | 'payment_received' | 'void_correction'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Void Modal State
  const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);

  const getCustomer = (id: string) => customers.find((c) => c.id === id);

  // Date Filter Logic
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const filteredTransactions = transactions.filter((tx) => {
    const cust = getCustomer(tx.customer_id);
    const custName = cust?.name || '';
    const custPhone = cust?.phone_number || '';
    const q = searchQuery.toLowerCase().trim();

    const { noteText, details } = unpackReceiptNote(tx);
    const cleanNote = noteText || (tx.note ? cleanNoteString(tx.note) : '');

    // 1. Search Query Match (Guaranteed clean of raw JSON leakage)
    if (q) {
      const matchesSearch =
        custName.toLowerCase().includes(q) ||
        custPhone.includes(q) ||
        tx.id.toLowerCase().includes(q) ||
        cleanNote.toLowerCase().includes(q) ||
        (details?.invoice_number && details.invoice_number.toLowerCase().includes(q));

      if (!matchesSearch) return false;
    }

    // 2. Structured Category Filter (All, Sales, Payments, EMI, GST Invoices)
    if (categoryFilter === 'sales') {
      const isSale = tx.type === 'credit_given' || details?.mode === 'cash_sale' || details?.mode === 'credit_sale';
      if (!isSale) return false;
    } else if (categoryFilter === 'payments') {
      const isPay = tx.type === 'payment_received' || details?.mode === 'due_payment';
      if (!isPay) return false;
    } else if (categoryFilter === 'emi') {
      const isEmi = details?.mode === 'emi_plan' || Boolean(details?.emi_details) || /emi/i.test(cleanNote);
      if (!isEmi) return false;
    } else if (categoryFilter === 'gst') {
      const isGst = Boolean(
        (tx.tax_amount && tx.tax_amount > 0) ||
        details?.gst_enabled ||
        details?.cgst_amount ||
        details?.sgst_amount ||
        details?.igst_amount ||
        details?.document_type === 'tax_invoice' ||
        details?.document_type === 'bill_of_supply'
      );
      if (!isGst) return false;
    }

    // 3. Type Filter Match
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

    // 4. Customer Filter Match
    if (selectedCustomerId !== 'all' && tx.customer_id !== selectedCustomerId) return false;

    // 5. Date Filter Match
    const txTime = new Date(tx.created_at).getTime();
    if (dateFilter === 'today' && txTime < todayStart) return false;
    if (dateFilter === 'week' && txTime < weekStart) return false;
    if (dateFilter === 'month' && txTime < monthStart) return false;
    if (dateFilter === 'custom') {
      if (startDate && txTime < new Date(startDate).getTime()) return false;
      if (endDate && txTime > new Date(endDate).getTime() + 86400000) return false;
    }

    return true;
  });

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingTx || !voidReason.trim()) return;

    setIsSubmittingVoid(true);
    try {
      await onVoidTransaction(voidingTx, voidReason.trim());
      setVoidingTx(null);
      setVoidReason('');
    } catch (err: any) {
      alert('Error recording void entry: ' + err.message);
    } finally {
      setIsSubmittingVoid(false);
    }
  };

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 max-w-4xl mx-auto p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/30">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">{t.transaction_history}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{filteredTransactions.length} records</p>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_placeholder}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 caret-blue-600 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold outline-none focus:border-blue-600 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Structured Category Filter Chips (Requirement #6) */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: t.all || 'All' },
            { id: 'sales', label: language === 'bn' ? 'বিক্রি' : language === 'hi' ? 'बिक्री' : 'Sales' },
            { id: 'payments', label: language === 'bn' ? 'আদায় / জমা' : language === 'hi' ? 'भुगतान' : 'Payments' },
            { id: 'emi', label: 'EMI' },
            { id: 'gst', label: language === 'bn' ? 'জিএসটি ইনভয়েস' : language === 'hi' ? 'जीएसटी बिल' : 'GST Invoices' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setCategoryFilter(chip.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all shrink-0 ${
                categoryFilter === chip.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Time Filter */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t.date_filter}
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option value="all">{t.all_time}</option>
              <option value="today">{t.today}</option>
              <option value="week">{t.this_week}</option>
              <option value="month">{t.this_month}</option>
              <option value="custom">{t.custom_range}</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t.tx_type_filter}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option value="all">{t.all}</option>
              <option value="credit_given">{t.credit_given}</option>
              <option value="payment_received">{t.payment_received}</option>
              <option value="void_correction">{t.void_correction}</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t.select_customer}
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option value="all">{t.all} ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900"
            />
            <span className="text-xs text-slate-400 font-semibold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t.no_history_found}</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const cust = getCustomer(tx.customer_id);
            const isCredit = tx.type === 'credit_given';
            const isVoid = tx.type === 'void_correction' || tx.is_voided;
            const { noteText, details } = unpackReceiptNote(tx);

            return (
              <div
                key={tx.id}
                className={`p-4 rounded-3xl border-2 transition-all bg-white dark:bg-slate-800 shadow-sm space-y-3 ${
                  isVoid
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 opacity-80'
                    : isCredit
                    ? 'border-red-100 dark:border-red-900/60 hover:border-red-200'
                    : 'border-green-100 dark:border-green-900/60 hover:border-green-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1 pr-1">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm sm:text-base flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="truncate max-w-[180px] sm:max-w-none">{cust?.display_label || 'Unknown Customer'}</span>
                      {isVoid && <span className="badge-void shrink-0">{t.void_correction}</span>}
                      {details?.payment_method && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 shrink-0">
                          💳 {details.payment_method}
                        </span>
                      )}
                      {Boolean((tx.tax_amount && tx.tax_amount > 0) || details?.gst_enabled) && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 shrink-0">
                          GST
                        </span>
                      )}
                      {(details?.mode === 'emi_plan' || Boolean(details?.emi_details)) && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800 shrink-0">
                          EMI
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center space-x-2 flex-wrap text-[11px]">
                      <span>{cust?.phone_number}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                        {formatDate(tx.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-lg sm:text-xl font-black ${
                        isVoid
                          ? 'text-slate-500 dark:text-slate-400 line-through'
                          : isCredit
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {isVoid ? '' : isCredit ? '-' : '+'}{formatShopCurrency(Number(tx.amount), shop?.country, shop?.currency_code)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">ID: {tx.id.slice(-6)}</div>
                  </div>
                </div>

                {noteText && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 italic font-medium">
                    📝 {noteText}
                  </div>
                )}

                {isVoid && tx.void_reason && (
                  <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200 font-semibold flex items-center space-x-1.5">
                    <Ban className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Correction Reason: {tx.void_reason}</span>
                  </div>
                )}

                {/* Card Action Row */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  {cust && !isVoid ? (
                    <button
                      onClick={() => onSelectReceiptTx(tx, cust)}
                      className="inline-flex items-center space-x-1 font-extrabold text-emerald-700 hover:underline"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>{t.send_again}</span>
                    </button>
                  ) : <div />}

                  {!isVoid && (
                    <button
                      onClick={() => setVoidingTx(tx)}
                      className="inline-flex items-center space-x-1 font-bold text-slate-500 hover:text-red-600 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{t.void_transaction}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reversible Void / Correction Modal */}
      {voidingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-amber-600">
                <Ban className="w-6 h-6" />
                <h3 className="font-extrabold text-lg text-slate-900">{t.void_transaction}</h3>
              </div>
              <button onClick={() => setVoidingTx(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-amber-900 text-xs font-semibold">
              ⚠️ {t.void_notice}
            </div>

            <form onSubmit={handleConfirmVoid} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.void_reason} <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.void_reason_placeholder}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium focus:bg-white focus:border-blue-600 outline-none"
                  autoFocus
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidingTx(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
                >
                  {t.back}
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingVoid || !voidReason.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-sm shadow-lg shadow-red-600/30 flex items-center justify-center space-x-1 disabled:opacity-50"
                >
                  {isSubmittingVoid ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>{t.confirm_void}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
