import React from 'react';
import { Language } from '../types';
import { translations } from '../i18n/translations';
import { SmartKhataLogo } from './SmartKhataLogo';
import { ShieldCheck, MessageSquare, ArrowRight, CheckCircle2 } from 'lucide-react';

interface Props {
  language: Language;
  onContinue: () => void;
}

export const WelcomeScreen: React.FC<Props> = ({ language, onContinue }) => {
  const t = translations[language];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 max-w-md mx-auto">
      <div className="pt-8 text-center space-y-6">
        {/* Brand Logo & Icon */}
        <div className="flex justify-center">
          <SmartKhataLogo size="xl" className="shadow-2xl" />
        </div>

        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t.welcome_title}</h1>
          <p className="text-slate-500 font-medium text-sm mt-2 px-4">{t.welcome_subtitle}</p>
        </div>

        {/* Key Feature Benefits List */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-left space-y-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-9 h-9 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm">{t.welcome_benefit1}</div>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm">{t.welcome_benefit2}</div>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm">{t.welcome_benefit3}</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="pb-6 space-y-3">
        <button
          onClick={onContinue}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
        >
          <span>{t.get_started}</span>
          <ArrowRight className="w-6 h-6" />
        </button>

        <div className="text-center text-xs text-slate-400 font-medium">
          {t.trusted_tagline}
        </div>
      </div>
    </div>
  );
};
