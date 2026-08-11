import React, { useState, useMemo } from 'react';
import { Customer, Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import { Users, Search, UserPlus, Phone, ChevronRight, AlertCircle } from 'lucide-react';
import { formatShopCurrency } from '../lib/countryPricing';

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
    <div className="min-h-screen bg-slate-50 max-w-4xl mx-auto p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">{t.nav_customers}</h1>
            <p className="text-xs text-slate-500 font-medium">{customers.length} total customers</p>
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
          className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-2 border-slate-200 focus:border-blue-600 outline-none text-sm font-semibold shadow-sm transition-all"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl font-bold text-xs">
        <button
          onClick={() => setFilterTab('all')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            filterTab === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.all} ({customers.length})
        </button>
        <button
          onClick={() => setFilterTab('owes')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            filterTab === 'owes'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-red-700 hover:text-red-900'
          }`}
        >
          {t.owes_you} ({customers.filter((c) => (c.balance || 0) > 0).length})
        </button>
        <button
          onClick={() => setFilterTab('clear')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            filterTab === 'clear'
              ? 'bg-green-600 text-white shadow-sm'
              : 'text-green-700 hover:text-green-900'
          }`}
        >
          {t.all_clear} ({customers.filter((c) => (c.balance || 0) <= 0).length})
        </button>
      </div>

      {/* Customer List Grid */}
      <div className="space-y-2">
        {filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm mt-4">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-slate-500 font-bold text-sm">{t.no_customer_found}</div>
            <p className="text-xs text-slate-400 mt-1">{t.add_customer_prompt}</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const bal = customer.balance || 0;
            const owesMoney = bal > 0;

            return (
              <div
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between shadow-sm hover:shadow-md bg-white ${
                  owesMoney ? 'border-red-100' : 'border-green-100'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1 pr-2">
                  <div className="font-extrabold text-slate-900 text-sm sm:text-base truncate">{customer.display_label}</div>
                  <div className="flex items-center text-xs text-slate-500 font-medium space-x-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{customer.phone_number}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                  <div className="text-right">
                    <div
                      className={`text-base sm:text-lg font-black tracking-tight ${
                        owesMoney ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {formatShopCurrency(Math.abs(bal), shop?.country, shop?.currency_code)}
                    </div>
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        owesMoney ? 'text-red-500' : 'text-green-600'
                      }`}
                    >
                      {owesMoney ? t.owe_money : t.paid_up}
                    </div>
                  </div>
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
