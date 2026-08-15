import React, { useState } from 'react';
import { Customer, Language, Shop, TransactionType, ReceiptItem, DiscountType, GstPriceMode, ReceiptDetailsPayload } from '../types';
import { translations } from '../i18n/translations';
import { CountryPhoneInput } from './CountryPhoneInput';
import { calculateGst, ALLOWED_GST_RATES, GstCalculationResult } from '../lib/gstUtils';
import { formatShopCurrency, resolveCurrencySymbol } from '../lib/countryPricing';
import { validatePhoneNumber } from '../lib/phoneValidation';
import { getCountryByCode } from '../data/countries';
import { EMIForm, EMIPayloadData } from './EMIForm';
import {
  X,
  Search,
  UserPlus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Delete,
  PlusCircle,
  MinusCircle,
  FileText,
  Percent,
  MapPin,
  CreditCard,
  ShoppingBag,
  Trash2,
  Plus,
  Tag,
  Check
} from 'lucide-react';

interface Props {
  shop: Shop;
  customers: Customer[];
  language: Language;
  preSelectedCustomer?: Customer | null;
  onClose: () => void;
  onSave: (
    customerId: string,
    type: TransactionType,
    amount: number,
    note: string,
    newCustomerData?: { name: string; phone: string; displayLabel: string; state?: string; address?: string; gstin?: string },
    gstDetails?: GstCalculationResult,
    ledgerPhotoUrl?: string,
    emiDetails?: EMIPayloadData,
    receiptDetails?: ReceiptDetailsPayload
  ) => void;
}

