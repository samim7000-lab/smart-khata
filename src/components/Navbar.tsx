import React, { useState } from 'react';
import { Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import { isDevMode } from '../lib/supabase';
import { Store, Globe, LogOut, Code2, UserCog, Sparkles, Building2 } from 'lucide-react';

interface Props {
  shop: Shop;
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onOpenSubscriptions?: () => void;
  onOpenShops?: () => void;
  userEmail?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
}

export const Navbar: React.FC<Props> = ({
  shop,
  currentLanguage,
  onLanguageChange,
  onOpenProfile,
  onLogout,
  onOpenSubscriptions,
  onOpenShops,
  userEmail,
  userName,
  userAvatarUrl,
}) => {
  const t = translations[currentLanguage];
  const [showLangMenu, setShowLangMenu] = useState(false);

  const planTier = (shop.plan_tier || 'free').toUpperCase();

  const langOptions: { code: Language; label: string }[] = [
    { code: 'bn', label: 'বাংলা' },
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
  ];

  return (
    <header className="bg-blue-600 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onClick={onOpenShops || onOpenProfile}
          className="flex items-center space-x-3 text-left hover:opacity-90 transition-opacity min-w-0 flex-1 pr-2"
          title="Switch Shop / Edit Profile"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm relative overflow-hidden shrink-0 border border-white/20">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt="Google Profile"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <Store className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 min-w-0">
              <h1 className="font-extrabold text-base leading-tight tracking-tight truncate">
                {shop.shop_name}
              </h1>

              {/* Plan Badge */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenSubscriptions) onOpenSubscriptions();
                }}
                className="bg-yellow-400 text-slate-950 font-black text-[9px] uppercase px-1.5 py-0.5 rounded cursor-pointer hover:bg-yellow-300 transition-colors shrink-0 shadow-sm"
              >
                {planTier}
              </span>

              {isDevMode && (
                <span className="bg-amber-400 text-amber-950 font-black text-[9px] uppercase px-1.5 py-0.5 rounded flex items-center tracking-wider shrink-0 shadow-sm">
                  <Code2 className="w-2.5 h-2.5 mr-0.5" />
                  DEV
                </span>
              )}
            </div>
            
            {/* Authenticated Account Identity Subtext */}
            <div className="flex items-center space-x-1 min-w-0">
              <p className="text-xs text-blue-100 font-medium truncate">
                {shop.owner_name}
              </p>
              {userEmail && (
                <span className="text-[10px] text-blue-200 font-normal truncate shrink">
                  • {userEmail}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center space-x-1.5">
          {/* Shop Switcher Button */}
          {onOpenShops && (
            <button
              onClick={onOpenShops}
              className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-all text-white"
              title="My Shops & Outlets"
            >
              <Building2 className="w-4 h-4" />
            </button>
          )}

          {/* Upgrade Plan Button */}
          {onOpenSubscriptions && (
            <button
              onClick={onOpenSubscriptions}
              className="p-1.5 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 rounded-lg transition-all border border-yellow-400/30"
              title="Upgrade Subscription Plan"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}

          {/* Profile / Settings Button */}
          <button
            onClick={onOpenProfile}
            className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-all text-white"
            title={t.profile_title}
          >
            <UserCog className="w-4 h-4" />
          </button>

          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center space-x-1 bg-white/15 hover:bg-white/25 px-2 py-1.5 rounded-lg text-xs font-bold transition-all border border-white/20"
              title={t.change_lang}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="uppercase">{currentLanguage}</span>
            </button>

            {showLangMenu && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 z-40 text-slate-800 dark:text-white animate-in fade-in slide-in-from-top-2">
                {langOptions.map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => {
                      onLanguageChange(opt.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between ${
                      currentLanguage === opt.code ? 'text-blue-600 bg-blue-50/50 dark:bg-slate-700' : 'text-slate-700 dark:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {currentLanguage === opt.code && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-1.5 bg-white/15 hover:bg-red-500/80 rounded-lg transition-all text-white"
            title={t.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
