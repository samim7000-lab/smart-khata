import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { translations } from '../i18n/translations';
import { SmartKhataLogo } from './SmartKhataLogo';
import { Globe2, CheckCircle2 } from 'lucide-react';

interface Props {
  currentLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
}

export const LanguageSelector: React.FC<Props> = ({ currentLanguage, onSelectLanguage }) => {
  const t = translations[currentLanguage];

  // Dynamic rotating greeting text array across supported languages
  const greetings: { lang: string; text: string; tagline: string }[] = [
    { lang: 'en', text: 'Welcome 👋', tagline: 'Smart Digital Udhar Ledger' },
    { lang: 'bn', text: 'স্বাগতম 👋', tagline: 'ডিজিটাল বাকি খাতা' },
    { lang: 'hi', text: 'नमस्ते 👋', tagline: 'डिजिटल उधारी बहीखाता' },
  ];

  const [greetingIndex, setGreetingIndex] = useState(0);
  const [fadeState, setFadeState] = useState(true);

  // Auto-rotate greeting every 2.5 seconds with smooth fade
  useEffect(() => {
    const timer = setInterval(() => {
      setFadeState(false);
      setTimeout(() => {
        setGreetingIndex((prev) => (prev + 1) % greetings.length);
        setFadeState(true);
      }, 200);
    }, 2600);

    return () => clearInterval(timer);
  }, []);

  const languages: { code: Language; title: string; subtitle: string; flag: string }[] = [
    { code: 'en', title: 'English', subtitle: 'English', flag: '🇬🇧' },
    { code: 'bn', title: 'বাংলা', subtitle: 'Bangla', flag: '🇧🇩' },
    { code: 'hi', title: 'हिन्दी', subtitle: 'Hindi', flag: '🇮🇳' },
  ];

  const activeGreeting = greetings[greetingIndex];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white flex flex-col justify-between p-4 max-w-md mx-auto">
      <div className="pt-8 text-center">
        {/* Premium Million-Dollar Logo */}
        <div className="mb-4">
          <SmartKhataLogo size="xl" className="shadow-2xl" />
        </div>

        {/* Dynamic Rotating Greeting Banner */}
        <div className="h-16 flex flex-col items-center justify-center">
          <div
            className={`transition-all duration-300 transform ${
              fadeState ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
            }`}
          >
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeGreeting.text}
            </h1>
            <p className="text-blue-600 dark:text-blue-400 font-extrabold text-xs uppercase tracking-wider mt-0.5">
              Smart Khata • {activeGreeting.tagline}
            </p>
          </div>
        </div>

        {/* Language Selection Card */}
        <div className="mt-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 text-left space-y-4">
          <div className="flex items-center space-x-2.5 text-blue-600 dark:text-blue-400">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl">
              <Globe2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                Select Your Language
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">
                Choose your preferred language to continue
              </p>
            </div>
          </div>

          {/* Three Large Cards: 🇬🇧 English, 🇧🇩 বাংলা, 🇮🇳 हिन्दी */}
          <div className="space-y-3 pt-2">
            {languages.map((item) => {
              const isSelected = currentLanguage === item.code;
              return (
                <button
                  key={item.code}
                  onClick={() => onSelectLanguage(item.code)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left group ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/60 shadow-md scale-[1.01]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-2xl shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      <span role="img" aria-label={item.title}>
                        {item.flag}
                      </span>
                    </div>
                    <div>
                      <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {item.title}
                      </div>
                      <div className="text-xs font-bold text-slate-400 dark:text-slate-400 mt-0.5">{item.subtitle}</div>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pb-6 text-center text-xs text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center space-x-1">
        <span>🔒 100% Safe & Secure Digital Ledger</span>
      </div>
    </div>
  );
};
