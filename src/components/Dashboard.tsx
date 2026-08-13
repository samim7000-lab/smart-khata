import React, { useState, useMemo } from 'react';
import { Customer, Language, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import {
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Phone,
  AlertCircle,
  TrendingUp,
  Clock,
  Send,
  UserPlus,
  Camera,
  Sparkles
} from 'lucide-react';

import { formatShopCurrency } from '../lib/countryPricing';

interface Props {
  shop: Shop;
  customers: Customer[];
  transactions: Transaction[];
  language: Language;
  onSelectCustomer: (customer: Customer) => void;
  onOpenAddTx: () => void;
  onOpenScanLedger: () => void;
  onSelectReceiptTx: (tx: Transaction, customer: Customer) => void;
  onNavigateTab: (tab: 'customers' | 'history' | 'reports') => void;
}

export const Dashboard: React.FC<Props> = ({
  shop,
  customers,
  transactions,
  language,
  onSelectCustomer,
  onOpenAddTx,
  onOpenScanLedger,
  onSelectReceiptTx,
  onNavigateTab,
}) => {
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState('');

  // Compute stats with useMemo optimization
  const totalOwed = useMemo(() => {
    return customers.reduce((acc, c) => {
      const bal = c.balance || 0;
      return bal > 0 ? acc + bal : acc;
    }, 0);
  }, [customers]);

  const totalCollected = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'payment_received' && !tx.is_voided)
      .reduce((acc, tx) => acc + Number(tx.amount), 0);
  }, [transactions]);

  const totalCreditGiven = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'credit_given' && !tx.is_voided)
      .reduce((acc, tx) => acc + Number(tx.amount), 0);
  }, [transactions]);

  const recoveryRate = useMemo(() => {
    if (totalCreditGiven <= 0) return transactions.length > 0 ? 100 : 0;
    return Math.min(100, Math.round((totalCollected / totalCreditGiven) * 100));
  }, [totalCreditGiven, totalCollected, transactions.length]);

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 4);
  }, [transactions]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone_number.includes(q) ||
        c.display_label.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col max-w-4xl mx-auto p-4 pb-24 space-y-4 transition-colors">
      {/* Network & Offline Status Banner */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-1.5 text-[11px] font-bold">
          <span className={`w-2.5 h-2.5 rounded-full ${navigator.onLine ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-slate-500 dark:text-slate-400">
            {navigator.onLine ? 'Cloud Synced & Online 🟢' : 'Offline Mode (Saved Locally) 🟡'}
          </span>
        </div>
      </div>

      {/* Top Financial Overview Grid */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Total Udhar Card (Soft Coral / Alert) */}
        <div className="bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-200/80 dark:border-rose-900/60 rounded-3xl p-4.5 shadow-sm text-rose-950 dark:text-rose-100 flex flex-col justify-between backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold text-rose-700 dark:text-rose-300 tracking-wider">
              {t.total_due}
            </span>
            <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/60 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-300 shadow-xs">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3.5 space-y-0.5">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-rose-700 dark:text-rose-300 tabular-nums">
              {formatShopCurrency(totalOwed, shop?.country, shop?.currency_code)}
            </div>
            <div className="text-[11px] font-bold text-rose-600/90 dark:text-rose-400">
              {customers.filter((c) => (c.balance || 0) > 0).length} {t.owe_money}
            </div>
          </div>
        </div>

        {/* Total Collected Card (Crisp Emerald / Growth) */}
        <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-200/80 dark:border-emerald-900/60 rounded-3xl p-4.5 shadow-sm text-emerald-950 dark:text-emerald-100 flex flex-col justify-between backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold text-emerald-700 dark:text-emerald-300 tracking-wider">
              {t.total_collected}
            </span>
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-300 shadow-xs">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3.5 space-y-0.5">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatShopCurrency(totalCollected, shop?.country, shop?.currency_code)}
            </div>
            <div className="text-[11px] font-bold text-emerald-600/90 dark:text-emerald-400">{t.paid_up}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider pl-1">
          {t.quick_actions}
        </span>
        <div className="flex items-center space-x-2">
          <button
            disabled={true}
            className="flex-1 sm:flex-none px-2.5 sm:px-3.5 py-2 bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 font-extrabold text-xs rounded-xl shadow-none flex items-center justify-center space-x-1.5 cursor-not-allowed opacity-75 min-w-0"
            title="AI Handwriting Scanner Coming Soon"
          >
            <Camera className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">🚧 AI Scanner - Soon</span>
          </button>

          <button
            onClick={onOpenAddTx}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center space-x-1 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{t.add_new_transaction}</span>
          </button>
        </div>
      </div>

      {/* Recent Activity Log */}
      {recentTransactions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
            <h2 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center">
              <Clock className="w-4 h-4 mr-1.5 text-blue-600 dark:text-blue-400" />
              Recent Activity
            </h2>
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All History →
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {recentTransactions.map((tx) => {
              const cust = customers.find((c) => c.id === tx.customer_id);
              const isCredit = tx.type === 'credit_given';
              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {cust?.display_label || 'Customer'}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                      {isCredit ? t.credit_given : t.payment_received} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`font-black text-base ${
                        isCredit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {isCredit ? '-' : '+'}{formatShopCurrency(Number(tx.amount), shop?.country, shop?.currency_code)}
                    </span>

                    {cust && (
                      <button
                        onClick={() => onSelectReceiptTx(tx, cust)}
                        className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                        title={t.send_whatsapp}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer Directory Quick Search */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
            {t.total_customers} ({customers.length})
          </h2>
          <button
            onClick={() => onNavigateTab('customers')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            See All Customers →
          </button>
        </div>

        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_placeholder}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-600 outline-none text-sm font-semibold shadow-sm transition-all"
          />
        </div>

        <div className="space-y-2">
          {filteredCustomers.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-700 shadow-sm">
              <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-500 mx-auto mb-2" />
              <div className="text-slate-500 dark:text-slate-300 font-bold text-sm">{t.no_customer_found}</div>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">{t.add_customer_prompt}</p>
            </div>
          ) : (
            filteredCustomers.slice(0, 6).map((customer) => {
              const bal = customer.balance || 0;
              const owesMoney = bal > 0;

              return (
                <div
                  key={customer.id}
                  onClick={() => onSelectCustomer(customer)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between shadow-sm bg-white dark:bg-slate-800 ${
                    owesMoney
                      ? 'border-red-100 dark:border-red-950/60 hover:border-red-200 dark:hover:border-red-900'
                      : 'border-green-100 dark:border-green-950/60 hover:border-green-200 dark:hover:border-green-900'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-extrabold text-slate-900 dark:text-white text-base">{customer.display_label}</div>
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium space-x-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{customer.phone_number}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div
                        className={`text-lg font-black tracking-tight ${
                          owesMoney ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {formatShopCurrency(Math.abs(bal), shop?.country, shop?.currency_code)}
                      </div>
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          owesMoney ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {owesMoney ? t.owe_money : t.paid_up}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
