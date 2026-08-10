import React from 'react';
import { Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import { isDevMode } from '../lib/supabase';
import {
  Home,
  Users,
  History,
  BarChart3,
  UserCog,
  Plus,
  Store,
  Globe,
  LogOut,
  Megaphone,
  Brain
} from 'lucide-react';

export type NavTab = 'home' | 'customers' | 'history' | 'reports' | 'ai_recovery' | 'campaigns' | 'profile';

interface Props {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  shop: Shop;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLogout: () => void;
  onOpenAddTx: () => void;
  userEmail?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
}

export const Navigation: React.FC<Props> = ({
  activeTab,
  onTabChange,
  shop,
  language,
  onLanguageChange,
  onLogout,
  onOpenAddTx,
  userEmail,
  userName,
  userAvatarUrl,
}) => {
  const t = translations[language];
  const [avatarErr, setAvatarErr] = React.useState(false);

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email && email.includes('@')) {
      return email.split('@')[0].slice(0, 2).toUpperCase();
    }
    return 'SK';
  };

  const tabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: t.nav_home, icon: <Home className="w-5 h-5" /> },
    { id: 'customers', label: t.nav_customers, icon: <Users className="w-5 h-5" /> },
    { id: 'history', label: t.nav_history, icon: <History className="w-5 h-5" /> },
    { id: 'reports', label: t.nav_reports, icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'ai_recovery', label: 'AI Recovery 🧠', icon: <Brain className="w-5 h-5 text-purple-500" /> },
    { id: 'campaigns', label: 'Campaigns 📢', icon: <Megaphone className="w-5 h-5 text-emerald-500" /> },
    { id: 'profile', label: t.nav_profile, icon: <UserCog className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* 1. MOBILE BOTTOM NAVIGATION BAR (Visible on screens < md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-40 shadow-lg">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all text-[11px] font-bold tap-target ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition-colors ${
                    isActive ? 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 scale-110' : ''
                  }`}
                >
                  {tab.icon}
                </div>
                <span className="mt-0.5 leading-tight truncate px-0.5">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 2. DESKTOP SIDEBAR NAVIGATION (Visible on screens >= md) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen sticky top-0 shrink-0 shadow-xl border-r border-slate-800">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40 shrink-0 overflow-hidden">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Store className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center space-x-1.5">
              <h2 className="font-extrabold text-base leading-tight truncate">{shop.shop_name}</h2>
              {isDevMode && (
                <span className="bg-amber-400 text-amber-950 font-black text-[9px] uppercase px-1 rounded shrink-0">
                  DEV
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium truncate">{shop.owner_name}</p>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="p-4">
          <button
            onClick={onOpenAddTx}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            <span>{t.add_new_transaction}</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Language & Authenticated Account */}
        <div className="p-4 border-t border-slate-800 space-y-3 text-xs">
          {/* Language Switcher */}
          <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
            <div className="flex items-center space-x-2 text-slate-300 font-semibold">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>{t.change_lang}:</span>
            </div>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="bg-slate-900 text-white font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none text-xs"
            >
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>

          {/* Professional Authenticated Google Account Card */}
          <div className="p-3 bg-slate-800/90 rounded-2xl border border-slate-700 space-y-2">
            <div className="flex items-center space-x-3">
              {userAvatarUrl && !avatarErr ? (
                <img
                  src={userAvatarUrl}
                  alt="Google Profile"
                  onError={() => setAvatarErr(true)}
                  className="w-10 h-10 rounded-full object-cover border border-slate-600 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {getInitials(userName || shop.owner_name, userEmail)}
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-black text-white truncate">
                  {userName || shop.owner_name || 'Merchant'}
                </div>
                {userEmail && (
                  <div className="text-[11px] font-semibold text-slate-400 truncate">
                    {userEmail}
                  </div>
                )}
                <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider mt-0.5">
                  {(shop.plan_tier || 'Free').toUpperCase()} PLAN
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-extrabold text-xs rounded-xl transition-colors border border-red-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
