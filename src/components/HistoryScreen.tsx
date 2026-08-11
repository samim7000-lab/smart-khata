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
    const q = searchQuery.toLowerCase();

    // 1. Search Query Match
    const matchesSearch =
      custName.toLowerCase().includes(q) ||
      custPhone.includes(q) ||
      tx.id.toLowerCase().includes(q) ||
      (tx.note && tx.note.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // 2. Type Filter Match
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

    // 3. Customer Filter Match
    if (selectedCustomerId !== 'all' && tx.customer_id !== selectedCustomerId) return false;

    // 4. Date Filter Match
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
    <div className="min-h-screen bg-slate-50 max-w-4xl mx-auto p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/30">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">{t.transaction_history}</h1>
            <p className="text-xs text-slate-500 font-medium">{filteredTransactions.length} records</p>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_placeholder}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:bg-white focus:border-blue-600"
          />
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Time Filter */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              {t.date_filter}
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-600"
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
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              {t.tx_type_filter}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-600"
            >
              <option value="all">{t.all}</option>
              <option value="credit_given">{t.credit_given}</option>
              <option value="payment_received">{t.payment_received}</option>
              <option value="void_correction">{t.void_correction}</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              {t.select_customer}
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-600"
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
          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium outline-none"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium outline-none"
            />
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-500">{t.no_history_found}</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const cust = getCustomer(tx.customer_id);
            const isCredit = tx.type === 'credit_given';
            const isVoid = tx.type === 'void_correction' || tx.is_voided;

            return (
              <div
                key={tx.id}
                className={`p-4 rounded-3xl border-2 transition-all bg-white shadow-sm space-y-3 ${
                  isVoid
                    ? 'border-slate-200 bg-slate-50/70 opacity-80'
                    : isCredit
                    ? 'border-red-100 hover:border-red-200'
                    : 'border-green-100 hover:border-green-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1 pr-1">
                    <div className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="truncate max-w-[180px] sm:max-w-none">{cust?.display_label || 'Unknown Customer'}</span>
                      {isVoid && <span className="badge-void shrink-0">{t.void_correction}</span>}
                    </div>

                    <div className="text-xs text-slate-500 font-medium flex items-center space-x-2 flex-wrap text-[11px]">
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
                          ? 'text-slate-500 line-through'
                          : isCredit
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {isVoid ? '' : isCredit ? '-' : '+'}{formatShopCurrency(Number(tx.amount), shop?.country, shop?.currency_code)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">ID: {tx.id.slice(-6)}</div>
                  </div>
                </div>

                {tx.note && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 italic font-medium">
                    📝 {tx.note}
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
