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
import {
  Brain,
  Sparkles,
  Zap,
  TrendingUp,
  Send,
  Lock
} from 'lucide-react';

import { EntitlementService } from '../lib/entitlementEngine';

interface Props {
  shop: Shop;
  customers: Customer[];
  transactions: Transaction[];
  language: Language;
  onOpenSubscriptions: () => void;
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

  const [selectedTierFilter, setSelectedTierFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [editingAnalysis, setEditingAnalysis] = useState<AIRecoveryAnalysis | null>(null);
  const [customMsgText, setCustomMsgText] = useState('');
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);

  // Compute Weekly AI Priorities
  const recoveryData = useMemo(() => {
    return generateWeeklyRecoveryPriorities(customers, transactions, shop, language);
  }, [customers, transactions, shop, language]);

  const deliveryProvider = useMemo(() => new WhatsAppDirectLinkProvider(), []);

  // Filtered List
  const filteredList = useMemo(() => {
    if (selectedTierFilter === 'all') return recoveryData.recommendations;
    return recoveryData.recommendations.filter((r) => r.priorityTier === selectedTierFilter);
  }, [recoveryData.recommendations, selectedTierFilter]);

  // Breakdown Counts
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
              <h2 className="text-2xl font-black tracking-tight">AI Payment Recovery Engine</h2>
            </div>
            <p className="text-xs text-purple-100 font-medium leading-relaxed pt-1">
              Intelligent receivables prioritization powered by ledger data. Identifies high-risk overdue customers & generates respectful WhatsApp reminders.
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

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-[11px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            Total Outstanding
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatShopCurrency(recoveryData.totalOutstandingAmount, shop.country, shop.currency_code)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-[11px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            High Priority (80+)
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {highCount} <span className="text-xs font-semibold text-slate-400">Users</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-[11px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            Medium Priority (50-79)
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {mediumCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-[11px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            Low Priority (&lt;50)
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {lowCount}
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
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs shrink-0 transition-colors"
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm ${
                        isHigh
                          ? 'bg-rose-600 text-white'
                          : isMed
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.score}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                          {item.customer.display_label}
                        </h4>
                        <span
                          className={`font-black text-[9px] uppercase px-2 py-0.5 rounded-full ${
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
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {item.customer.phone_number} • Overdue: {item.oldestUnpaidDays} days
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
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
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400 pl-6">
                    {item.reasons.map((reason, idx) => (
                      <span key={idx}>{reason}</span>
                    ))}
                  </div>

                  {/* Action Recommendation & Cooldown Badge */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="font-extrabold text-purple-600 dark:text-purple-400 flex items-center">
                      💡 Action: {item.recommendedAction}
                    </span>
                    {item.cooldownActive && (
                      <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full text-[10px]">
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
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      ✏️ Review / Edit Reminder
                    </button>

                    <button
                      onClick={() => handleSendWA(item)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
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
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendWA(item)}
                        className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-extrabold rounded-lg flex items-center space-x-1"
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
    </div>
  );
};
