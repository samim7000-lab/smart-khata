import React from 'react';
import { Customer, Language, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import {
  ArrowLeft,
  Phone,
  PlusCircle,
  MinusCircle,
  Clock,
  Send,
  Calendar
} from 'lucide-react';

import { formatShopCurrency } from '../lib/countryPricing';
import { printCustomerStatementPDF } from '../lib/pdfGenerator';

interface Props {
  customer: Customer;
  transactions: Transaction[];
  shop: Shop;
  language: Language;
  onBack: () => void;
  onOpenAddTx: (type?: 'credit_given' | 'payment_received') => void;
  onSelectReceiptTx: (tx: Transaction) => void;
}

export const CustomerDetail: React.FC<Props> = ({
  customer,
  transactions,
  shop,
  language,
  onBack,
  onOpenAddTx,
  onSelectReceiptTx,
}) => {
  const t = translations[language];
  const balance = customer.balance || 0;
  const owesMoney = balance > 0;

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
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="font-extrabold text-lg leading-tight">{customer.display_label}</h1>
              <p className="text-xs text-slate-400 flex items-center mt-0.5">
                <Phone className="w-3 h-3 mr-1" />
                <span>{customer.phone_number}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => printCustomerStatementPDF(customer, transactions, shop, language)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center space-x-1 transition-colors"
          >
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 pb-20">
        {/* Balance Card */}
        <div
          className={`p-6 rounded-3xl text-center border-2 shadow-sm ${
            owesMoney
              ? 'bg-red-50 border-red-200 text-red-900'
              : balance === 0
              ? 'bg-slate-100 border-slate-200 text-slate-800'
              : 'bg-green-50 border-green-200 text-green-900'
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
                ? 'bg-red-200 text-red-800'
                : balance === 0
                ? 'bg-slate-200 text-slate-700'
                : 'bg-green-200 text-green-800'
            }`}
          >
            {owesMoney ? t.owe_money : balance === 0 ? t.all_settled : t.paid_up}
          </div>
        </div>

        {/* AI Recovery Insight Card */}
        {owesMoney && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:bg-slate-800/80 p-4 rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-xs space-y-1.5">
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

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onOpenAddTx('credit_given')}
            className="py-3.5 px-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-red-600/20 flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98]"
          >
            <MinusCircle className="w-5 h-5" />
            <span>+ {t.credit_given}</span>
          </button>

          <button
            onClick={() => onOpenAddTx('payment_received')}
            className="py-3.5 px-3 bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-5 h-5" />
            <span>+ {t.payment_received}</span>
          </button>
        </div>

        {/* Transaction History Section */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-base mb-4 border-b border-slate-100 pb-3">
            <Clock className="w-5 h-5 text-blue-600" />
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
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            isCredit ? 'bg-red-600' : 'bg-green-600'
                          }`}
                        />
                        <span className="font-extrabold text-sm text-slate-900">
                          {isCredit ? t.credit_given : t.payment_received}
                        </span>
                      </div>

                      {tx.note && (
                        <div className="text-xs text-slate-600 font-medium pl-4">
                          📝 {tx.note}
                        </div>
                      )}

                      <div className="flex items-center text-[11px] text-slate-400 font-medium pl-4">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{formatDate(tx.created_at)}</span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end space-y-2">
                      <div
                        className={`text-lg font-black ${
                          isCredit ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {isCredit ? '-' : '+'}{formatShopCurrency(Number(tx.amount), shop?.country, shop?.currency_code)}
                      </div>

                      <button
                        onClick={() => onSelectReceiptTx(tx)}
                        className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        <Send className="w-3 h-3" />
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
    </div>
  );
};
