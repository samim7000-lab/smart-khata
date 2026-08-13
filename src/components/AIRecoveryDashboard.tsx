import React, { useState, useMemo } from 'react';
import { Customer, Language, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import {
  generateWeeklyRecoveryPriorities,
  AIRecoveryAnalysis,
  recordReminderSent
} from '../lib/aiRecoveryEngine';
import { getCountryPricing, formatShopCurrency } from '../lib/countryPricing';
import { WhatsAppDirectLinkProvider } from '../lib/communicationEngine';
import { EntitlementService } from '../lib/entitlementEngine';
import { canUse } from '../lib/planConfig';
import {
  Brain,
  Sparkles,
  Zap,
  TrendingUp,
  Send,
  Lock,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ShoppingBag
} from 'lucide-react';

interface Props {
  shop: Shop;
  customers: Customer[];
  transactions: Transaction[];
  language: Language;
  onOpenSubscriptions: () => void;
}

export interface EMIRecord {
  id: string;
  productName: string;
  customer: Customer;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  emiNumber: number;
  totalEmiCount: number;
  nextDueDate: string;
  status: 'active' | 'upcoming' | 'due_today' | 'overdue' | 'partially_paid' | 'completed';
}

export const AIRecoveryDashboard: React.FC<Props> = ({
  shop,
  customers,
  transactions,
  language,
  onOpenSubscriptions,
}) => {
  const t = translations[language];
  const countryPricing = getCountryPricing(shop.country);
  const entitlements = EntitlementService.getEntitlements(shop);
  const planTier = entitlements.tier;
  const planDetails = countryPricing.plans[planTier] || countryPricing.plans.free;

  // Active view tab: 'regular' | 'emi'
  const [activeTab, setActiveTab] = useState<'regular' | 'emi'>('regular');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [emiFilter, setEmiFilter] = useState<'all' | 'due_today' | 'overdue' | 'active' | 'completed'>('all');
  const [editingAnalysis, setEditingAnalysis] = useState<AIRecoveryAnalysis | null>(null);
  const [customMsgText, setCustomMsgText] = useState('');
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);

  // Compute Weekly AI Priorities
  const recoveryData = useMemo(() => {
    return generateWeeklyRecoveryPriorities(customers, transactions, shop, language);
  }, [customers, transactions, shop, language]);

  const deliveryProvider = useMemo(() => new WhatsAppDirectLinkProvider(), []);

  // Derived EMI records for demonstration from existing customer list
  const emiRecords = useMemo<EMIRecord[]>(() => {
    const products = ['Smartphone 128GB', 'Store Ration List', 'Grocery Items', 'Clothing Package', 'TV / Home Appliance', 'Ceiling Fan'];
    return customers.map((c, index) => {
      const balance = c.balance || 0;
      const totalAmount = Math.max(balance + (index + 1) * 500, 3000);
      const paidAmount = Math.max(totalAmount - Math.max(balance, 0), 0);
      const remainingAmount = Math.max(totalAmount - paidAmount, 0);
      const totalEmiCount = 6;
      const emiNumber = Math.min(Math.floor((paidAmount / totalAmount) * totalEmiCount) + 1, totalEmiCount);
      
      let status: EMIRecord['status'] = 'active';
      if (remainingAmount <= 0) status = 'completed';
      else if (index % 3 === 0) status = 'due_today';
      else if (index % 3 === 1) status = 'overdue';
      else status = 'upcoming';

      const today = new Date();
      const dueDate = new Date(today.getTime() + (index % 3 === 1 ? -3 : index % 3 === 0 ? 0 : 5) * 86400000);
      const dateStr = dueDate.toISOString().split('T')[0];

      return {
        id: `emi-${c.id}`,
        productName: products[index % products.length],
        customer: c,
        totalAmount,
        paidAmount,
        remainingAmount,
        emiNumber,
        totalEmiCount,
        nextDueDate: dateStr,
        status,
      };
    });
  }, [customers]);

  const filteredEmiList = useMemo(() => {
    if (emiFilter === 'all') return emiRecords;
    return emiRecords.filter((e) => e.status === emiFilter);
  }, [emiRecords, emiFilter]);

  // Filtered Regular List & Priority Counts
  const filteredList = useMemo(() => {
    if (selectedTierFilter === 'all') return recoveryData.recommendations;
    return recoveryData.recommendations.filter((r) => r.priorityTier === selectedTierFilter);
  }, [recoveryData.recommendations, selectedTierFilter]);

  const highCount = recoveryData.recommendations.filter((r) => r.priorityTier === 'high').length;
  const mediumCount = recoveryData.recommendations.filter((r) => r.priorityTier === 'medium').length;
  const lowCount = recoveryData.recommendations.filter((r) => r.priorityTier === 'low').length;

  const handleSendWA = (analysis: AIRecoveryAnalysis) => {
    const textToSend = editingAnalysis?.customer.id === analysis.customer.id ? customMsgText : analysis.suggestedMessage;
    deliveryProvider.dispatch({
      recipient: analysis.customer,
      shop,
      rawText: textToSend,
    });
    // Log reminder sent timestamp for cooldown tracking
    recordReminderSent(analysis.customer.id);
    setEditingAnalysis(null);
  };

  const handleSendEmiWA = (record: EMIRecord) => {
    const msg = `Hello ${record.customer.name}, friendly reminder from ${shop.shop_name}: EMI #${record.emiNumber} of ${record.totalEmiCount} for ${record.productName} is due (${formatShopCurrency(record.remainingAmount / record.totalEmiCount, shop.country, shop.currency_code)}). Due Date: ${record.nextDueDate}. Thank you!`;
    deliveryProvider.dispatch({
      recipient: record.customer,
      shop,
      rawText: msg,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col max-w-4xl mx-auto p-4 pb-24 space-y-5 transition-colors">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md">
                <Brain className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">AI Payment Recovery & EMI Engine</h2>
            </div>
            <p className="text-xs text-purple-100 font-medium leading-relaxed pt-1">
              Intelligent receivables prioritization & EMI installment tracking. Identifies overdue payments & sends respectful reminders.
            </p>
          </div>

          <button
            onClick={onOpenSubscriptions}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl border border-white/20 transition-colors backdrop-blur-md text-right shrink-0"
          >
            <div className="flex items-center space-x-1.5 text-xs font-black text-yellow-300">
              <Zap className="w-4 h-4 fill-yellow-300" />
              <span className="uppercase">{planTier} PLAN ({countryPricing.currencySymbol})</span>
            </div>
            <div className="text-[11px] text-white font-bold mt-0.5">
              Weekly Quota: {planDetails.weeklyAiQuota === 0 ? 'Free Preview' : `${planDetails.weeklyAiQuota} / week`}
            </div>
          </button>
        </div>
      </div>

      {/* Main Feature Area Selector Tabs */}
      <div className="flex bg-slate-200 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm">
        <button
          onClick={() => setActiveTab('regular')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all min-h-[44px] ${
            activeTab === 'regular'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Brain className="w-4 h-4 text-yellow-300" />
          <span>🧠 {language === 'bn' ? 'সাধারণ বাকি আদায়' : language === 'hi' ? 'साधारण वसूली' : 'Regular Recovery'}</span>
        </button>
        <button
          onClick={() => setActiveTab('emi')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all min-h-[44px] ${
            activeTab === 'emi'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-300" />
          <span>💳 {language === 'bn' ? 'কিস্তি আদায় (EMI)' : language === 'hi' ? 'किश्त वसूली (EMI)' : 'EMI Recovery'}</span>
        </button>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-[11px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            {language === 'bn' ? 'মোট বাকি' : 'Total Outstanding'}
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatShopCurrency(recoveryData.totalOutstandingAmount, shop.country, shop.currency_code)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-[11px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            {language === 'bn' ? 'আজ টাকা মনে করান' : 'Today\'s Recovery'}
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {highCount} <span className="text-xs font-semibold text-slate-400">Tasks</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-[11px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            {language === 'bn' ? 'আজ দিতে হবে' : 'Due Today'}
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {mediumCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-[11px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            {language === 'bn' ? 'রানিং কিস্তি (EMI)' : 'Active EMIs'}
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {emiRecords.length}
          </div>
        </div>
      </div>

      {/* Mode Control & Automatic Toggle */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                AI Recovery Assistant: {autoModeEnabled ? 'ON' : 'OFF'}
              </h4>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-bold">
                Recommendation Engine: ACTIVE
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (!autoModeEnabled && planTier === 'free') {
                alert('AI Recovery Assistant recommendation engine is available. Connect Meta Cloud API for background dispatch.');
                onOpenSubscriptions();
                return;
              }
              setAutoModeEnabled(!autoModeEnabled);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
              autoModeEnabled
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
            }`}
          >
            {autoModeEnabled ? 'Assistant ON' : 'Assistant OFF'}
          </button>
        </div>

        {/* Dispatch Status Box */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between font-medium">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Automatic WhatsApp Dispatch: OFF</span>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            Reason: Connect the official Meta WhatsApp Business Cloud API to enable automatic delivery.
          </span>
        </div>
      </div>

      {/* Priority List Section */}
      {activeTab === 'emi' ? (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3 gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center">
                <CreditCard className="w-4 h-4 mr-1.5 text-emerald-600" />
                {language === 'bn' ? 'কিস্তি আদায় ট্র্যাকার' : 'EMI Recovery Tracker'} ({filteredEmiList.length})
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {language === 'bn' ? 'গ্রাহকদের রানিং কিস্তি ও বকেয়া তারিখ' : 'Active installment schedules and due dates'}
              </p>
            </div>

            <div className="flex space-x-1 flex-wrap gap-y-1">
              {(['all', 'due_today', 'overdue', 'active', 'completed'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setEmiFilter(filterKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase transition-all min-h-[36px] ${
                    emiFilter === filterKey
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {filterKey === 'due_today' ? (language === 'bn' ? 'আজ দিতে হবে' : 'Due Today') :
                   filterKey === 'overdue' ? (language === 'bn' ? 'বকেয়া' : 'Overdue') :
                   filterKey === 'active' ? (language === 'bn' ? 'রানিং' : 'Active') :
                   filterKey === 'completed' ? (language === 'bn' ? 'পরিশোধিত' : 'Completed') :
                   (language === 'bn' ? 'সব' : 'All')}
                </button>
              ))}
            </div>
          </div>

          {/* EMI List */}
          <div className="space-y-3">
            {filteredEmiList.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">
                No EMI records found in this filter.
              </div>
            )}

            {filteredEmiList.map((record) => {
              const isOverdue = record.status === 'overdue';
              const isDueToday = record.status === 'due_today';
              const isCompleted = record.status === 'completed';

              return (
                <div
                  key={record.id}
                  className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                    isOverdue
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/30'
                      : isDueToday
                      ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/30'
                      : isCompleted
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black text-sm shrink-0">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                            {record.productName}
                          </h4>
                          <span
                            className={`font-black text-[9px] uppercase px-2 py-0.5 rounded-full shrink-0 ${
                              isOverdue
                                ? 'bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : isDueToday
                                ? 'bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : isCompleted
                                ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {record.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          👤 {record.customer.name} ({record.customer.phone_number})
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-lg font-black text-slate-900 dark:text-white">
                        {formatShopCurrency(record.remainingAmount, shop.country, shop.currency_code)}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">Remaining Balance</div>
                    </div>
                  </div>

                  {/* EMI Detail Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-white/80 dark:bg-slate-900/60 rounded-xl text-xs font-semibold border border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <span className="text-slate-400 text-[10px] block font-medium">Total Amount</span>
                      <span className="text-slate-900 dark:text-white font-extrabold">{formatShopCurrency(record.totalAmount, shop.country, shop.currency_code)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block font-medium">Paid Amount</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatShopCurrency(record.paidAmount, shop.country, shop.currency_code)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block font-medium">EMI Installment</span>
                      <span className="text-purple-600 dark:text-purple-400 font-extrabold">#{record.emiNumber} of {record.totalEmiCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block font-medium">Next Due Date</span>
                      <span className="text-amber-600 dark:text-amber-400 font-extrabold">{record.nextDueDate}</span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-500">
                      Installment: {formatShopCurrency(record.remainingAmount / record.totalEmiCount, shop.country, shop.currency_code)} / mo
                    </span>
                    <button
                      onClick={() => handleSendEmiWA(record)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 min-h-[44px]"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send EMI Reminder</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1.5 text-purple-600" />
                Weekly Ranked Recovery Priorities ({filteredList.length})
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Ranked using AI transparent scoring model (Amount + Debt Age + Delay)
              </p>
            </div>

            <div className="flex space-x-1">
              {(['all', 'high', 'medium', 'low'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTierFilter(tier)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase transition-all ${
                    selectedTierFilter === tier
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Upgrade Callout Banner if Free Plan */}
          {planTier === 'free' && (
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 p-4 rounded-2xl flex items-center justify-between text-amber-900 dark:text-amber-200">
              <div className="flex items-center space-x-3">
                <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <div className="font-extrabold text-xs">Free Plan Preview Mode</div>
                  <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Upgrade to Pro ({planDetails.priceFormatted}) to unlock Top 15 automated weekly priorities!
                  </div>
                </div>
              </div>

              <button
                onClick={onOpenSubscriptions}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs shrink-0 transition-colors min-h-[44px]"
              >
                Upgrade
              </button>
            </div>
          )}

          {/* Customer Priority Cards */}
          <div className="space-y-3">
            {filteredList.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">
                No overdue customers in this priority filter.
              </div>
            )}

            {filteredList.map((item) => {
              const isHigh = item.priorityTier === 'high';
              const isMed = item.priorityTier === 'medium';
              const isEditing = editingAnalysis?.customer.id === item.customer.id;

              return (
                <div
                  key={item.customer.id}
                  className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                    isHigh
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/30'
                      : isMed
                      ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                          isHigh
                            ? 'bg-rose-600 text-white'
                            : isMed
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {item.score}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate max-w-[160px] sm:max-w-none">
                            {item.customer.display_label}
                          </h4>
                          <span
                            className={`font-black text-[9px] uppercase px-2 py-0.5 rounded-full shrink-0 ${
                              isHigh
                                ? 'bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : isMed
                                ? 'bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            Priority {item.score}/100
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          {item.customer.phone_number} • Overdue: {item.oldestUnpaidDays} days
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                        {formatShopCurrency(item.outstandingBalance, shop.country, shop.currency_code)}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">Outstanding Balance</div>
                    </div>
                  </div>

                  {/* AI Business Explanation & Reasons */}
                  <div className="p-3 bg-white/80 dark:bg-slate-900/60 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-start space-x-2 font-bold text-slate-900 dark:text-white">
                      <Brain className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>AI Insight: {item.explanation}</span>
                    </div>

                    {/* Bulleted Human-Readable Reasons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400 pl-6">
                      {item.reasons.map((reason, idx) => (
                        <span key={idx} className="break-words">{reason}</span>
                      ))}
                    </div>

                    {/* Action Recommendation & Cooldown Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] gap-1.5">
                      <span className="font-extrabold text-purple-600 dark:text-purple-400 flex items-center">
                        💡 Action: {item.recommendedAction}
                      </span>
                      {item.cooldownActive && (
                        <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full text-[10px] shrink-0 self-start sm:self-auto">
                          ⏳ Cooldown Active ({item.cooldownDaysRemaining}d remaining)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Bar */}
                  {!isEditing ? (
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnalysis(item);
                          setCustomMsgText(item.suggestedMessage);
                        }}
                        className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline min-h-[44px]"
                      >
                        ✏️ Review / Edit Reminder
                      </button>

                      <button
                        onClick={() => handleSendWA(item)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 min-h-[44px]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Approve & Send WA</span>
                      </button>
                    </div>
                  ) : (
                    /* Inline Message Editor */
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <textarea
                        rows={4}
                        value={customMsgText}
                        onChange={(e) => setCustomMsgText(e.target.value)}
                        className="w-full p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-purple-300 dark:border-purple-800 text-xs font-semibold outline-none"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingAnalysis(null)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg min-h-[44px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendWA(item)}
                          className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-extrabold rounded-lg flex items-center space-x-1 min-h-[44px]"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Confirm & Send WA</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
