import React from 'react';
import { Language, PlanTier } from '../types';
import { translations } from '../i18n/translations';
import { Sparkles, X, CheckCircle2, ShieldCheck, ArrowRight, Lock } from 'lucide-react';

interface Props {
  featureName: string;
  requiredTier?: PlanTier;
  language: Language;
  onClose: () => void;
  onOpenSubscriptions: () => void;
}

export const UpgradeModal: React.FC<Props> = ({
  featureName,
  requiredTier = 'pro',
  language,
  onClose,
  onOpenSubscriptions,
}) => {
  const t = translations[language];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 text-center">
        {/* Top Header Glow */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md shadow-inner">
            <Lock className="w-8 h-8 text-yellow-300 animate-bounce" />
          </div>
          <span className="bg-yellow-400 text-slate-950 font-black text-[10px] uppercase px-3 py-1 rounded-full tracking-wider">
            Premium Feature
          </span>
          <h3 className="font-black text-2xl tracking-tight mt-2">
            Unlock {featureName}
          </h3>
          <p className="text-xs text-blue-100 font-medium mt-1">
            This feature requires a <span className="font-extrabold uppercase text-yellow-300">{requiredTier}</span> subscription plan
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl text-left space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-extrabold text-sm mb-1">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>What's included in Pro Plan:</span>
            </div>
            <div className="flex items-center text-slate-700 dark:text-slate-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
              <span>Unlimited Customers & Transactions</span>
            </div>
            <div className="flex items-center text-slate-700 dark:text-slate-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
              <span>AI OCR Paper Ledger Page Scanner</span>
            </div>
            <div className="flex items-center text-slate-700 dark:text-slate-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
              <span>Multi-Shop Branches & Staff Permissions</span>
            </div>
            <div className="flex items-center text-slate-700 dark:text-slate-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
              <span>Branded PDF & WhatsApp Image Receipts</span>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenSubscriptions();
            }}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-base rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <span>Upgrade to Pro Now</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center justify-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cancel anytime • Instant activation</span>
          </p>
        </div>
      </div>
    </div>
  );
};
