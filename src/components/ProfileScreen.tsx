import React, { useState } from 'react';
import { CountryConfig, Language, Shop } from '../types';
import { translations } from '../i18n/translations';
import { CountryPhoneInput } from './CountryPhoneInput';
import { COUNTRIES, getCountryByCode } from '../data/countries';
import { uploadShopAsset } from '../lib/imageUtils';
import { validatePhoneNumber } from '../lib/phoneValidation';
import {
  ArrowLeft,
  Store,
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  DollarSign,
  Upload,
  Trash2,
  CheckCircle2,
  Loader2,
  FileCheck2,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Building2,
  Users,
  ArrowRight
} from 'lucide-react';

import { Customer, Transaction } from '../types';
import { exportBackupJSON, importBackupJSON } from '../lib/backupUtils';
import { Sun, Moon, Download, UploadCloud } from 'lucide-react';

interface Props {
  shop: Shop;
  customers: Customer[];
  transactions: Transaction[];
  language: Language;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onSaveProfile: (updatedShop: Partial<Shop>) => Promise<void>;
  onRestoreBackup?: (backupData: any) => void;
  onOpenSubscriptions?: () => void;
  onOpenShops?: () => void;
  onOpenStaff?: () => void;
  onDeleteAccount?: () => Promise<void> | void;
  userEmail?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
}