export const AddTransactionModal: React.FC<Props> = ({
  shop,
  customers,
  language,
  preSelectedCustomer,
  onClose,
  onSave,
}) => {
  const t = translations[language];

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    preSelectedCustomer || null
  );
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newState, setNewState] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  const [txType, setTxType] = useState<TransactionType>('credit_given');
  const [isEMIMode, setIsEMIMode] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GST State
  const [gstRate, setGstRate] = useState<number>(shop.default_gst_rate || 18);

  // Customer Auto-Fill & Detail State
  const [customerState, setCustomerState] = useState<string>(preSelectedCustomer?.state || '');
  const [customerAddress, setCustomerAddress] = useState<string>(preSelectedCustomer?.address || '');
  const [customerGstin, setCustomerGstin] = useState<string>(preSelectedCustomer?.gstin || '');

  // Line Items State
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [showItemsSection, setShowItemsSection] = useState(false);
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemQtyInput, setItemQtyInput] = useState('1');
  const [itemUnitPriceInput, setItemUnitPriceInput] = useState('');

  // Discount State
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountValStr, setDiscountValStr] = useState('');

  // GST Price Mode State
  const [gstPriceMode, setGstPriceMode] = useState<GstPriceMode>('exclusive');

  const handleNameChange = (val: string) => {
    setNewName(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setDuplicateWarning('');
      return;
    }
    const duplicate = customers.find((c) => c.name.toLowerCase() === trimmed);
    if (duplicate) {
      setDuplicateWarning(t.duplicate_name_warning.replace('{name}', duplicate.name));
    } else {
      setDuplicateWarning('');
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone_number.includes(searchQuery) ||
      c.display_label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // AUTO-FILL CUSTOMER DETAILS ON SELECTION
  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerState(c.state || '');
    setCustomerAddress(c.address || '');
    setCustomerGstin(c.gstin || '');
    setIsAddingNewCustomer(false);
  };

  const handleCreateNewCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (newPhone.trim()) {
      const countryConfig = getCountryByCode(shop.country || 'IN');
      const phoneVal = validatePhoneNumber(newPhone.trim(), countryConfig, language);
      if (!phoneVal.isValid) {
        alert(phoneVal.errorMsg || (language === 'bn' ? 'সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.'));
        return;
      }
    }

    let displayLabel = newName.trim();
    const isNameDuplicate = customers.some(
      (c) => c.name.toLowerCase() === newName.trim().toLowerCase()
    );

    if (isNameDuplicate) {
      displayLabel = `${newName.trim()} (${newPhone.trim().slice(-4)})`;
    }

    const tempCustomer: Customer = {
      id: `temp-${Date.now()}`,
      shop_id: shop.id,
      name: newName.trim(),
      phone_number: newPhone.trim(),
      display_label: displayLabel,
      state: newState.trim(),
      created_at: new Date().toISOString(),
      balance: 0,
    };

    setSelectedCustomer(tempCustomer);
    setCustomerState(newState.trim());
    setIsAddingNewCustomer(false);
  };

  // Line Item Handlers
  const handleAddItem = () => {
    if (!itemNameInput.trim()) return;
    const qty = Math.max(1, parseFloat(itemQtyInput) || 1);
    const unitPrice = Math.max(0, parseFloat(itemUnitPriceInput) || 0);
    const total = Math.round(qty * unitPrice * 100) / 100;

    const newItem: ReceiptItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: itemNameInput.trim(),
      quantity: qty,
      unit_price: unitPrice,
      total,
    };

    setItems((prev) => [...prev, newItem]);
    setItemNameInput('');
    setItemQtyInput('1');
    setItemUnitPriceInput('');
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Math Calculations for Subtotal, Discount & GST
  const itemsSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  const enteredVal = parseFloat(amountStr) || 0;
  const rawSubtotal = items.length > 0 ? itemsSubtotal : enteredVal;

  const discountVal = parseFloat(discountValStr) || 0;
  let discountAmount = 0;
  if (discountVal > 0 && rawSubtotal > 0) {
    if (discountType === 'percentage') {
      discountAmount = Math.round((rawSubtotal * (discountVal / 100)) * 100) / 100;
    } else {
      discountAmount = Math.min(rawSubtotal, discountVal);
    }
  }

  const taxableSubtotal = Math.max(0, rawSubtotal - discountAmount);

  // Live GST Calculation (Supports Inclusive & Exclusive price modes)
  const gstCalc = calculateGst(
    taxableSubtotal,
    gstRate,
    shop.gst_enabled,
    shop.state,
    customerState || selectedCustomer?.state,
    gstPriceMode
  );

  const finalTxAmount = shop.gst_enabled ? gstCalc.totalAmount : taxableSubtotal;

  // Keypad Handlers
  const handleKeyPress = (num: string) => {
    if (amountStr.length >= 7) return;
    if (amountStr === '0' && num !== '.') {
      setAmountStr(num);
    } else {
      setAmountStr((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setAmountStr((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setAmountStr('');
  };

  const handleQuickAdd = (addVal: number) => {
    const current = parseFloat(amountStr) || 0;
    setAmountStr((current + addVal).toString());
  };

  const handleSaveTransaction = () => {
    if (!selectedCustomer || finalTxAmount <= 0 || isSubmitting) return;

    if (selectedCustomer.phone_number && selectedCustomer.phone_number.trim()) {
      const countryConfig = getCountryByCode(shop.country || 'IN');
      const phoneVal = validatePhoneNumber(selectedCustomer.phone_number.trim(), countryConfig, language);
      if (!phoneVal.isValid) {
        alert(phoneVal.errorMsg || (language === 'bn' ? 'সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.'));
        return;
      }
    }

    setIsSubmitting(true);

    let newCustPayload;
    if (selectedCustomer.id.startsWith('temp-')) {
      newCustPayload = {
        name: selectedCustomer.name,
        phone: selectedCustomer.phone_number,
        displayLabel: selectedCustomer.display_label,
        state: selectedCustomer.state,
        address: customerAddress,
        gstin: customerGstin,
      };
    }

    const receiptDetails: ReceiptDetailsPayload = {
      items: items.length > 0 ? items : undefined,
      discount_type: discountVal > 0 ? discountType : undefined,
      discount_value: discountVal > 0 ? discountVal : undefined,
      discount_amount: discountAmount > 0 ? discountAmount : undefined,
      subtotal: rawSubtotal,
      taxable_amount: taxableSubtotal,
      gst_price_mode: gstPriceMode,
      customer_address: customerAddress,
      customer_gstin: customerGstin,
      notes: note,
    };

    onSave(
      selectedCustomer.id,
      txType,
      finalTxAmount,
      note.trim(),
      newCustPayload,
      shop.gst_enabled ? gstCalc : undefined,
      undefined,
      undefined,
      receiptDetails
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-extrabold text-lg">{t.add_new_transaction}</h3>
            {selectedCustomer && (
              <p className="text-xs text-blue-100 font-medium">
                {t.select_customer}: <span className="font-bold underline">{selectedCustomer.display_label}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!selectedCustomer && !isAddingNewCustomer && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">
                  {t.select_customer}
                </h4>
                <button
                  onClick={() => setIsAddingNewCustomer(true)}
                  className="inline-flex items-center text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  {t.add_customer}
                </button>
              </div>

              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.search_placeholder}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 rounded-xl font-semibold border border-gray-300 dark:border-slate-600 focus:border-blue-600 outline-none text-sm"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/60 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl transition-all text-left group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 text-base">
                        {c.display_label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{c.phone_number}</div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-black ${
                          (c.balance || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {formatShopCurrency(c.balance, shop?.country, shop?.currency_code)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form to Add New Customer Inline */}
          {isAddingNewCustomer && (
            <form onSubmit={handleCreateNewCustomerSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">
                  {t.add_customer}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCustomer(false)}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                >
                  {t.back}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t.customer_name} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t.name_placeholder}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border-2 border-gray-300 dark:border-slate-600 focus:border-blue-600 outline-none font-bold text-base shadow-xs"
                />
              </div>

              {duplicateWarning && (
                <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-xl text-amber-900 text-xs font-semibold flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>{duplicateWarning}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.customer_phone} <span className="text-red-500">*</span>
                </label>
                <CountryPhoneInput
                  language={language}
                  value={newPhone}
                  onChange={(e164) => setNewPhone(e164)}
                />
              </div>

              {shop.gst_enabled && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {t.customer_state} (For GST Intra/Inter detection)
                  </label>
                  <input
                    type="text"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    placeholder="e.g. West Bengal / Delhi"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-medium outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 text-white font-extrabold rounded-xl text-base shadow-md hover:bg-blue-700 transition-all flex items-center justify-center space-x-2"
              >
                <span>{t.save_continue}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* Amount Entry & GST Step */}
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="bg-slate-100 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t.select_customer}:</div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {selectedCustomer.display_label}
                  </div>
                </div>
                {!preSelectedCustomer && (
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    {t.back}
                  </button>
                )}
              </div>

              {/* Transaction Type / Payment Options Selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEMIMode(false);
                    setTxType('payment_received');
                  }}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all min-h-[50px] ${
                    !isEMIMode && txType === 'payment_received'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-md font-black'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <PlusCircle className="w-5 h-5 text-emerald-600 mb-0.5" />
                  <span className="font-extrabold text-xs">{language === 'bn' ? 'নগদ জমা' : 'Full Payment'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEMIMode(false);
                    setTxType('credit_given');
                  }}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all min-h-[50px] ${
                    !isEMIMode && txType === 'credit_given'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 shadow-md font-black'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <MinusCircle className="w-5 h-5 text-rose-600 mb-0.5" />
                  <span className="font-extrabold text-xs">{language === 'bn' ? 'বাকি' : 'Due / Baki'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEMIMode(true);
                  }}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all min-h-[50px] ${
                    isEMIMode
                      ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-md font-black'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-purple-600 mb-0.5" />
                  <span className="font-extrabold text-xs">{language === 'bn' ? 'কিস্তি / EMI' : 'EMI Plan'}</span>
                </button>
              </div>

              {/* Render inline EMI setup form when EMI mode selected */}
              {isEMIMode ? (
                <div className="pt-2">
                  <EMIForm
                    shop={shop}
                    customers={customers}
                    selectedCustomer={selectedCustomer}
                    language={language}
                    initialAmount={enteredVal}
                    initialNote={note}
                    onSaveEMI={(emiData) => {
                      let newCustPayload;
                      if (selectedCustomer?.id.startsWith('temp-')) {
                        newCustPayload = {
                          name: selectedCustomer.name,
                          phone: selectedCustomer.phone_number,
                          displayLabel: selectedCustomer.display_label,
                          state: selectedCustomer.state,
                        };
                      }
                      onSave(
                        selectedCustomer ? selectedCustomer.id : (emiData.customer_id || ''),
                        'credit_given',
                        emiData.financed_amount,
                        `EMI: ${emiData.product_name}`,
                        newCustPayload,
                        undefined,
                        undefined,
                        emiData
                      );
                    }}
                    onCancel={() => setIsEMIMode(false)}
                  />
                </div>
              ) : (
                <>

              {/* Product / Line Item Details Section */}
              <div className="bg-slate-50 dark:bg-slate-700/60 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowItemsSection(!showItemsSection)}
                    className="flex items-center space-x-1.5 text-xs font-black text-slate-800 dark:text-slate-200 hover:text-blue-600"
                  >
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <span>{language === 'bn' ? 'পণ্যের তালিকা (Product / Item List)' : 'Product / Item Breakdown'}</span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded font-extrabold ml-1">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </button>
                </div>

                {(showItemsSection || items.length > 0) && (
                  <div className="space-y-2.5 pt-1">
                    {/* Items List Table */}
                    {items.length > 0 && (
                      <div className="divide-y divide-slate-200 dark:divide-slate-600 max-h-36 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-2 text-xs">
                        {items.map((item) => (
                          <div key={item.id} className="py-1.5 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <div className="font-extrabold text-slate-900 dark:text-white truncate">{item.name}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {item.quantity} x {formatShopCurrency(item.unit_price, shop?.country, shop?.currency_code)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="font-black text-slate-900 dark:text-white">
                                {formatShopCurrency(item.total, shop?.country, shop?.currency_code)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Line Item Row */}
                    <div className="grid grid-cols-12 gap-1.5">
                      <input
                        type="text"
                        placeholder="Item Name (e.g. Notebook)"
                        value={itemNameInput}
                        onChange={(e) => setItemNameInput(e.target.value)}
                        className="col-span-5 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={itemQtyInput}
                        onChange={(e) => setItemQtyInput(e.target.value)}
                        className="col-span-2 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none text-center"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Price"
                        value={itemUnitPriceInput}
                        onChange={(e) => setItemUnitPriceInput(e.target.value)}
                        className="col-span-3 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Discount Section (Optional) */}
              <div className="bg-slate-50 dark:bg-slate-700/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center">
                    <Tag className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    <span>{language === 'bn' ? 'ছাড় / ডিসকাউন্ট (Discount)' : 'Discount'}</span>
                  </span>
                  <div className="flex space-x-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        discountType === 'fixed' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Fixed ({resolveCurrencySymbol(shop?.country, shop?.currency_code)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        discountType === 'percentage' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Percentage (%)
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    placeholder={discountType === 'percentage' ? 'e.g. 10%' : 'e.g. 50'}
                    value={discountValStr}
                    onChange={(e) => setDiscountValStr(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none"
                  />
                  {discountAmount > 0 && (
                    <span className="text-xs font-black text-emerald-600 shrink-0">
                      -{formatShopCurrency(discountAmount, shop?.country, shop?.currency_code)}
                    </span>
                  )}
                </div>
              </div>

              {/* GST Tax Selector Bar (When GST Enabled) */}
              {shop.gst_enabled && (
                <div className="bg-blue-50/80 dark:bg-blue-950/60 p-3 sm:p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-blue-900 dark:text-blue-200 flex-wrap gap-1">
                    <span className="flex items-center min-w-0">
                      <Percent className="w-4 h-4 mr-1 text-blue-600 shrink-0" />
                      <span className="truncate">{t.select_gst_rate}</span>
                    </span>
                    <span className="text-[10px] sm:text-[11px] bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-md uppercase shrink-0 truncate max-w-[150px] sm:max-w-none font-black">
                      {gstCalc.taxType === 'intra' ? t.intra_state_tax : t.inter_state_tax}
                    </span>
                  </div>

                  {/* GST Price Mode Selector (Inclusive vs Exclusive) */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 text-xs font-extrabold">
                    <button
                      type="button"
                      onClick={() => setGstPriceMode('exclusive')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center space-x-1 ${
                        gstPriceMode === 'exclusive'
                          ? 'bg-blue-600 text-white shadow-xs font-black'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {gstPriceMode === 'exclusive' && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>GST Added to Price</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGstPriceMode('inclusive')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center space-x-1 ${
                        gstPriceMode === 'inclusive'
                          ? 'bg-blue-600 text-white shadow-xs font-black'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {gstPriceMode === 'inclusive' && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>Price Includes GST</span>
                    </button>
                  </div>

                  <div className="flex space-x-1.5">
                    {ALLOWED_GST_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setGstRate(rate)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                          gstRate === rate
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-100 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>

                  {gstCalc.taxAmount > 0 && (
                    <div className="text-xs space-y-0.5 pt-1 text-blue-950 dark:text-blue-100 font-medium">
                      <div className="flex justify-between">
                        <span>{t.base_amount}:</span>
                        <span className="font-bold">{formatShopCurrency(gstCalc.baseAmount, shop?.country, shop?.currency_code)}</span>
                      </div>
                      {gstCalc.taxType === 'intra' ? (
                        <div className="flex justify-between text-[11px] text-blue-800 dark:text-blue-300 font-bold">
                          <span>{t.cgst} ({gstRate / 2}%) + {t.sgst} ({gstRate / 2}%):</span>
                          <span>+{formatShopCurrency(gstCalc.taxAmount, shop?.country, shop?.currency_code)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-[11px] text-blue-800 dark:text-blue-300 font-bold">
                          <span>{t.igst} ({gstRate}%):</span>
                          <span>+{formatShopCurrency(gstCalc.taxAmount, shop?.country, shop?.currency_code)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Amount Display */}
              <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 text-center shadow-inner overflow-hidden">
                <div className="text-xs text-slate-400 uppercase font-extrabold tracking-wider truncate">
                  {shop.gst_enabled ? t.total_with_tax : t.amount}
                </div>
                <div className="text-2xl sm:text-4xl font-black mt-1 tracking-tight flex items-center justify-center min-w-0">
                  <span className="text-slate-400 text-xl sm:text-2xl mr-1 shrink-0">{resolveCurrencySymbol(shop?.country, shop?.currency_code)}</span>
                  <span className={`truncate max-w-full ${finalTxAmount > 0 ? 'text-white' : 'text-slate-600'}`}>
                    {finalTxAmount.toLocaleString() || '0'}
                  </span>
                </div>
              </div>

              {/* Keypad (Only active when no line items are added) */}
              {items.length === 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button key={num} type="button" onClick={() => handleKeyPress(num)} className="num-btn">
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="num-btn bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs uppercase"
                  >
                    {t.clear_keypad}
                  </button>
                  <button type="button" onClick={() => handleKeyPress('0')} className="num-btn">
                    0
                  </button>
                  <button type="button" onClick={handleBackspace} className="num-btn bg-slate-200 hover:bg-slate-300 text-slate-700">
                    <Delete className="w-6 h-6" />
                  </button>
                </div>
              )}

              {/* Note Input */}
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.note_optional}
                  className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-slate-600 rounded-xl text-sm font-medium focus:border-blue-600 outline-none"
                />
              </div>

              {/* Save Button */}
              <button
                type="button"
                disabled={finalTxAmount <= 0 || isSubmitting}
                onClick={handleSaveTransaction}
                className={`w-full py-4 font-extrabold text-lg rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] ${
                  txType === 'credit_given'
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/30'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>{t.save_transaction}</span>
              </button>
              </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
