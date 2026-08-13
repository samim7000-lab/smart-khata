import React, { useState } from 'react';
import { CountryConfig, Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import { CountryPhoneInput } from './CountryPhoneInput';
import { getCountryByCode, getBrowserCountry } from '../data/countries';
import { validatePhoneNumber } from '../lib/phoneValidation';
import { uploadShopAsset } from '../lib/imageUtils';
import {
  Store,
  User,
  Phone,
  MapPin,
  Building,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface Props {
  language: Language;
  initialShop?: Partial<Shop> | null;
  userEmail?: string | null;
  userName?: string | null;
  onComplete: (shopData: Partial<Shop>) => void;
}

export const ShopSetup: React.FC<Props> = ({
  language,
  initialShop,
  userName,
  onComplete,
}) => {
  const t = translations[language];

  // Profile Form State
  const [shopName, setShopName] = useState(initialShop?.shop_name || '');
  const [ownerName, setOwnerName] = useState(initialShop?.owner_name || userName || '');
  const [phone, setPhone] = useState(initialShop?.phone || '');
  const [selectedCountry, setSelectedCountry] = useState<CountryConfig>(() =>
    getCountryByCode(initialShop?.country || getBrowserCountry().code)
  );
  const [fullAddress, setFullAddress] = useState(initialShop?.full_address || '');
  const [stateDist, setStateDist] = useState(initialShop?.state || '');
  const [businessType, setBusinessType] = useState(initialShop?.business_type || '');
  const [logoUrl, setLogoUrl] = useState(initialShop?.logo_url || '');

  // Validation & Loading States
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [gateErrorMsg, setGateErrorMsg] = useState<string | null>(null);
  const [phoneErrorMsg, setPhoneErrorMsg] = useState<string | null>(null);

  // Logo Upload Handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const url = await uploadShopAsset(file, 'logo', initialShop?.id || 'new');
      setLogoUrl(url);
    } catch (err: any) {
      console.warn('Logo upload failed (continuing without logo):', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGateErrorMsg(null);
    setPhoneErrorMsg(null);

    // 1. Completion Gate Check: Required Fields
    const trimmedShopName = shopName.trim();
    const trimmedOwnerName = ownerName.trim();

    if (!trimmedShopName || !trimmedOwnerName) {
      setGateErrorMsg(
        language === 'bn'
          ? 'চালিয়ে যেতে প্রয়োজনীয় তথ্য পূরণ করুন।'
          : language === 'hi'
          ? 'आगे बढ़ने के लिए आवश्यक जानकारी पूरी करें।'
          : 'Please complete the required information to continue.'
      );
      return;
    }

    // 2. Country-Aware Mobile Validation
    const phoneVal = validatePhoneNumber(phone, selectedCountry, language);
    if (!phoneVal.isValid) {
      setGateErrorMsg(
        language === 'bn'
          ? 'চালিয়ে যেতে প্রয়োজনীয় তথ্য পূরণ করুন।'
          : language === 'hi'
          ? 'आगे बढ़ने के लिए आवश्यक जानकारी पूरी करें।'
          : 'Please complete the required information to continue.'
      );
      setPhoneErrorMsg(phoneVal.errorMsg || (language === 'bn' ? 'সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.'));
      return;
    }

    // 3. Complete Profile Onboarding
    onComplete({
      shop_name: trimmedShopName,
      owner_name: trimmedOwnerName,
      phone: phoneVal.normalizedE164 || phone,
      whatsapp_number: phoneVal.normalizedE164 || phone,
      country: selectedCountry.code,
      currency_code: selectedCountry.currencyCode,
      full_address: fullAddress.trim(),
      state: stateDist.trim(),
      business_type: businessType.trim(),
      logo_url: logoUrl,
      preferred_language: language,
      gst_enabled: false,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 max-w-lg mx-auto transition-colors">
      <div className="py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-3xl shadow-inner">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {language === 'bn' ? 'দোকানের তথ্য ও প্রোফাইল সেটআপ' : language === 'hi' ? 'दुकान की जानकारी और प्रोफ़ाइल सेटअप' : 'Shop Profile Onboarding'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-xs mx-auto">
            {language === 'bn'
              ? 'স্মার্ট খাতা শুরু করতে নিচের প্রয়োজনীয় তথ্যগুলি পূরণ করুন'
              : 'Complete your business profile to enter Smart Khata Dashboard'}
          </p>
        </div>

        {/* Completion Gate Alert Banner if Validation Fails */}
        {gateErrorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex items-center space-x-3 text-rose-800 dark:text-rose-200 text-xs font-black shadow-md animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{gateErrorMsg}</span>
          </div>
        )}

        {/* Profile Onboarding Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Optional Logo Upload Card */}
            <div className="flex flex-col items-center space-y-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-8 h-8 text-slate-400" />
                  )}

                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <label className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-2 rounded-xl shadow-md cursor-pointer hover:bg-blue-700 transition-transform active:scale-95">
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                </label>
              </div>

              <span className="text-[11px] font-bold text-slate-400">
                {language === 'bn' ? 'দোকানের লোগো (ঐচ্ছিক / Optional)' : 'Store Logo (Optional)'}
              </span>
            </div>

            {/* Shop Name (Required) */}
            <div className="space-y-1">
              <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center text-xs">
                <Store className="w-3.5 h-3.5 mr-1 text-blue-600" />
                {language === 'bn' ? 'দোকানের নাম' : t.shop_name} <span className="text-rose-500 font-bold ml-1">*</span>
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder={t.shop_name_placeholder}
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl border-2 font-extrabold text-sm outline-none transition-all min-h-[44px] ${
                  gateErrorMsg && !shopName.trim()
                    ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20'
                    : 'border-slate-200 dark:border-slate-700 focus:border-blue-600'
                }`}
                autoFocus
              />
            </div>

            {/* Owner Name (Required) */}
            <div className="space-y-1">
              <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center text-xs">
                <User className="w-3.5 h-3.5 mr-1 text-blue-600" />
                {language === 'bn' ? 'মালিকের নাম' : t.owner_name} <span className="text-rose-500 font-bold ml-1">*</span>
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={t.owner_name_placeholder}
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl border-2 font-extrabold text-sm outline-none transition-all min-h-[44px] ${
                  gateErrorMsg && !ownerName.trim()
                    ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20'
                    : 'border-slate-200 dark:border-slate-700 focus:border-blue-600'
                }`}
              />
            </div>

            {/* Country & Country-Aware Mobile Number (Required) */}
            <div className="space-y-1">
              <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center text-xs">
                <Phone className="w-3.5 h-3.5 mr-1 text-blue-600" />
                {language === 'bn' ? 'দেশ ও মোবাইল নম্বর' : 'Country & Mobile Number'} <span className="text-rose-500 font-bold ml-1">*</span>
              </label>
              <CountryPhoneInput
                language={language}
                value={phone}
                onChange={(e164, _local, country) => {
                  setPhone(e164);
                  setSelectedCountry(country);
                  setPhoneErrorMsg(null);
                }}
              />
              {phoneErrorMsg && (
                <p className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 pt-0.5">
                  ⚠️ {phoneErrorMsg}
                </p>
              )}
            </div>

            {/* Optional Business Type */}
            <div className="space-y-1">
              <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center text-xs">
                <Building className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {language === 'bn' ? 'ব্যবসার ধরন (ঐচ্ছিক)' : 'Business Type (Optional)'}
              </label>
              <input
                type="text"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder={language === 'bn' ? 'যেমন: মুদি দোকান / ইলেক্ট্রনিক্স / কাপড়ের দোকান' : 'e.g. Grocery / Electronics / Retail'}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-600 font-bold outline-none text-xs min-h-[44px]"
              />
            </div>

            {/* Optional Address & State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center text-xs">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {language === 'bn' ? 'জেলা / রাজ্য' : 'State / District'}
                </label>
                <input
                  type="text"
                  value={stateDist}
                  onChange={(e) => setStateDist(e.target.value)}
                  placeholder="e.g. West Bengal / Dhaka"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-600 font-bold outline-none text-xs min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center text-xs">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {language === 'bn' ? 'সম্পূর্ণ ঠিকানা' : 'Address'}
                </label>
                <input
                  type="text"
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  placeholder="Market name, Street address"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-600 font-bold outline-none text-xs min-h-[44px]"
                />
              </div>
            </div>

            {/* Completion Button */}
            <button
              type="submit"
              className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-base rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] min-h-[48px]"
            >
              <span>
                {language === 'bn' ? 'প্রোফাইল সম্পূর্ণ করুন' : language === 'hi' ? 'प्रोफ़ाइल पूरी करें' : 'Complete Profile'}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      <div className="pb-4 text-center text-xs text-slate-400 font-bold flex items-center justify-center space-x-1">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Smart Khata Secure Business Onboarding</span>
      </div>
    </div>
  );
};
