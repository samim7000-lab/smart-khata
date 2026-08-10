import React, { useState } from 'react';
import { Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import {
  Store,
  X,
  CheckCircle2,
  Plus,
  Building2,
  Trash2,
  Edit2,
  MapPin,
  Check,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface Props {
  shops: Shop[];
  activeShopId: string;
  language: Language;
  onClose: () => void;
  onSwitchShop: (shopId: string) => void;
  onCreateShop: (shopName: string, ownerName: string) => void;
  onDeleteShop: (shopId: string) => void;
}

export const ShopsModal: React.FC<Props> = ({
  shops,
  activeShopId,
  language,
  onClose,
  onSwitchShop,
  onCreateShop,
  onDeleteShop,
}) => {
  const t = translations[language];
  const [isCreating, setIsCreating] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) return;
    onCreateShop(newShopName.trim(), newOwnerName.trim() || 'Owner');
    setSuccessMsg(`🏬 Shop "${newShopName}" created successfully!`);
    setNewShopName('');
    setNewOwnerName('');
    setIsCreating(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-blue-600 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tight">My Shops & Outlets</h3>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Switch or add shop branches for multi-outlet management
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

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-4 py-3 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          {!isCreating ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Active Shop List ({shops.length})
                </h4>
                <button
                  onClick={() => setIsCreating(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-600/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Shop</span>
                </button>
              </div>

              {/* Shop List */}
              <div className="space-y-3">
                {shops.map((s, idx) => {
                  const isActive = s.id === activeShopId;
                  return (
                    <div
                      key={s.id}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                        isActive
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/50 shadow-md'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h5 className="font-extrabold text-slate-900 dark:text-white text-base">
                              {s.shop_name}
                            </h5>
                            {isActive && (
                              <span className="bg-blue-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                            {idx === 0 && (
                              <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[9px] uppercase px-1.5 py-0.5 rounded-md">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Owner: {s.owner_name} • Currency: {s.currency_code || 'BDT'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isActive ? (
                          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                            <Check className="w-5 h-5" />
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              onSwitchShop(s.id);
                              setSuccessMsg(`Switched active shop to "${s.shop_name}"`);
                              setTimeout(() => setSuccessMsg(''), 3000);
                            }}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 rounded-xl text-xs font-extrabold transition-colors"
                          >
                            Switch
                          </button>
                        )}

                        {shops.length > 1 && idx > 0 && (
                          <button
                            onClick={() => onDeleteShop(s.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors"
                            title="Delete Shop"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Inline Form to Create New Shop */
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
                  Add New Shop Outlet
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Shop / Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder="e.g. Smart Khata Branch #2"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Shopkeeper / Owner Name
                </label>
                <input
                  type="text"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder="e.g. Mohammad Rahim"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all"
              >
                <span>Create & Switch to Shop</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Multi-Shop Isolation • Customer Ledgers Separated Per Branch</span>
          </div>
        </div>
      </div>
    </div>
  );
};
