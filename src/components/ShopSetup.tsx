import React, { useState } from 'react';
import { CountryConfig, Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import { CountryPhoneInput } from './CountryPhoneInput';
import { Store, User, ArrowRight, Building } from 'lucide-react';

interface Props {
  language: Language;
  onComplete: (shop: Partial<Shop>) => void;
}

export const ShopSetup: React.FC<Props> = ({ language, onComplete }) => {
  const t = translations[language];
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryConfig | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !ownerName.trim()) return;

    onComplete({
      shop_name: shopName.trim(),
      owner_name: ownerName.trim(),
      phone: phone || '',
      whatsapp_number: phone || '',
      country: selectedCountry?.code || 'BD',
      currency_code: selectedCountry?.currencyCode || 'BDT',
      business_type: businessType.trim(),
      preferred_language: language,
      gst_enabled: false,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 max-w-md mx-auto">
      <div className="pt-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-3 shadow-inner">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">{t.welcome}</h1>
          <p className="text-slate-500 font-medium text-sm mt-1">{t.setup_shop_title}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center">
                <Store className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {t.shop_name} <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder={t.shop_name_placeholder}
                className="w-full px-4 py-3 text-base font-bold rounded-xl border-2 border-slate-200 focus:border-blue-600 outline-none transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {t.owner_name} <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={t.owner_name_placeholder}
                className="w-full px-4 py-3 text-base font-bold rounded-xl border-2 border-slate-200 focus:border-blue-600 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.phone_number}
              </label>
              <CountryPhoneInput
                language={language}
                value={phone}
                onChange={(e164, _local, country) => {
                  setPhone(e164);
                  setSelectedCountry(country);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center">
                <Building className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {t.business_type}
              </label>
              <input
                type="text"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder={t.business_type_placeholder}
                className="w-full px-4 py-3 text-sm font-semibold rounded-xl border-2 border-slate-200 focus:border-blue-600 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-lg rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
            >
              <span>{t.save_continue}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      <div className="pb-6 text-center text-xs text-slate-400 font-medium">
        {t.step_counter} 4 of 4 • {t.trusted_tagline}
      </div>
    </div>
  );
};