export const ProfileScreen: React.FC<Props> = ({
  shop,
  customers,
  transactions,
  language,
  theme,
  onToggleTheme,
  onBack,
  onSaveProfile,
  onRestoreBackup,
  onOpenSubscriptions,
  onOpenShops,
  onOpenStaff,
  onDeleteAccount,
  userEmail,
  userName,
  userAvatarUrl,
}) => {
  const t = translations[language];

  // Form State initialized from Shop
  const [shopName, setShopName] = useState(shop.shop_name || '');
  const [ownerName, setOwnerName] = useState(shop.owner_name || '');
  const [phone, setPhone] = useState(shop.phone || '');
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp_number || '');
  const [email, setEmail] = useState(shop.email || '');
  const [selectedCountry, setSelectedCountry] = useState<CountryConfig>(() =>
    getCountryByCode(shop.country || 'BD')
  );
  const [stateDist, setStateDist] = useState(shop.state || '');
  const [city, setCity] = useState(shop.city || '');
  const [fullAddress, setFullAddress] = useState(shop.full_address || '');
  const [businessType, setBusinessType] = useState(shop.business_type || '');
  const [currencyCode, setCurrencyCode] = useState(shop.currency_code || 'BDT');
  const [gstEnabled, setGstEnabled] = useState(shop.gst_enabled || false);
  const [gstNumber, setGstNumber] = useState(shop.gst_number || '');

  // Image URLs State
  const [logoUrl, setLogoUrl] = useState(shop.logo_url || '');
  const [shopPhotoUrl, setShopPhotoUrl] = useState(shop.shop_photo_url || '');
  const [signatureUrl, setSignatureUrl] = useState(shop.signature_url || '');

  // Loading States
  const [uploadingType, setUploadingType] = useState<'logo' | 'photo' | 'signature' | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Handle Image Upload with Compression & Supabase Storage / DataURL Fallback
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: 'logo' | 'photo' | 'signature'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setUploadingType(assetType);

    try {
      const url = await uploadShopAsset(file, assetType, shop.id);
      if (assetType === 'logo') setLogoUrl(url);
      if (assetType === 'photo') setShopPhotoUrl(url);
      if (assetType === 'signature') setSignatureUrl(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Image upload failed.');
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !ownerName.trim()) {
      setErrorMsg(language === 'bn' ? 'দোকানের নাম এবং মালিকের নাম দেওয়া আবশ্যক।' : 'Shop name and owner name are required.');
      return;
    }

    const phoneVal = validatePhoneNumber(phone, selectedCountry, language);
    if (!phoneVal.isValid) {
      setErrorMsg(phoneVal.errorMsg || 'Invalid mobile number.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await onSaveProfile({
        shop_name: shopName.trim(),
        owner_name: ownerName.trim(),
        phone,
        whatsapp_number: whatsapp,
        email: email.trim(),
        country: selectedCountry.code,
        state: stateDist.trim(),
        city: city.trim(),
        full_address: fullAddress.trim(),
        business_type: businessType.trim(),
        currency_code: currencyCode,
        gst_enabled: gstEnabled,
        gst_number: gstNumber.trim(),
        logo_url: logoUrl,
        shop_photo_url: shopPhotoUrl,
        signature_url: signatureUrl,
      });

      setSuccessMsg(t.profile_saved_success);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 max-w-md mx-auto flex flex-col pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-30 shadow-md flex items-center space-x-3">
        <button
          onClick={onBack}
          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="font-extrabold text-lg leading-tight">{t.profile_title}</h2>
          <p className="text-xs text-slate-400 font-medium">{shop.shop_name}</p>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Success Alert */}
        {successMsg && (
          <div className="bg-green-50 dark:bg-green-950/80 border-2 border-green-300 dark:border-green-800 text-green-800 dark:text-green-200 p-4 rounded-2xl text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-950/80 border-2 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-2xl text-xs font-bold animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* Authenticated Account Identity Card */}
        <div className="bg-slate-900 text-white p-4 rounded-3xl space-y-2.5 shadow-md border border-slate-800">
          <div className="text-[10px] uppercase font-black text-blue-400 tracking-wider flex items-center justify-between">
            <span>Authenticated Account Identity</span>
            <span className="bg-blue-900/60 text-blue-300 font-extrabold px-2 py-0.5 rounded-full text-[9px] border border-blue-700/50">
              Google Verified
            </span>
          </div>

          <div className="flex items-center space-x-3 pt-0.5">
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt="Google Avatar"
                className="w-11 h-11 rounded-full object-cover border-2 border-blue-500 shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-blue-600 font-black text-xs flex items-center justify-center shrink-0 text-white shadow-xs">
                {(userName || shop.owner_name || 'SK').slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-sm text-white truncate">
                {userName || shop.owner_name}
              </div>
              {userEmail ? (
                <div className="text-xs font-medium text-slate-300 truncate">
                  {userEmail}
                </div>
              ) : (
                <div className="text-xs font-medium text-slate-400 italic">
                  Google Session Connected
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enterprise Quick Hub Cards */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* Subscription Card */}
          <button
            type="button"
            onClick={onOpenSubscriptions}
            className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl text-left shadow-md hover:scale-[1.02] transition-transform flex flex-col justify-between min-w-0"
          >
            <div>
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300 mb-1 shrink-0" />
              <div className="text-[9px] sm:text-[10px] uppercase font-black text-blue-200 truncate">Plan</div>
              <div className="text-[11px] sm:text-xs font-black truncate">{shop.plan_tier || 'FREE'}</div>
            </div>
            <div className="text-[9px] font-extrabold text-yellow-300 underline mt-1.5 flex items-center shrink-0">
              <span>Upgrade</span>
              <ArrowRight className="w-2.5 h-2.5 ml-0.5 shrink-0" />
            </div>
          </button>

          {/* Multi Shop Card */}
          <button
            type="button"
            onClick={onOpenShops}
            className="p-2.5 sm:p-3 bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-850 text-white rounded-2xl text-left shadow-md hover:scale-[1.02] transition-transform flex flex-col justify-between border border-slate-700 min-w-0"
          >
            <div>
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 mb-1 shrink-0" />
              <div className="text-[9px] sm:text-[10px] uppercase font-black text-slate-400 truncate">Outlets</div>
              <div className="text-[11px] sm:text-xs font-black truncate">My Shops</div>
            </div>
            <div className="text-[9px] font-extrabold text-blue-400 underline mt-1.5 flex items-center shrink-0">
              <span>Switch</span>
              <ArrowRight className="w-2.5 h-2.5 ml-0.5 shrink-0" />
            </div>
          </button>

          {/* Staff Roster Card */}
          <button
            type="button"
            onClick={onOpenStaff}
            className="p-2.5 sm:p-3 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl text-left shadow-md hover:scale-[1.02] transition-transform flex flex-col justify-between min-w-0"
          >
            <div>
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-200 mb-1 shrink-0" />
              <div className="text-[9px] sm:text-[10px] uppercase font-black text-indigo-200 truncate">Staff</div>
              <div className="text-[11px] sm:text-xs font-black truncate">Roles</div>
            </div>
            <div className="text-[9px] font-extrabold text-purple-200 underline mt-1.5 flex items-center shrink-0">
              <span>Manage</span>
              <ArrowRight className="w-2.5 h-2.5 ml-0.5 shrink-0" />
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Business Identity & Images */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center text-blue-600 dark:text-blue-400">
              <Store className="w-4 h-4 mr-1.5" />
              {t.setup_shop_title}
            </h3>

            {/* Shop Logo Upload */}
            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-2">
                {t.shop_logo}
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-slate-700 border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/80 rounded-xl text-xs font-extrabold transition-colors">
                    {uploadingType === 'logo' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{logoUrl ? t.change_image : t.upload_image}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageUpload(e, 'logo')}
                      className="hidden"
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="inline-flex items-center space-x-1 text-xs text-red-500 dark:text-red-400 font-bold hover:underline block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.remove_image}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Shop Name Input */}
            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t.shop_name} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder={t.shop_name_placeholder}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600 font-bold text-sm outline-none"
              />
            </div>

            {/* Owner Name Input */}
            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t.owner_name} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={t.owner_name_placeholder}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600 font-bold text-sm outline-none"
              />
            </div>

            {/* Business Type Category */}
            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t.business_type}
              </label>
              <input
                type="text"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder={t.business_type_placeholder}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600 font-medium text-sm outline-none"
              />
            </div>
          </div>

          {/* Section 2: Contact Info & Country Phone */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center text-blue-600 dark:text-blue-400">
              <Phone className="w-4 h-4 mr-1.5" />
              Contact Information
            </h3>

            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t.phone_number}
              </label>
              <CountryPhoneInput
                language={language}
                value={phone}
                onChange={(e164, local, country) => {
                  setPhone(e164);
                  setSelectedCountry(country);
                  setCurrencyCode(country.currencyCode);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t.whatsapp_number}
              </label>
              <CountryPhoneInput
                language={language}
                value={whatsapp || phone}
                onChange={(e164) => setWhatsapp(e164)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center">
                <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {t.email_optional}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="shop@example.com"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600 font-medium text-sm outline-none"
              />
            </div>
          </div>

          {/* Section 3: Address & Currency Location */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center text-blue-600 dark:text-blue-400">
              <MapPin className="w-4 h-4 mr-1.5" />
              Location & Currency
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {t.state_district}
                </label>
                <input
                  type="text"
                  value={stateDist}
                  onChange={(e) => setStateDist(e.target.value)}
                  placeholder="e.g. Dhaka / Delhi"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-medium focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {t.city}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mirpur / Connaught Place"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-medium focus:border-blue-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t.full_address}
              </label>
              <textarea
                rows={2}
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                placeholder="House, Road, Market name..."
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-medium focus:border-blue-600 outline-none"
              />
            </div>

            {/* Currency Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center">
                <DollarSign className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {t.currency_code}
              </label>
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm focus:border-blue-600 outline-none"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.currencyCode} value={c.currencyCode} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">
                    {c.currencySymbol} - {c.currencyCode} ({c.currencyName[language] || c.currencyName.en})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 4: GST & Signature */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center text-blue-600 dark:text-blue-400">
              <FileCheck2 className="w-4 h-4 mr-1.5" />
              Tax & Signatures
            </h3>

            {/* GST Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/60 rounded-xl border border-gray-300 dark:border-slate-600">
              <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100">{t.gst_enabled}</span>
              <input
                type="checkbox"
                checked={gstEnabled}
                onChange={(e) => setGstEnabled(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            {gstEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {t.gst_number}
                  </label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder={t.gst_placeholder}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 font-mono text-sm uppercase font-bold focus:border-blue-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {t.select_gst_rate}
                  </label>
                  <select
                    value={shop.default_gst_rate || 18}
                    onChange={(e) => onSaveProfile({ default_gst_rate: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                  >
                    <option value={0} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">0% (Exempt)</option>
                    <option value={5} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">5%</option>
                    <option value={12} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">12%</option>
                    <option value={18} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">18% (Standard)</option>
                    <option value={28} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100">28%</option>
                  </select>
                </div>
              </div>
            )}

            {/* Digital Signature Upload */}
            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 mb-2">
                {t.owner_signature}
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-24 h-14 rounded-xl bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                  {signatureUrl ? (
                    <img src={signatureUrl} alt="Signature" className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold italic">No Signature</span>
                  )}
                </div>
                <div>
                  <label className="cursor-pointer inline-flex items-center space-x-1 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-900 dark:text-gray-100 rounded-lg text-xs font-bold transition-colors">
                    {uploadingType === 'signature' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{signatureUrl ? t.change_image : t.upload_image}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageUpload(e, 'signature')}
                      className="hidden"
                    />
                  </label>
                  {signatureUrl && (
                    <button
                      type="button"
                      onClick={() => setSignatureUrl('')}
                      className="text-xs text-red-500 dark:text-red-400 font-bold hover:underline block mt-1"
                    >
                      {t.remove_image}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: App Theme & Display */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center text-blue-600">
              {theme === 'dark' ? <Moon className="w-4 h-4 mr-1.5" /> : <Sun className="w-4 h-4 mr-1.5" />}
              App Theme & Appearance
            </h3>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  {theme === 'dark' ? 'Dark Mode Active 🌙' : 'Light Mode Active ☀️'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Switch app appearance for day or night use
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleTheme}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>

          {/* Section 6: Data Backup & Restore */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center text-blue-600">
              <Download className="w-4 h-4 mr-1.5" />
              Backup & Data Security
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Export a complete JSON backup of your shop ledger, customers, and transaction history. You can restore it anytime on any device.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => exportBackupJSON(shop, customers, transactions)}
                className="py-3 px-3 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export JSON</span>
              </button>

              <label className="cursor-pointer py-3 px-3 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-800 dark:text-blue-300 font-extrabold text-xs rounded-2xl border border-blue-200 dark:border-blue-800 flex items-center justify-center space-x-1.5 transition-colors shadow-xs">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Restore JSON</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onRestoreBackup) {
                      importBackupJSON(
                        file,
                        (backup) => {
                          onRestoreBackup(backup);
                          alert('Data restored successfully!');
                        },
                        (err) => alert(err)
                      );
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" />
                <span>{t.save_profile}</span>
              </>
            )}
          </button>
        </form>

        {/* Danger Zone: Account Deletion */}
        {onDeleteAccount && (
          <div className="bg-red-50/80 dark:bg-red-950/30 p-5 rounded-3xl border border-red-200 dark:border-red-900/60 space-y-3">
            <h3 className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center">
              <Trash2 className="w-4 h-4 mr-1.5" />
              Danger Zone • Account & Data Deletion
            </h3>
            <p className="text-xs text-red-700 dark:text-red-300 font-medium">
              Permanently remove your merchant profile, customers, and transaction history.
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('⚠️ Are you sure you want to delete your account? All shop records and transaction ledgers will be permanently wiped.')) {
                  onDeleteAccount();
                }
              }}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-600/30 transition-colors flex items-center justify-center space-x-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Permanently Delete Account & Clear Data</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
