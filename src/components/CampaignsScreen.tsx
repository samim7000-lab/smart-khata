import React, { useState, useMemo } from 'react';
import { Customer, Language, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import { getPlanDetails, validateCampaignRecipientLimit } from '../lib/subscription';
import {
  WhatsAppDirectLinkProvider,
  replaceMessageVariables,
  IDeliveryProvider
} from '../lib/communicationEngine';
import { BusinessMediaItem } from '../lib/mediaUtils';
import { MediaLibraryModal } from './MediaLibraryModal';
import {
  Megaphone,
  Users,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  MessageSquare,
  Tag,
  Calendar,
  DollarSign,
  Image as ImageIcon,
  FileText,
  Clock,
  Zap,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  X,
  CheckSquare,
  Square,
  Search,
  Check,
  ShieldCheck,
  AlertTriangle,
  Lock
} from 'lucide-react';

import { EntitlementService } from '../lib/entitlementEngine';

interface Props {
  shop: Shop;
  customers: Customer[];
  transactions: Transaction[];
  language: Language;
  onOpenSubscriptions: () => void;
}

type AudienceFilter = 'all' | 'due' | 'zero' | 'vip' | 'eligible';
type CampaignTab = 'builder' | 'history';

import { formatShopCurrency } from '../lib/countryPricing';
import { CampaignService, CampaignRecord, CampaignRecipientRecord, DeliveryMode } from '../lib/campaignService';
import { generateWeeklyRecoveryPriorities } from '../lib/aiRecoveryEngine';

export const CampaignsScreen: React.FC<Props> = ({
  shop,
  customers,
  transactions,
  language,
  onOpenSubscriptions,
}) => {
  const t = translations[language];

  const entitlements = EntitlementService.getEntitlements(shop);
  const planTier = entitlements.tier;
  const planInfo = getPlanDetails(planTier);
  const maxRecipientLimit = entitlements.campaignRecipientLimit;

  // Active Tab: Builder vs History
  const [activeTab, setActiveTab] = useState<CampaignTab>('builder');

  // Delivery Mode State (Mode A: Manual / Official-Compatible vs Mode B: Meta Cloud API)
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('manual_share');
  const [isMetaApiModalOpen, setIsMetaApiModalOpen] = useState(false);

  // Audience & Filter State
  const [selectedAudience, setSelectedAudience] = useState<AudienceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Customer Selection State (Set of Selected Customer IDs)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(() => {
    // Default: select up to max limit from customer list belonging to this shop with valid phones
    const shopCusts = customers.filter((c) => (!c.shop_id || c.shop_id === shop.id) && c.phone_number?.replace(/\D/g, '').length >= 8);
    const initialIds = shopCusts.slice(0, Math.min(shopCusts.length, maxRecipientLimit === Infinity ? 50 : maxRecipientLimit)).map((c) => c.id);
    return new Set(initialIds);
  });

  // Limit Exceeded Alert Modal State
  const [limitAlertMessage, setLimitAlertMessage] = useState<string | null>(null);

  // Pre-flight Campaign Summary Modal State
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);

  // Media Library Modal state
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<BusinessMediaItem | null>(null);

  // Campaign History State
  const [pastCampaigns, setPastCampaigns] = useState<CampaignRecord[]>([]);

  // Load campaign history on mount
  React.useEffect(() => {
    CampaignService.getCampaigns(shop.id).then((records) => setPastCampaigns(records));
  }, [shop.id]);

  // Helper for initial default campaign message by app language
  const getDefaultCampaignMessage = (lang: Language) => {
    if (lang === 'bn') {
      return 'প্রিয় {{customer_name}},\n\n{{store_name}} থেকে বকেয়া পরিশোধের আপডেট। {{today}} তারিখ পর্যন্ত আপনার বর্তমান বাকি টাকার পরিমাণ {{due_amount}}।\n\nদোকানের ঠিকানা: {{shop_address}}\nইনভয়েস রেফ: {{invoice_number}}\n\nধন্যবাদ!';
    }
    if (lang === 'hi') {
      return 'प्रिय {{customer_name}},\n\n{{store_name}} की तरफ से एक विनम्र जानकारी। {{today}} तक आपका वर्तमान बकाया {{due_amount}} है।\n\nदुकान का पता: {{shop_address}}\nइनवॉइस सं: {{invoice_number}}\n\nधन्यवाद!';
    }
    return 'Dear {{customer_name}},\n\nThis is a friendly update from {{store_name}}. Your current pending balance is {{due_amount}} as of {{today}}.\n\nShop Address: {{shop_address}}\nInvoice Ref: {{invoice_number}}\n\nThank you!';
  };

  // Message Composer State
  const [messageText, setMessageText] = useState(() => getDefaultCampaignMessage(language));

  // Sync default template when app language changes
  React.useEffect(() => {
    setMessageText(getDefaultCampaignMessage(language));
  }, [language]);

  // Delivery Provider Engine
  const deliveryProvider: IDeliveryProvider = useMemo(() => new WhatsAppDirectLinkProvider(), []);

  // Dispatch Analytics State
  const [sentCount, setSentCount] = useState<number>(0);

  // Dynamic Variables List
  const dynamicVars = [
    { label: '{{customer_name}}', tag: '{{customer_name}}' },
    { label: '{{store_name}}', tag: '{{store_name}}' },
    { label: '{{owner_name}}', tag: '{{owner_name}}' },
    { label: '{{due_amount}}', tag: '{{due_amount}}' },
    { label: '{{phone}}', tag: '{{phone}}' },
    { label: '{{payment_link}}', tag: '{{payment_link}}' },
    { label: '{{today}}', tag: '{{today}}' },
    { label: '{{invoice_number}}', tag: '{{invoice_number}}' },
    { label: '{{shop_address}}', tag: '{{shop_address}}' },
  ];

  // Filtered Customer Database List
  const filteredShopCustomers = useMemo(() => {
    const shopCusts = customers.filter((c) => !c.shop_id || c.shop_id === shop.id);
    const q = searchQuery.toLowerCase().trim();

    return shopCusts.filter((c) => {
      const bal = c.balance || 0;
      const cleanPhone = (c.phone_number || '').replace(/\D/g, '');
      const hasValidPhone = cleanPhone.length >= 8;
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.phone_number.includes(q);

      if (!matchesSearch) return false;

      if (selectedAudience === 'due') return bal > 0;
      if (selectedAudience === 'zero') return bal <= 0;
      if (selectedAudience === 'eligible') return hasValidPhone;
      if (selectedAudience === 'vip') {
        const custTxs = transactions.filter((t) => t.customer_id === c.id);
        return bal > 2000 || custTxs.length >= 5;
      }
      return true; // 'all'
    });
  }, [customers, shop.id, transactions, searchQuery, selectedAudience]);

  // Sync selectedCustomerIds whenever filteredShopCustomers array is loaded or updated
  React.useEffect(() => {
    if (filteredShopCustomers.length > 0 && selectedCustomerIds.size === 0) {
      const initialLimit = maxRecipientLimit === Infinity ? 50 : maxRecipientLimit;
      const initialIds = filteredShopCustomers
        .filter((c) => (c.phone_number || '').replace(/\D/g, '').length >= 8)
        .slice(0, Math.min(filteredShopCustomers.length, initialLimit))
        .map((c) => c.id);
      setSelectedCustomerIds(new Set(initialIds));
    }
  }, [filteredShopCustomers, maxRecipientLimit]);

  // Currently Selected Customers Array
  const selectedCustomers = useMemo(() => {
    return customers.filter((c) => (!c.shop_id || c.shop_id === shop.id) && selectedCustomerIds.has(c.id));
  }, [customers, shop.id, selectedCustomerIds]);

  // Campaign Pre-flight Validation Breakdown (Deduplication & Invalid Phone check)
  const validationBreakdown = useMemo(() => {
    const rawList = selectedCustomers;
    const phoneSeen = new Set<string>();
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    rawList.forEach((c) => {
      const cleanPhone = (c.phone_number || '').replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 8) {
        invalidCount++;
      } else if (phoneSeen.has(cleanPhone)) {
        duplicateCount++;
      } else {
        phoneSeen.add(cleanPhone);
        validCount++;
      }
    });

    return {
      selectedTotal: rawList.length,
      valid: validCount,
      invalid: invalidCount,
      duplicatesRemoved: duplicateCount,
    };
  }, [selectedCustomers]);

  // Limit Check Helper for Toggling a Customer Selection
  const handleToggleCustomer = (cust: Customer) => {
    const cleanPhone = (cust.phone_number || '').replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      alert(`Customer "${cust.name}" does not have a valid WhatsApp phone number (${cust.phone_number || 'Missing'}). Cannot add to campaign.`);
      return;
    }

    const newSet = new Set(selectedCustomerIds);
    if (newSet.has(cust.id)) {
      newSet.delete(cust.id);
      setSelectedCustomerIds(newSet);
    } else {
      if (maxRecipientLimit !== Infinity && newSet.size >= maxRecipientLimit) {
        setLimitAlertMessage(
          `Your current ${planInfo.name} allows up to ${maxRecipientLimit} recipients per campaign. Please upgrade to select more customers.`
        );
        return;
      }
      newSet.add(cust.id);
      setSelectedCustomerIds(newSet);
    }
  };

  // Select All Eligible Toggle
  const handleToggleSelectEligible = () => {
    const eligibleCusts = filteredShopCustomers.filter((c) => (c.phone_number || '').replace(/\D/g, '').length >= 8);
    if (selectedCustomerIds.size >= eligibleCusts.length && eligibleCusts.length > 0) {
      setSelectedCustomerIds(new Set());
    } else {
      const maxAllowed = maxRecipientLimit === Infinity ? eligibleCusts.length : maxRecipientLimit;
      const targetIds = eligibleCusts.slice(0, maxAllowed).map((c) => c.id);
      setSelectedCustomerIds(new Set(targetIds));

      if (maxRecipientLimit !== Infinity && eligibleCusts.length > maxRecipientLimit) {
        setLimitAlertMessage(
          `Selected first ${maxRecipientLimit} eligible customers based on your ${planInfo.name} campaign recipient limit.`
        );
      }
    }
  };

  // Import Top AI Recovery Priorities
  const handleImportAIRecoveryPriorities = () => {
    const analysis = generateWeeklyRecoveryPriorities(customers, transactions, shop, language);
    const topCustIds = analysis.recommendations.slice(0, 10).map((rec) => rec.customer.id);
    setSelectedCustomerIds(new Set(topCustIds));
    if (language === 'bn') {
      setMessageText(
        'আসসালামু আলাইকুম {{customer_name}},\n\n{{store_name}} থেকে বকেয়া পরিশোধের বিনীত অনুরোধ। {{today}} তারিখ পর্যন্ত আপনার মোট বাকি টাকার পরিমাণ {{due_amount}}।\n\nঅনুগৃহ করে সুবিধামতো পেমেন্ট করে দিন।\nদোকানের ঠিকানা: {{shop_address}}\n\nধন্যবাদ!'
      );
    } else if (language === 'hi') {
      setMessageText(
        'नमस्ते {{customer_name}},\n\n{{store_name}} से बकाया भुगतान का विनम्र निवेदन। {{today}} तक आपकी कुल बकाया राशि {{due_amount}} है।\n\nकृपया अपनी सुविधा अनुसार भुगतान करें।\nदुकान का पता: {{shop_address}}\n\nधन्यवाद!'
      );
    } else {
      setMessageText(
        'Dear {{customer_name}},\n\nFriendly reminder from {{store_name}}. Your pending balance is {{due_amount}} as of {{today}}.\n\nShop Address: {{shop_address}}\nInvoice Ref: {{invoice_ref}}\n\nThank you!'
      );
    }
  };

  // Selected Preview Customer (Allows per-recipient live variable resolution testing)
  const activePreviewCustomer = useMemo(() => {
    if (previewCustomerId) {
      const found = selectedCustomers.find((c) => c.id === previewCustomerId);
      if (found) return found;
    }
    return selectedCustomers[0] || {
      id: 'sample-1',
      shop_id: shop.id,
      name: 'Mohammed Rahim',
      display_label: 'Mohammed Rahim',
      phone_number: '+919876543210',
      balance: 1500,
      created_at: new Date().toISOString(),
    };
  }, [selectedCustomers, previewCustomerId, shop.id]);

  const previewFormattedText = useMemo(() => {
    return replaceMessageVariables(messageText, activePreviewCustomer, shop);
  }, [messageText, activePreviewCustomer, shop]);

  // Dispatch message to individual recipient with real persistent tracking
  const handleDispatchCustomer = async (cust: Customer, campaignId?: string) => {
    const cleanPhone = (cust.phone_number || '').replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      alert(`Invalid phone number for ${cust.name}. Cannot dispatch.`);
      return;
    }

    const res = await deliveryProvider.dispatch({
      recipient: cust,
      shop,
      rawText: messageText,
      mediaUrl: attachedMedia?.media_url,
      mediaType: attachedMedia?.file_type,
      mediaFile: attachedMedia?.file,
      campaignId,
    });

    if (res.success) {
      setSentCount((prev) => prev + 1);
      if (campaignId) {
        await CampaignService.updateRecipientStatus(campaignId, cust.id, 'shared_manually', res.messageId);
        const updatedRecs = await CampaignService.getCampaigns(shop.id);
        setPastCampaigns(updatedRecs);
      }
    }
  };

  // Save campaign pre-flight record before dispatching
  const handleLaunchCampaignSession = async () => {
    const campaignId = `camp-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const campaignRecord: CampaignRecord = {
      id: campaignId,
      shop_id: shop.id,
      title: `Campaign ${new Date().toLocaleDateString()}`,
      message: messageText,
      media_url: attachedMedia?.media_url || null,
      media_type: attachedMedia?.file_type || null,
      delivery_mode: deliveryMode,
      status: 'manual_in_progress',
      recipient_count: selectedCustomers.length,
      shared_count: 0,
      failed_count: validationBreakdown.invalid,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const recipientRecords: CampaignRecipientRecord[] = selectedCustomers.map((c) => {
      const dueAmt = c.balance && c.balance > 0 ? c.balance : 0;
      return {
        id: `rec-${campaignId}-${c.id}`,
        campaign_id: campaignId,
        customer_id: c.id,
        customer_name: c.display_label || c.name,
        customer_phone: c.phone_number,
        due_amount: dueAmt,
        status: 'pending',
        provider: deliveryMode,
      };
    });

    await CampaignService.saveCampaign(campaignRecord, recipientRecords);
    const updatedCampaigns = await CampaignService.getCampaigns(shop.id);
    setPastCampaigns(updatedCampaigns);
    setIsSummaryModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col max-w-5xl mx-auto p-4 pb-24 space-y-5 transition-colors">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md">
                <Megaphone className="w-6 h-6 text-yellow-300" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">WhatsApp Campaign Center</h2>
            </div>
            <p className="text-xs text-blue-100 font-medium pt-0.5">
              Select recipients from your customer database & broadcast prefilled WhatsApp messages cleanly.
            </p>
          </div>

          {/* Current Plan Badge */}
          <button
            onClick={onOpenSubscriptions}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl border border-white/20 transition-colors backdrop-blur-md text-right shrink-0"
          >
            <div className="flex items-center space-x-1.5 text-xs font-black text-yellow-300">
              <Zap className="w-4 h-4 fill-yellow-300" />
              <span className="uppercase">{planInfo.name}</span>
            </div>
            <div className="text-[11px] text-white font-bold mt-0.5">
              Limit: {maxRecipientLimit === Infinity ? 'Unlimited' : `${maxRecipientLimit} / campaign`}
            </div>
          </button>
        </div>

        {/* Tab Switcher: Builder vs History */}
        <div className="flex space-x-2 mt-5 pt-4 border-t border-white/20">
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
              activeTab === 'builder'
                ? 'bg-white text-blue-700 shadow-md font-black'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Campaign Builder</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-blue-700 shadow-md font-black'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Campaign History ({pastCampaigns.length})</span>
          </button>
        </div>
      </div>

      {/* Delivery Mode Indicator Bar */}
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 rounded-xl flex items-center justify-center font-black shrink-0">
            WA
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                Delivery Mode: {deliveryMode === 'manual_share' ? 'Mode A: Manual WhatsApp Share (Official-Compatible)' : 'Mode B: Meta Cloud API'}
              </span>
              <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-[9px] uppercase px-1.5 py-0.5 rounded">
                Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Merchant-driven user-facing share flow. Policy compliant with zero background spammers.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsMetaApiModalOpen(true)}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-colors border border-slate-200 dark:border-slate-600 shrink-0"
        >
          <span>Meta Cloud API Setup</span>
        </button>
      </div>

      {activeTab === 'builder' ? (
        /* Main Campaign Builder Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Customer Selector & Limit Counter (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
              {/* Header + Selection Counter */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center">
                    <Users className="w-4 h-4 mr-1.5 text-blue-600" />
                    Select Recipients
                  </h3>
                  <div className="text-sm font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {selectedCustomerIds.size} {maxRecipientLimit === Infinity ? 'recipients selected' : `/ ${maxRecipientLimit} selected`}
                  </div>
                </div>

                <div className="flex space-x-1">
                  <button
                    type="button"
                    onClick={handleToggleSelectEligible}
                    className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white font-extrabold text-xs rounded-xl transition-colors flex items-center space-x-1 border border-emerald-200 dark:border-emerald-800"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Eligible Only</span>
                  </button>
                </div>
              </div>

              {/* Plan Limit Progress Bar */}
              {maxRecipientLimit !== Infinity && (
                <div className="space-y-1 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-300">
                      {planInfo.name} Recipient Cap
                    </span>
                    <span className={selectedCustomerIds.size >= maxRecipientLimit ? 'text-amber-600 font-extrabold' : 'text-blue-600 font-extrabold'}>
                      {selectedCustomerIds.size} / {maxRecipientLimit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        selectedCustomerIds.size >= maxRecipientLimit ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, (selectedCustomerIds.size / maxRecipientLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Filter Chips + Search */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search customers by name or phone..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                  />
                </div>

                <div className="flex space-x-1.5 overflow-x-auto pb-1">
                  {(['all', 'eligible', 'due', 'zero', 'vip'] as AudienceFilter[]).map((filterKey) => (
                    <button
                      key={filterKey}
                      onClick={() => setSelectedAudience(filterKey)}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold uppercase tracking-wider shrink-0 transition-all ${
                        selectedAudience === filterKey
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {filterKey}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkbox Customer List */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-700/60">
                {customers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs font-bold space-y-1">
                    <div>No customers found in database.</div>
                    <div className="text-[11px] text-slate-400 font-medium">Add customers in the Customers tab to start campaigns.</div>
                  </div>
                ) : filteredShopCustomers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs font-bold space-y-1">
                    <div>No customers match current filter/search.</div>
                    <div className="text-[11px] text-slate-400 font-medium">Try clearing the search box or switching audience filters.</div>
                  </div>
                ) : (
                  filteredShopCustomers.map((cust) => {
                    const isChecked = selectedCustomerIds.has(cust.id);
                    const bal = cust.balance || 0;
                    const cleanPhone = (cust.phone_number || '').replace(/\D/g, '');
                    const hasValidPhone = cleanPhone.length >= 8;

                    return (
                      <div
                        key={cust.id}
                        onClick={() => handleToggleCustomer(cust)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40'
                            : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                              {cust.display_label || cust.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center space-x-2">
                              <span>{cust.phone_number || 'Missing Phone'}</span>
                              <span className={hasValidPhone ? 'text-emerald-600 font-extrabold text-[10px]' : 'text-rose-500 font-extrabold text-[10px]'}>
                                {hasValidPhone ? '✓ Eligible' : '⚠️ Ineligible'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-xs font-black">
                          <span className={bal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {formatShopCurrency(Math.abs(bal), shop?.country, shop?.currency_code)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Message Composer + Live WhatsApp Chat Preview (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Message Composer & Media Attachment */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Message Composer
                </h3>

                <div className="flex space-x-1.5">
                  <button
                    type="button"
                    onClick={handleImportAIRecoveryPriorities}
                    className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 font-extrabold text-[11px] rounded-xl border border-purple-200 dark:border-purple-800 flex items-center space-x-1"
                    title="Import Top AI Overdue Recovery Priorities"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Import AI Priorities</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMediaModalOpen(true)}
                    className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 font-extrabold text-[11px] rounded-xl border border-blue-200 dark:border-blue-800 flex items-center space-x-1"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{attachedMedia ? 'Change Media' : 'Attach Media'}</span>
                  </button>
                </div>
              </div>

              {/* Variable Chips */}
              <div className="flex flex-wrap gap-1">
                {dynamicVars.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => setMessageText((prev) => prev + ` ${v.tag} `)}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 font-extrabold text-[10px] rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
                  >
                    +{v.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Write your campaign text..."
                className="w-full p-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-600 outline-none font-semibold text-xs leading-relaxed"
              />
            </div>

            {/* Live WhatsApp Chat Bubble Preview */}
            <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xs">
                    WA
                  </div>
                  <h4 className="font-extrabold text-white text-xs">Live Preview ({activePreviewCustomer.display_label || activePreviewCustomer.name})</h4>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">100% Policy Compliant</span>
              </div>

              <div className="bg-[#0b141a] p-3.5 rounded-2xl min-h-[140px] flex flex-col justify-between">
                <div className="bg-[#005c4b] text-white p-3 rounded-2xl rounded-tr-none max-w-[95%] ml-auto shadow-md space-y-2">
                  {attachedMedia && (
                    <div className="rounded-lg overflow-hidden bg-slate-950/40 p-1.5 border border-emerald-400/30">
                      <img src={attachedMedia.media_url} alt="Media" className="w-full h-28 object-cover rounded-md" />
                    </div>
                  )}
                  <p className="text-xs whitespace-pre-wrap leading-relaxed font-sans">{previewFormattedText}</p>
                  <div className="text-[9px] text-emerald-200 font-bold text-right">14:30 PM ✓✓</div>
                </div>
              </div>

              {/* Campaign Summary Modal Trigger */}
              <button
                onClick={handleLaunchCampaignSession}
                disabled={selectedCustomerIds.size === 0}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Review Campaign & Launch ({selectedCustomerIds.size} Selected)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Campaign History Tab */
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-600" />
              Past Broadcast Campaigns ({pastCampaigns.length})
            </h3>
          </div>

          {pastCampaigns.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold space-y-1">
              <div>No past campaigns recorded yet.</div>
              <div className="text-[11px] text-slate-400 font-medium">Create a campaign in the Campaign Builder tab to get started.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {pastCampaigns.map((camp) => (
                <div key={camp.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{camp.title}</h4>
                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[9px] uppercase px-1.5 py-0.5 rounded">
                        {camp.delivery_mode === 'manual_share' ? 'Manual Share' : 'Meta API'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">{camp.message}</p>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Created: {new Date(camp.created_at).toLocaleString()} • Recipients: {camp.recipient_count}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {camp.shared_count} / {camp.recipient_count} Opened/Shared
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recipient Limit Alert Modal */}
      {limitAlertMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 text-center space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg">
              Recipient Limit Reached
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {limitAlertMessage}
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setLimitAlertMessage(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setLimitAlertMessage(null);
                  onOpenSubscriptions();
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md"
              >
                Upgrade to {planTier === 'free' ? 'Pro (₹49)' : 'Unlimited (₹149)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-flight Campaign Summary Modal */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Megaphone className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-lg">Campaign Pre-Flight Summary</h3>
              </div>
              <button onClick={() => setIsSummaryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Validation Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 min-w-0">
                <div className="text-[10px] uppercase font-black text-slate-400 truncate">Selected</div>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {validationBreakdown.selectedTotal}
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 min-w-0">
                <div className="text-[10px] uppercase font-black text-emerald-600 truncate">Valid</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {validationBreakdown.valid}
                </div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-2xl border border-rose-200 dark:border-rose-800 min-w-0">
                <div className="text-[10px] uppercase font-black text-rose-600 truncate">Invalid</div>
                <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                  {validationBreakdown.invalid}
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-2xl border border-amber-200 dark:border-amber-800 min-w-0">
                <div className="text-[10px] uppercase font-black text-amber-600 truncate" title="Deduplicated">Deduplicated</div>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                  {validationBreakdown.duplicatesRemoved}
                </div>
              </div>
            </div>

            {/* Per-Recipient Live Message Variable Verification */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200">
                <span>Verify Per-Recipient Resolved Variables:</span>
                <select
                  value={activePreviewCustomer.id}
                  onChange={(e) => setPreviewCustomerId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {selectedCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_label || c.name} (Due: {formatShopCurrency(c.balance || 0, shop?.country, shop?.currency_code)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-[#005c4b] text-white p-3 rounded-xl text-xs whitespace-pre-wrap font-sans">
                {previewFormattedText}
              </div>
            </div>

            {/* Customer List Dispatcher */}
            <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 p-2 rounded-2xl">
              {selectedCustomers.map((cust) => {
                const cleanPhone = (cust.phone_number || '').replace(/\D/g, '');
                const hasValidPhone = cleanPhone.length >= 8;

                return (
                  <div key={cust.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                        <span>{cust.display_label || cust.name}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          (Due: {formatShopCurrency(cust.balance || 0, shop?.country, shop?.currency_code)})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium flex items-center space-x-1.5">
                        <span>{cust.phone_number || 'Missing Phone'}</span>
                        <span className={hasValidPhone ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                          {hasValidPhone ? '✓ Valid' : '⚠️ Ineligible'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDispatchCustomer(cust)}
                      disabled={!hasValidPhone}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg flex items-center space-x-1 disabled:opacity-40"
                    >
                      <Send className="w-3 h-3" />
                      <span>Share WA</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setIsSummaryModalOpen(false)}
              className="w-full py-3 bg-slate-900 text-white font-extrabold text-xs rounded-xl"
            >
              Done & Return to Builder
            </button>
          </div>
        </div>
      )}

      {/* Meta WhatsApp Cloud API Setup & Readiness Modal */}
      {isMetaApiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Meta WhatsApp Cloud API Readiness</h3>
              </div>
              <button onClick={() => setIsMetaApiModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-2xl border border-blue-200 dark:border-blue-800">
                <div className="font-extrabold text-blue-900 dark:text-blue-200">Current Mode: Mode A (Manual WhatsApp Share)</div>
                <div className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                  Your shop is currently using 100% policy-compliant Mode A sharing. Messages open directly in official WhatsApp.
                </div>
              </div>

              <div className="space-y-1.5 font-medium">
                <div className="font-bold text-slate-800 dark:text-slate-200">Future Mode B Official Meta API Requirements:</div>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Meta Verified Business Manager Account ID</li>
                  <li>Registered WhatsApp Business Phone Number ID</li>
                  <li>System User Permanent Access Token</li>
                  <li>Webhook Verification Token for Realtime Delivery Statuses</li>
                </ul>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-2xl border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                ⚠️ Meta Cloud API mode will remain dormant until official Meta API credentials are input and verified. Zero fake sending or background automation is used.
              </div>
            </div>

            <button
              onClick={() => setIsMetaApiModalOpen(false)}
              className="w-full py-3 bg-slate-900 text-white font-extrabold text-xs rounded-xl"
            >
              Close & Keep Using Mode A
            </button>
          </div>
        </div>
      )}

      {/* Cloud Business Media Library Modal */}
      {isMediaModalOpen && (
        <MediaLibraryModal
          shop={shop}
          language={language}
          onClose={() => setIsMediaModalOpen(false)}
          onSelectMedia={(media) => {
            setAttachedMedia(media);
            setIsMediaModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
