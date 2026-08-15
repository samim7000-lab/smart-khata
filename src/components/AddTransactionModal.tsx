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
  Check,
  Banknote,
  Receipt,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export type TransactionMode = 'cash_sale' | 'credit_sale' | 'due_payment' | 'emi_plan';

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

  // Selected Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    preSelectedCustomer || null
  );
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newState, setNewState] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  // Transaction Mode State (Cash Sale | Credit Sale | Due Payment | EMI Plan)
  const [txMode, setTxMode] = useState<TransactionMode>('credit_sale');

  // Customer Auto-Fill & Detail State
  const [customerState, setCustomerState] = useState<string>(preSelectedCustomer?.state || '');
  const [customerAddress, setCustomerAddress] = useState<string>(preSelectedCustomer?.address || '');
  const [customerGstin, setCustomerGstin] = useState<string>(preSelectedCustomer?.gstin || '');

  // Form Fields & Line Items State
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [showItemsSection, setShowItemsSection] = useState(true);
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemQtyInput, setItemQtyInput] = useState('1');
  const [itemUnitPriceInput, setItemUnitPriceInput] = useState('');

  // Discount State
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountValStr, setDiscountValStr] = useState('');

  // Optional GST Toggle & Price Mode State
  const [isGstEnabled, setIsGstEnabled] = useState<boolean>(false);
  const [gstRate, setGstRate] = useState<number>(shop.default_gst_rate || 18);
  const [gstPriceMode, setGstPriceMode] = useState<GstPriceMode>('exclusive');

  // Payment Details State
  const [amountStr, setAmountStr] = useState('');
  const [paidNowStr, setPaidNowStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer Name duplicate validation
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

  // AUTO-FILL PREVIOUSLY SAVED CUSTOMER DETAILS ON SELECTION (Requirement #3, #18)
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
      address: customerAddress.trim(),
      gstin: customerGstin.trim(),
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

  // Real-Time Financial & Ledger Calculations
  const itemsSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  const enteredVal = parseFloat(amountStr) || 0;
  const isSaleMode = txMode === 'cash_sale' || txMode === 'credit_sale';

  const rawSubtotal = isSaleMode
    ? (items.length > 0 ? itemsSubtotal : enteredVal)
    : enteredVal;

  const discountVal = parseFloat(discountValStr) || 0;
  let discountAmount = 0;
  if (isSaleMode && discountVal > 0 && rawSubtotal > 0) {
    if (discountType === 'percentage') {
      discountAmount = Math.round((rawSubtotal * (discountVal / 100)) * 100) / 100;
    } else {
      discountAmount = Math.min(rawSubtotal, discountVal);
    }
  }

  const taxableSubtotal = Math.max(0, rawSubtotal - discountAmount);

  // Optional GST Engine Calculation
  const gstCalc = calculateGst(
    taxableSubtotal,
    gstRate,
    isGstEnabled,
    shop.state,
    customerState || selectedCustomer?.state,
    gstPriceMode
  );

  const grandTotalAmount = isGstEnabled ? gstCalc.totalAmount : taxableSubtotal;

  // Credit sale down payment / paid now
  const paidNowVal = Math.max(0, parseFloat(paidNowStr) || 0);
  const newPurchaseDue = Math.max(0, grandTotalAmount - paidNowVal);

  // Authoritative Customer Balance from Database
  const previousDue = selectedCustomer?.balance || 0;

  // Total Outstanding Due after this transaction
  let remainingDue = 0;
  if (txMode === 'cash_sale') {
    remainingDue = Math.max(0, previousDue);
  } else if (txMode === 'credit_sale') {
    remainingDue = previousDue + newPurchaseDue;
  } else if (txMode === 'due_payment') {
    remainingDue = Math.max(0, previousDue - enteredVal);
  }

  // Keypad Handlers for quick payment entry
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

  // Submit Transaction & Save Receipt
  const handleSaveTransaction = () => {
    if (!selectedCustomer || isSubmitting) return;

    if (txMode === 'due_payment' && enteredVal <= 0) {
      alert(language === 'bn' ? 'সঠিক জমার পরিমাণ লিখুন।' : 'Please enter a valid payment amount.');
      return;
    }

    if (isSaleMode && grandTotalAmount <= 0) {
      alert(language === 'bn' ? 'সঠিক পরিমাণ বা পণ্যের মূল্য লিখুন।' : 'Please enter item price or transaction amount.');
      return;
    }

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
        address: customerAddress.trim() || undefined,
        gstin: customerGstin.trim() || undefined,
      };
    }

    const receiptDetails: ReceiptDetailsPayload = {
      mode: txMode,
      items: isSaleMode && items.length > 0 ? items : undefined,
      discount_type: discountVal > 0 ? discountType : undefined,
      discount_value: discountVal > 0 ? discountVal : undefined,
      discount_amount: discountAmount > 0 ? discountAmount : undefined,
      subtotal: isSaleMode ? rawSubtotal : undefined,
      taxable_amount: isSaleMode ? taxableSubtotal : undefined,
      gst_price_mode: isGstEnabled ? gstPriceMode : undefined,
      previous_balance: previousDue,
      paid_amount: txMode === 'cash_sale' ? grandTotalAmount : (txMode === 'credit_sale' ? paidNowVal : enteredVal),
      new_due_amount: txMode === 'credit_sale' ? newPurchaseDue : 0,
      payment_method: paymentMethod,
      gst_enabled: isGstEnabled,
      customer_address: customerAddress.trim() || undefined,
      customer_gstin: customerGstin.trim() || undefined,
      notes: note.trim() || undefined,
    };

    const targetType: TransactionType = txMode === 'credit_sale' ? 'credit_given' : 'payment_received';
    const targetAmount = txMode === 'due_payment' ? enteredVal : grandTotalAmount;

    onSave(
      selectedCustomer.id,
      targetType,
      targetAmount,
      note.trim(),
      newCustPayload,
      isGstEnabled ? gstCalc : undefined,
      undefined,
      undefined,
      receiptDetails
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-extrabold text-base tracking-tight">{t.add_new_transaction}</h3>
              {selectedCustomer && (
                <p className="text-xs text-slate-400 font-medium">
                  Customer: <span className="font-bold text-white">{selectedCustomer.display_label}</span>
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* STEP 1: SELECT OR CREATE CUSTOMER */}
          {!selectedCustomer && !isAddingNewCustomer && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Select Customer *
                </h4>
                <button
                  onClick={() => setIsAddingNewCustomer(true)}
                  className="inline-flex items-center text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  + Add New Customer
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer name or mobile..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 rounded-xl font-bold border border-gray-300 dark:border-slate-600 focus:border-blue-600 outline-none text-xs"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/60 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl transition-all text-left group"
                  >
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 text-sm">
                        {c.display_label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{c.phone_number}</div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xs font-black ${
                          (c.balance || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {(c.balance || 0) > 0 ? `Due: ${formatShopCurrency(c.balance, shop?.country, shop?.currency_code)}` : '✓ Clear'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 B: INLINE NEW CUSTOMER FORM */}
          {isAddingNewCustomer && (
            <form onSubmit={handleCreateNewCustomerSubmit} className="space-y-3 bg-slate-50 dark:bg-slate-700/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  New Customer Info
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCustomer(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Samim Gayen"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-xl border border-gray-300 dark:border-slate-600 font-bold text-sm outline-none"
                />
              </div>

              {duplicateWarning && (
                <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-xl text-amber-900 text-xs font-semibold flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>{duplicateWarning}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <CountryPhoneInput
                  language={language}
                  value={newPhone}
                  onChange={(e164) => setNewPhone(e164)}
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Street, City, Postal Code"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-xl border border-gray-300 dark:border-slate-600 text-xs font-medium outline-none"
                />
              </div>

              {shop.gst_enabled && (
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(e.target.value)}
                    placeholder="e.g. 19ABCDE1234F1Z5"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-xl border border-gray-300 dark:border-slate-600 text-xs font-mono font-bold outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 text-white font-extrabold rounded-xl text-xs shadow-md hover:bg-blue-700 transition-all flex items-center justify-center space-x-1.5"
              >
                <span>Save & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: DYNAMIC TRANSACTION DETAILS FORM */}
          {selectedCustomer && (
            <div className="space-y-4">
              
              {/* CUSTOMER CARD AUTO-FILL HEADER */}
              <div className="bg-slate-100 dark:bg-slate-700/60 p-3 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-600">
                <div className="min-w-0 pr-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Selected Customer</div>
                  <div className="font-black text-slate-900 dark:text-white text-sm truncate">{selectedCustomer.display_label}</div>
                  <div className="text-[11px] text-slate-500 font-bold">{selectedCustomer.phone_number}</div>
                </div>
                {!preSelectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs font-extrabold text-blue-600 hover:underline shrink-0"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* DYNAMIC MODE SELECTOR TABS (REQUIREMENT #1 & #10) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Transaction Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setTxMode('cash_sale');
                    }}
                    className={`py-2 px-2 rounded-xl flex flex-col items-center justify-center font-extrabold transition-all text-center min-h-[46px] ${
                      txMode === 'cash_sale'
                        ? 'bg-emerald-600 text-white shadow-md font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 mb-0.5" />
                    <span className="text-[11px]">Cash Sale</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTxMode('credit_sale');
                    }}
                    className={`py-2 px-2 rounded-xl flex flex-col items-center justify-center font-extrabold transition-all text-center min-h-[46px] ${
                      txMode === 'credit_sale'
                        ? 'bg-rose-600 text-white shadow-md font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <MinusCircle className="w-4 h-4 mb-0.5" />
                    <span className="text-[11px]">Due Sale</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTxMode('due_payment');
                    }}
                    className={`py-2 px-2 rounded-xl flex flex-col items-center justify-center font-extrabold transition-all text-center min-h-[46px] ${
                      txMode === 'due_payment'
                        ? 'bg-blue-600 text-white shadow-md font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <Banknote className="w-4 h-4 mb-0.5" />
                    <span className="text-[11px]">Payment Recv</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTxMode('emi_plan');
                    }}
                    className={`py-2 px-2 rounded-xl flex flex-col items-center justify-center font-extrabold transition-all text-center min-h-[46px] ${
                      txMode === 'emi_plan'
                        ? 'bg-purple-600 text-white shadow-md font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mb-0.5" />
                    <span className="text-[11px]">EMI Plan</span>
                  </button>
                </div>
              </div>

              {/* RENDER INLINE EMI FORM WHEN EMI MODE SELECTED */}
              {txMode === 'emi_plan' ? (
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
                          address: customerAddress,
                          gstin: customerGstin,
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
                    onCancel={() => setTxMode('credit_sale')}
                  />
                </div>
              ) : (
                <>

              {/* DYNAMIC FORM SECTION A: PRODUCT / ITEM DETAILS (Only rendered for Cash Sale & Due Sale!) */}
              {isSaleMode && (
                <div className="bg-slate-50 dark:bg-slate-700/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center">
                      <ShoppingBag className="w-4 h-4 mr-1 text-blue-600" />
                      <span>Product / Item Breakdown</span>
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-black">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Line Items List */}
                  {items.length > 0 && (
                    <div className="divide-y divide-slate-200 dark:divide-slate-600 max-h-36 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-2 text-xs">
                      {items.map((item) => (
                        <div key={item.id} className="py-1.5 flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <div className="font-extrabold text-slate-900 dark:text-white truncate">{item.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {item.quantity} × {formatShopCurrency(item.unit_price, shop?.country, shop?.currency_code)}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="font-black text-slate-900 dark:text-white">
                              {formatShopCurrency(item.total, shop?.country, shop?.currency_code)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
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
                      placeholder="Product Name * (e.g. Medicine A)"
                      value={itemNameInput}
                      onChange={(e) => setItemNameInput(e.target.value)}
                      className="col-span-5 px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty *"
                      value={itemQtyInput}
                      onChange={(e) => setItemQtyInput(e.target.value)}
                      className="col-span-2 px-2 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none text-center"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Unit Price *"
                      value={itemUnitPriceInput}
                      onChange={(e) => setItemUnitPriceInput(e.target.value)}
                      className="col-span-3 px-2 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center transition-colors shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* DYNAMIC FORM SECTION B: DISCOUNT (Only rendered for Sale modes!) */}
              {isSaleMode && (
                <div className="bg-slate-50 dark:bg-slate-700/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center">
                      <Tag className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      <span>Discount (Optional)</span>
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
              )}

              {/* DYNAMIC FORM SECTION C: OPTIONAL GST TOGGLE (REQUIREMENT #5) */}
              {isSaleMode && (
                <div className="bg-blue-50/70 dark:bg-blue-950/60 p-3 sm:p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center">
                      <Percent className="w-4 h-4 mr-1 text-blue-600 shrink-0" />
                      <span>Add GST (Optional)</span>
                    </span>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => setIsGstEnabled(!isGstEnabled)}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-black transition-all ${
                        isGstEnabled ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isGstEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{isGstEnabled ? 'GST Enabled' : 'GST Disabled'}</span>
                    </button>
                  </div>

                  {/* Render GST Options when Enabled */}
                  {isGstEnabled && (
                    <div className="space-y-2 pt-1 border-t border-blue-200/60">
                      {/* Price Mode Selector (Inclusive vs Exclusive) */}
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 text-xs font-extrabold">
                        <button
                          type="button"
                          onClick={() => setGstPriceMode('exclusive')}
                          className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center space-x-1 ${
                            gstPriceMode === 'exclusive'
                              ? 'bg-blue-600 text-white font-black'
                              : 'text-slate-600 dark:text-slate-300'
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
                              ? 'bg-blue-600 text-white font-black'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {gstPriceMode === 'inclusive' && <Check className="w-3 h-3 stroke-[3]" />}
                          <span>Price Includes GST</span>
                        </button>
                      </div>

                      {/* GST Rate Selector */}
                      <div className="flex space-x-1.5">
                        {ALLOWED_GST_RATES.map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setGstRate(rate)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                              gstRate === rate
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>

                      {gstCalc.taxAmount > 0 && (
                        <div className="text-xs space-y-0.5 pt-1 text-blue-950 dark:text-blue-100 font-medium">
                          <div className="flex justify-between">
                            <span>Taxable Base Amount:</span>
                            <span className="font-bold">{formatShopCurrency(gstCalc.baseAmount, shop?.country, shop?.currency_code)}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-blue-800 dark:text-blue-300 font-bold">
                            <span>GST Amount ({gstRate}%):</span>
                            <span>+{formatShopCurrency(gstCalc.taxAmount, shop?.country, shop?.currency_code)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* DYNAMIC FORM SECTION D: PURE PAYMENT INPUT (Only rendered for Due Payment mode!) */}
              {txMode === 'due_payment' && (
                <div className="space-y-3 bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 text-xs">
                  <div className="flex justify-between items-center text-blue-950 font-bold border-b border-blue-200 pb-2">
                    <span>Previous Outstanding Due:</span>
                    <span className="font-black text-rose-600 text-sm">{formatShopCurrency(previousDue, shop?.country, shop?.currency_code)}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Payment Amount Received * <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-blue-300 rounded-xl text-base font-black outline-none"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1 text-slate-900 font-extrabold">
                    <span>Remaining Due after payment:</span>
                    <span className={`text-sm font-black ${remainingDue <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatShopCurrency(remainingDue, shop?.country, shop?.currency_code)}
                    </span>
                  </div>
                </div>
              )}

              {/* DYNAMIC FORM SECTION E: DUE SALE DOWN PAYMENT INPUT (Only for Credit Sale!) */}
              {txMode === 'credit_sale' && (
                <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-rose-950">Paid Now / Down Payment (Optional)</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 300"
                      value={paidNowStr}
                      onChange={(e) => setPaidNowStr(e.target.value)}
                      className="w-28 px-2.5 py-1 bg-white border border-rose-300 rounded-lg text-xs font-black outline-none text-right"
                    />
                  </div>

                  <div className="space-y-1 pt-1 text-[11px] text-slate-700 font-bold border-t border-rose-200/60">
                    <div className="flex justify-between">
                      <span>New Purchase Due:</span>
                      <span className="text-rose-700">{formatShopCurrency(newPurchaseDue, shop?.country, shop?.currency_code)}</span>
                    </div>
                    {previousDue > 0 && (
                      <div className="flex justify-between">
                        <span>Previous Outstanding Due:</span>
                        <span>{formatShopCurrency(previousDue, shop?.country, shop?.currency_code)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-black text-slate-900 pt-1 border-t border-rose-200">
                      <span>Total Outstanding Due:</span>
                      <span className="text-rose-600">{formatShopCurrency(remainingDue, shop?.country, shop?.currency_code)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* AMOUNT DISPLAY & KEYPAD (When no line items entered in sale modes) */}
              {isSaleMode && items.length === 0 && (
                <>
                  <div className="bg-slate-900 text-white rounded-2xl p-3.5 text-center shadow-inner overflow-hidden">
                    <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider truncate">
                      {isGstEnabled ? t.total_with_tax : t.amount}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black mt-1 tracking-tight flex items-center justify-center">
                      <span className="text-slate-400 text-lg mr-1 shrink-0">{resolveCurrencySymbol(shop?.country, shop?.currency_code)}</span>
                      <span className={`truncate ${grandTotalAmount > 0 ? 'text-white' : 'text-slate-600'}`}>
                        {grandTotalAmount.toLocaleString() || '0'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <button key={num} type="button" onClick={() => handleKeyPress(num)} className="num-btn">
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleClear}
                      className="num-btn bg-slate-200 text-slate-700 font-extrabold text-xs uppercase"
                    >
                      CLEAR
                    </button>
                    <button type="button" onClick={() => handleKeyPress('0')} className="num-btn">
                      0
                    </button>
                    <button type="button" onClick={handleBackspace} className="num-btn bg-slate-200 text-slate-700">
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}

              {/* OPTIONAL NOTE & PAYMENT METHOD INPUT */}
              <div className="grid grid-cols-1 gap-2">
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Payment Note (Optional)"
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-xl text-xs font-medium outline-none"
                  />
                </div>
              </div>

              {/* FINAL ACTION BUTTON: GENERATE RECEIPT & SAVE (REQUIREMENT #1 & #20) */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveTransaction}
                className={`w-full py-4 font-black text-base rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] ${
                  txMode === 'credit_sale'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                    : txMode === 'cash_sale'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Sparkles className="w-5 h-5" />
                <span>Save & Generate Receipt</span>
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
