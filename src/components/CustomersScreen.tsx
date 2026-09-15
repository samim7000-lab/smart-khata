import React, { useState, useMemo } from 'react';
import { Customer, Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import { Users, Search, UserPlus, Phone, ChevronRight, AlertCircle, MessageCircle } from 'lucide-react';
import { formatShopCurrency } from '../lib/countryPricing';
import { dispatchWhatsApp, validateCustomerPhone } from '../lib/whatsappService';

interface Props {
  shop?: Shop;
  customers: Customer[];
  language: Language;
  onSelectCustomer: (customer: Customer) => void;
  onOpenAddTx: () => void;
}

export const CustomersScreen: React.FC<Props> = ({
  shop,
  customers,
  language,
  onSelectCustomer,
  onOpenAddTx,
}) => {
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'owes' | 'clear'>('all');

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone_number.includes(q) ||
        c.display_label.toLowerCase().includes(q);

      const bal = c.balance || 0;
      if (filterTab === 'owes') return matchesSearch && bal > 0;
      if (filterTab === 'clear') return matchesSearch && bal <= 0;
      return matchesSearch;
    });
  }, [customers, searchQuery, filterTab]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 max-w-4xl mx-auto p-4 pb-24 space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">{t.nav_customers}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{customers.length} total customers</p>
          </div>
        </div>

        <button
          onClick={onOpenAddTx}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-blue-600/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.add_customer}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.search_placeholder}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border-2 border-slate-200 dark:border-slate-800 focus:border-blue-600 outline-none text-sm font-semibold shadow-sm transition-all"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl font-bold text-xs">
        <button
          onClick={() => setFilterTab('all')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            filterTab === 'all'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t.all} ({customers.length})
        </button>
        <button
          onClick={() => setFilterTab('owes')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            filterTab === 'owes'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-red-700 dark:text-red-400 hover:text-red-900'
          }`}
        >
          {t.owes_you} ({customers.filter((c) => (c.balance || 0) > 0).length})
        </button>
        <button
          onClick={() => setFilterTab('clear')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            filterTab === 'clear'
              ? 'bg-green-600 text-white shadow-sm'
              : 'text-green-700 dark:text-green-400 hover:text-green-900'
          }`}
        >
          {t.all_clear} ({customers.filter((c) => (c.balance || 0) <= 0).length})
        </button>
      </div>

      {/* Customer List Grid */}
      <div className="space-y-2">
        {filteredCustomers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-sm mt-4">
            <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <div className="text-slate-500 dark:text-slate-400 font-bold text-sm">{t.no_customer_found}</div>
            <p className="text-xs text-slate-400 mt-1">{t.add_customer_prompt}</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const bal = customer.balance || 0;
            const owesMoney = bal > 0;
            const phoneVal = validateCustomerPhone(customer.phone_number, shop?.country || 'IN', language);

            return (
              <div
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between shadow-sm hover:shadow-md bg-white dark:bg-slate-900 ${
                  owesMoney ? 'border-red-100 dark:border-red-950 hover:border-red-300' : 'border-green-100 dark:border-green-950 hover:border-green-300'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1 pr-2">
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">{customer.display_label}</div>
                  <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium space-x-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{customer.phone_number || t.missing_phone_notice}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                  <div className="text-right">
                    <div
                      className={`text-base sm:text-lg font-black tracking-tight ${
                        owesMoney ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {formatShopCurrency(Math.abs(bal), shop?.country, shop?.currency_code)}
                    </div>
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        owesMoney ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {owesMoney ? t.owe_money : t.paid_up}
                    </div>
                  </div>

                  {phoneVal.isValid && shop && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatchWhatsApp({
                          type: 'CUSTOMER_GREETING',
                          customer,
                          shop,
                          language,
                        });
                      }}
                      className="p-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl transition-colors"
                      title={t.whatsapp_chat}
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                    </button>
                  )}

                  <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
