import React, { useState } from 'react';
import { Language, PlanTier, Shop } from '../types';
import { translations } from '../i18n/translations';
import { SUBSCRIPTION_PLANS } from '../lib/subscription';
import { getCountryPricing } from '../lib/countryPricing';
import { EntitlementService } from '../lib/entitlementEngine';
import { PaymentService } from '../lib/paymentEngine';
import {
  Sparkles,
  X,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Check,
  ArrowRight,
  Star,
  Activity,
  CreditCard
} from 'lucide-react';

interface Props {
  shop: Shop;
  language: Language;
  currentTier?: PlanTier;
  onClose: () => void;
  onSelectPlan: (tier: PlanTier) => void;
}

export const SubscriptionModal: React.FC<Props> = ({
  shop,
  language,
  currentTier = 'free',
  onClose,
  onSelectPlan,
}) => {
  const t = translations[language];
  const activePlanTier = shop.plan_tier || currentTier || 'free';
  const countryPricing = getCountryPricing(shop.country);
  const entitlements = EntitlementService.getEntitlements(shop);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  const plans = [
    {
      tier: 'free' as PlanTier,
      name: 'FREE PLAN',
      priceFormatted: countryPricing.plans.free.priceFormatted,
      pricePeriod: 'Forever Free',
      recipientLimitText: '50 recipients / campaign',
      isRecommended: false,
      features: ['50 campaign recipients', '200 transactions/mo', 'PDF export', 'Basic ledger', 'AI Recovery preview'],
    },
    {
      tier: 'pro' as PlanTier,
      name: 'PRO PLAN',
      priceFormatted: countryPricing.plans.pro.priceFormatted,
      pricePeriod: '/ month',
      recipientLimitText: '500 recipients / campaign',
      isRecommended: true,
      features: ['500 campaign recipients ⭐', 'Top 15 AI recovery priorities/wk', 'Unlimited transactions', 'OCR Scanner', 'Multi-shop (3 outlets)', 'Staff roles (5 users)'],
    },
    {
      tier: 'business' as PlanTier,
      name: 'BUSINESS PLAN',
      priceFormatted: countryPricing.plans.business.priceFormatted,
      pricePeriod: '/ month',
      recipientLimitText: '5,000 recipients (High-Volume)',
      isRecommended: false,
      features: ['5,000 campaign recipients 🚀', 'Top 100 AI recovery priorities/wk', 'Unlimited transactions', 'OCR Scanner', 'Multi-shop (10 outlets)', 'Meta Cloud API support'],
    },
  ];

  const handleUpgrade = async (tier: PlanTier) => {
    if (tier === 'free') {
      onSelectPlan(tier);
      setSuccessMsg(`Switched to Free Plan.`);
      return;
    }

    setLoadingTier(tier);
    setErrorMsg('');
    try {
      await PaymentService.initiateSubscriptionCheckout(
        shop,
        tier,
        (updatedShop) => {
          onSelectPlan(tier);
          setLoadingTier(null);
          setSuccessMsg(`🎉 Successfully upgraded to ${SUBSCRIPTION_PLANS[tier].name}!`);
          setTimeout(() => setSuccessMsg(''), 5000);
        },
        (err) => {
          setLoadingTier(null);
          setErrorMsg(err || 'Payment process was cancelled or failed.');
        }
      );
    } catch (err: any) {
      setLoadingTier(null);
      setErrorMsg(err.message || 'Payment initiation failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-xl tracking-tight">WhatsApp Campaign & Subscription Plans</h3>
                <span className="bg-yellow-400 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider">
                  {countryPricing.countryName} ({countryPricing.currencySymbol})
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Select recipients & send targeted WhatsApp campaigns according to your plan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-4 py-3 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 px-4 py-3 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <X className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body: Plans Grid */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">
          {/* Real-time Usage Dashboard Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 dark:text-slate-200">
              <div className="flex items-center space-x-1.5">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>Current SaaS Account Usage</span>
              </div>
              <span className="uppercase text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full font-black">
                {entitlements.planName}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 min-w-0">
                <div className="text-slate-400 font-medium truncate">Campaign Limit</div>
                <div className="font-black text-slate-900 dark:text-white mt-0.5 truncate">
                  {entitlements.campaignRecipientLimit} / campaign
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 min-w-0">
                <div className="text-slate-400 font-medium truncate">AI Recovery Quota</div>
                <div className="font-black text-slate-900 dark:text-white mt-0.5 truncate">
                  {entitlements.weeklyAiQuota === 0 ? 'Preview Only' : `${entitlements.weeklyAiQuota} / week`}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 min-w-0">
                <div className="text-slate-400 font-medium truncate">Meta Cloud API</div>
                <div className="font-black text-amber-600 dark:text-amber-400 mt-0.5 truncate">Not Connected</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 min-w-0">
                <div className="text-slate-400 font-medium truncate">Auto Dispatch</div>
                <div className="font-black text-slate-500 mt-0.5 truncate">OFF</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = activePlanTier === plan.tier;
              const isLoading = loadingTier === plan.tier;
              return (
                <div
                  key={plan.tier}
                  className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between relative ${
                    plan.isRecommended
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/50 shadow-xl scale-[1.02]'
                      : isCurrent
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-blue-300'
                  }`}
                >
                  {plan.isRecommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] uppercase px-3 py-1 rounded-full flex items-center shadow-md border border-yellow-200">
                      <Star className="w-3 h-3 mr-1 fill-slate-950" />
                      RECOMMENDED
                    </span>
                  )}

                  {isCurrent && (
                    <span className="absolute top-4 right-4 bg-emerald-600 text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded-full flex items-center shadow-xs">
                      <Check className="w-3 h-3 mr-0.5" />
                      Active
                    </span>
                  )}

                  <div className="space-y-3 pt-1">
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-base tracking-tight">
                        {plan.name}
                      </h4>
                      <div className="flex items-baseline space-x-1 mt-1">
                        <span className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                          {plan.priceFormatted}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {plan.pricePeriod}
                        </span>
                      </div>
                    </div>

                    {/* Campaign Recipient Limit Badge */}
                    <div className="bg-slate-100 dark:bg-slate-700/80 p-3 rounded-2xl text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center justify-between border border-slate-200 dark:border-slate-600">
                      <span>Campaign Limit:</span>
                      <span className="text-blue-600 dark:text-blue-400 font-black">{plan.recipientLimitText}</span>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2 pt-1">
                      {plan.features.map((feat) => (
                        <div key={feat} className="flex items-center text-xs text-slate-700 dark:text-slate-300 font-semibold">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 mt-2">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs rounded-xl cursor-default flex items-center justify-center space-x-1"
                      >
                        <Check className="w-4 h-4" />
                        <span>Current Active Plan</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.tier)}
                        disabled={isLoading}
                        className={`w-full py-3 font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98] ${
                          plan.isRecommended
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/40'
                            : 'bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {isLoading ? (
                          <span>Processing Payment...</span>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-1" />
                            <span>Upgrade to {plan.name}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Razorpay & Payment Gateway Integration Foundation • Secure Server Verification Architecture</span>
          </div>
        </div>
      </div>
    </div>
  );
};
