import React from 'react';
import { Customer, Language, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import {
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Share2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

import { printMonthlyBusinessReportPDF } from '../lib/pdfGenerator';
import { FileCheck2 } from 'lucide-react';
import { formatShopCurrency } from '../lib/countryPricing';

interface Props {
  customers: Customer[];
  transactions: Transaction[];
  shop: Shop;
  language: Language;
}

export const ReportsScreen: React.FC<Props> = ({
  customers,
  transactions,
  shop,
  language,
}) => {
  const t = translations[language];
  const fmt = (amt: number) => formatShopCurrency(amt, shop?.country, shop?.currency_code);

  // Calculate Key Metrics
  const totalOwed = customers.reduce((acc, c) => {
    const bal = c.balance || 0;
    return bal > 0 ? acc + bal : acc;
  }, 0);

  const totalCollected = transactions
    .filter((tx) => tx.type === 'payment_received' && !tx.is_voided)
    .reduce((acc, tx) => acc + Number(tx.amount), 0);

  const totalCreditGiven = transactions
    .filter((tx) => tx.type === 'credit_given' && !tx.is_voided)
    .reduce((acc, tx) => acc + Number(tx.amount), 0);

  const recoveryRate =
    totalCreditGiven > 0
      ? Math.min(100, Math.round((totalCollected / totalCreditGiven) * 100))
      : 100;

  // Top Customers by Due Amount
  const topDueCustomers = [...customers]
    .filter((c) => (c.balance || 0) > 0)
    .sort((a, b) => (b.balance || 0) - (a.balance || 0))
    .slice(0, 5);

  const handleShareReport = () => {
    const reportText = `📊 *${shop.shop_name.toUpperCase()} - BUSINESS REPORT*
📅 Date: ${new Date().toLocaleDateString()}
----------------------------
🔴 Total Udhar Owed: ${fmt(totalOwed)}
🟢 Total Collected: ${fmt(totalCollected)}
📈 Recovery Rate: ${recoveryRate}%
👥 Customers with Dues: ${customers.filter((c) => (c.balance || 0) > 0).length}
----------------------------
Thank you! - ${shop.owner_name}`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(reportText)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 max-w-4xl mx-auto p-4 pb-24 space-y-5 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/30">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">{t.reports_title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{shop.shop_name}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => printMonthlyBusinessReportPDF(shop, customers, transactions, language as any)}
            className="inline-flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-colors"
            title="Download PDF Business Report"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>PDF</span>
          </button>

          <button
            onClick={handleShareReport}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>{t.download_report}</span>
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-extrabold text-red-600 uppercase tracking-wider flex items-center justify-between">
            <span>{t.total_due}</span>
            <ArrowUpRight className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {fmt(totalOwed)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-extrabold text-green-600 uppercase tracking-wider flex items-center justify-between">
            <span>{t.total_collected}</span>
            <ArrowDownLeft className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {fmt(totalCollected)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider flex items-center justify-between">
            <span>{t.recovery_rate}</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{recoveryRate}%</div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span>{t.total_customers}</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900">{customers.length}</div>
        </div>
      </div>

      {/* Visual Analytics Chart Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
          {t.business_summary} (Credit vs Collection)
        </h2>

        {/* Custom SVG Bar Comparison */}
        <div className="space-y-3 pt-2">
          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-red-600">{t.credit_given}:</span>
              <span className="text-slate-900">{fmt(totalCreditGiven)}</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${totalCreditGiven > 0 ? 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-green-600">{t.payment_received}:</span>
              <span className="text-slate-900">{fmt(totalCollected)}</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    totalCreditGiven > 0
                      ? Math.min(100, Math.round((totalCollected / totalCreditGiven) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Due Customers List */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center justify-between">
          <span>{t.top_due_customers}</span>
          <span className="text-xs font-bold text-slate-400">{topDueCustomers.length} Listed</span>
        </h2>

        {topDueCustomers.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 font-medium">
            All customer accounts are clear! 🎉
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {topDueCustomers.map((cust, idx) => (
              <div key={cust.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm">{cust.display_label}</div>
                    <div className="text-[11px] text-slate-500">{cust.phone_number}</div>
                  </div>
                </div>

                <div className="text-right font-black text-red-600 text-base">
                  {fmt(cust.balance || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
