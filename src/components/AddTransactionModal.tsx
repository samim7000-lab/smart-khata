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
  ArrowLeft,
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
  ToggleRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';

export type TransactionMode = 'cash_sale' | 'credit_sale' | 'due_payment' | 'emi_plan';
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

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

  // Step Wizard State (Steps 1 to 6)
  const [currentStep, setCurrentStep] = useState<WizardStep>(preSelectedCustomer ? 2 : 1);

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
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemQtyInput, setItemQtyInput] = useState('1');
  const [itemUnitPriceInput, setItemUnitPriceInput] = useState('');

  // Discount State
  const [isDiscountEnabled, setIsDiscountEnabled] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountValStr, setDiscountValStr] = useState('');

  // Optional GST Toggle & Price Mode State (Requirement #6: Default OFF)
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

  // Progressive Disclosure Accordion State (Requirement #14)
  const [showAdvancedDetails, setShowAdvancedDetails] = useState<boolean>(false);

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

  // AUTO-FILL PREVIOUSLY SAVED CUSTOMER DETAILS ON SELECTION (Requirement #2, #24)
  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerState(c.state || '');
    setCustomerAddress(c.address || '');
    setCustomerGstin(c.gstin || '');
    setIsAddingNewCustomer(false);
    setCurrentStep(2); // Automatically advance to Step 2 (Transaction Type)
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
    setCurrentStep(2); // Advance to Step 2
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
  if (isSaleMode && isDiscountEnabled && discountVal > 0 && rawSubtotal > 0) {
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

  // Authoritative Customer Balance from Database (Requirement #12)
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

  // Submit Transaction & Save Receipt (Step 6 Confirmation)
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
      discount_type: isDiscountEnabled && discountVal > 0 ? discountType : undefined,
      discount_value: isDiscountEnabled && discountVal > 0 ? discountVal : undefined,
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

  // Dynamic Step Title & Progress Counter
  const totalSteps = txMode === 'due_payment' ? 4 : 6;
  const currentStepDisplay = txMode === 'due_payment' 
    ? (currentStep === 1 ? 1 : currentStep === 2 ? 2 : currentStep === 5 ? 3 : 4)
    : currentStep;

  const stepTitles = {
    1: 'Step 1: Customer Details',
    2: 'Step 2: Select Transaction Type',
    3: 'Step 3: Item & Price Details',
    4: 'Step 4: Discount & GST (Optional)',
    5: 'Step 5: Payment & Due Summary',
    6: 'Step 6: Review & Confirm Transaction',
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        
        {/* MODAL HEADER & PROGRESS INDICATOR BAR (REQUIREMENT #1) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 shrink-0 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-extrabold text-base tracking-tight">{t.add_new_transaction}</h3>
                <p className="text-[11px] text-blue-300 font-semibold">
                  {stepTitles[currentStep]}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Clean Step Indicator Tracker Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
              <span>Progress</span>
              <span>Step {currentStepDisplay} of {totalSteps}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentStepDisplay / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* MODAL SCROLLABLE BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* ========================================================================= */}
          {/* STEP 1: CUSTOMER SELECTION / CREATION (REQUIREMENT #2) */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {!isAddingNewCustomer ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                      Select Customer <span className="text-rose-500">*</span>
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
              ) : (
                /* INLINE NEW CUSTOMER FORM */
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
                      Back to Search
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

                  {/* PROGRESSIVE DISCLOSURE: OPTIONAL ADVANCED DETAILS (REQUIREMENT #14) */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                      className="text-xs font-extrabold text-blue-600 dark:text-blue-400 flex items-center space-x-1"
                    >
                      <span>{showAdvancedDetails ? 'Hide Optional Fields ▲' : 'More Details (Address/GSTIN) ▼'}</span>
                    </button>

                    {showAdvancedDetails && (
                      <div className="space-y-2.5 pt-2 animate-in fade-in">
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                            Customer Address (Optional)
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
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white font-extrabold rounded-xl text-xs shadow-md hover:bg-blue-700 transition-all flex items-center justify-center space-x-1.5"
                  >
                    <span>Save & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: TRANSACTION TYPE CARDS (REQUIREMENT #3) */}
          {/* ========================================================================= */}
          {currentStep === 2 && selectedCustomer && (
            <div className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-700/60 p-3 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-600">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</div>
                  <div className="font-black text-slate-900 dark:text-white text-sm">{selectedCustomer.display_label}</div>
                  <div className="text-[11px] text-slate-500 font-bold">{selectedCustomer.phone_number}</div>
                </div>
                {!preSelectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-extrabold text-blue-600 hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Select Transaction Type <span className="text-rose-500">*</span>
                </label>

                {/* Large Easy-to-Understand Cards (Requirement #3) */}
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTxMode('cash_sale');
                      setCurrentStep(3);
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left group ${
                      txMode === 'cash_sale'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-md'
                        : 'border-slate-200 bg-white dark:bg-slate-800 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl font-black shrink-0">
                        💵
                      </div>
                      <div>
                        <div className="font-black text-base text-slate-900 dark:text-white group-hover:text-emerald-600">
                          Cash Sale (Fully Paid)
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Customer pays full amount immediately</div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTxMode('credit_sale');
                      setCurrentStep(3);
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left group ${
                      txMode === 'credit_sale'
                        ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-md'
                        : 'border-slate-200 bg-white dark:bg-slate-800 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl font-black shrink-0">
                        📒
                      </div>
                      <div>
                        <div className="font-black text-base text-slate-900 dark:text-white group-hover:text-rose-600">
                          Due Sale (Buy Now, Pay Later)
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Customer buys on credit with optional down payment</div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTxMode('due_payment');
                      setCurrentStep(5); // Jump straight to Payment Amount! (Requirement #11)
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left group ${
                      txMode === 'due_payment'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-md'
                        : 'border-slate-200 bg-white dark:bg-slate-800 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl font-black shrink-0">
                        💳
                      </div>
                      <div>
                        <div className="font-black text-base text-slate-900 dark:text-white group-hover:text-blue-600">
                          Payment Received (Clear Due)
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Customer pays existing outstanding due balance</div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTxMode('emi_plan');
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left group ${
                      txMode === 'emi_plan'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-md'
                        : 'border-slate-200 bg-white dark:bg-slate-800 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl font-black shrink-0">
                        🏦
                      </div>
                      <div>
                        <div className="font-black text-base text-slate-900 dark:text-white group-hover:text-purple-600">
                          EMI Installment Plan
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Set up custom monthly EMI financing schedule</div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RENDER INLINE EMI FORM WHEN EMI MODE SELECTED */}
          {txMode === 'emi_plan' && currentStep === 2 && selectedCustomer && (
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
          )}

          {/* ========================================================================= */}
          {/* STEP 3: ITEM & PRICE DETAILS (REQUIREMENT #4) */}
          {/* ========================================================================= */}
          {currentStep === 3 && isSaleMode && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center">
                    <ShoppingBag className="w-4 h-4 mr-1 text-blue-600" />
                    <span>Product / Item Breakdown</span>
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-black">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Line Items Table */}
                {items.length > 0 && (
                  <div className="divide-y divide-slate-200 dark:divide-slate-600 max-h-40 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-2 text-xs">
                    {items.map((item) => (
                      <div key={item.id} className="py-2 flex items-center justify-between">
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
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Single / Multiple Item Input Form */}
                <div className="space-y-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                      Product / Item Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Medicine A"
                      value={itemNameInput}
                      onChange={(e) => setItemNameInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Quantity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={itemQtyInput}
                        onChange={(e) => setItemQtyInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Unit Price <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 400"
                        value={itemUnitPriceInput}
                        onChange={(e) => setItemUnitPriceInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-extrabold text-xs rounded-xl flex items-center justify-center space-x-1 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Another Item</span>
                  </button>
                </div>

                {/* Subtotal Display */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-600 text-xs font-extrabold">
                  <span className="text-slate-600 dark:text-slate-400 uppercase">Subtotal Amount:</span>
                  <span className="text-base text-slate-900 dark:text-white font-black">
                    {formatShopCurrency(rawSubtotal, shop?.country, shop?.currency_code)}
                  </span>
                </div>
              </div>

              {/* Step Navigation Buttons */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-extrabold rounded-xl text-xs hover:bg-slate-200 transition-colors flex items-center justify-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (rawSubtotal <= 0) {
                      alert('Please enter at least 1 item or product price.');
                      return;
                    }
                    setCurrentStep(4);
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white font-extrabold rounded-xl text-xs hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1 shadow-md"
                >
                  <span>Next: Discount & GST</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: DISCOUNT & GST (REQUIREMENTS #5, #6) */}
          {/* ========================================================================= */}
          {currentStep === 4 && isSaleMode && (
            <div className="space-y-4">
              
              {/* DISCOUNT SECTION (REQUIREMENT #5) */}
              <div className="bg-slate-50 dark:bg-slate-700/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center">
                    <Tag className="w-4 h-4 mr-1 text-emerald-600" />
                    <span>Apply Discount (Optional)</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsDiscountEnabled(!isDiscountEnabled)}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                      isDiscountEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isDiscountEnabled ? 'Discount On' : 'No Discount'}
                  </button>
                </div>

                {isDiscountEnabled && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-600 animate-in fade-in">
                    <div className="flex space-x-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black ${
                          discountType === 'fixed' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                        }`}
                      >
                        Fixed Amount ({resolveCurrencySymbol(shop?.country, shop?.currency_code)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percentage')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black ${
                          discountType === 'percentage' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                        }`}
                      >
                        Percentage (%)
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        placeholder={discountType === 'percentage' ? 'e.g. 10%' : 'e.g. 100'}
                        value={discountValStr}
                        onChange={(e) => setDiscountValStr(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                      />
                      {discountAmount > 0 && (
                        <span className="text-xs font-black text-emerald-600 shrink-0">
                          -{formatShopCurrency(discountAmount, shop?.country, shop?.currency_code)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* GST SECTION (REQUIREMENT #6 - Default OFF) */}
              <div className="bg-blue-50/70 dark:bg-blue-950/60 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center">
                    <Percent className="w-4 h-4 mr-1 text-blue-600 shrink-0" />
                    <span>Apply GST Tax (Optional)</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsGstEnabled(!isGstEnabled)}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-black transition-all ${
                      isGstEnabled ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isGstEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    <span>{isGstEnabled ? 'GST On' : 'GST Off'}</span>
                  </button>
                </div>

                {isGstEnabled && (
                  <div className="space-y-2.5 pt-2 border-t border-blue-200/60 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 text-xs font-extrabold">
                      <button
                        type="button"
                        onClick={() => setGstPriceMode('exclusive')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center space-x-1 ${
                          gstPriceMode === 'exclusive' ? 'bg-blue-600 text-white font-black' : 'text-slate-600'
                        }`}
                      >
                        {gstPriceMode === 'exclusive' && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>GST Added to Price</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGstPriceMode('inclusive')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center space-x-1 ${
                          gstPriceMode === 'inclusive' ? 'bg-blue-600 text-white font-black' : 'text-slate-600'
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
                            gstRate === rate ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>

                    {gstCalc.taxAmount > 0 && (
                      <div className="text-xs space-y-0.5 pt-1 text-blue-950 font-medium">
                        <div className="flex justify-between">
                          <span>Taxable Base Amount:</span>
                          <span className="font-bold">{formatShopCurrency(gstCalc.baseAmount, shop?.country, shop?.currency_code)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-blue-800 font-bold">
                          <span>GST Amount ({gstRate}%):</span>
                          <span>+{formatShopCurrency(gstCalc.taxAmount, shop?.country, shop?.currency_code)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step Navigation Buttons */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-extrabold rounded-xl text-xs hover:bg-slate-200 transition-colors flex items-center justify-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="flex-1 py-3 bg-blue-600 text-white font-extrabold rounded-xl text-xs hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1 shadow-md"
                >
                  <span>Next: Payment Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: PAYMENT & DUE SUMMARY (REQUIREMENTS #9, #10, #11, #12) */}
          {/* ========================================================================= */}
          {currentStep === 5 && selectedCustomer && (
            <div className="space-y-4">
              
              {/* CASH SALE PAYMENT SUMMARY */}
              {txMode === 'cash_sale' && (
                <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-700 font-bold">
                    <span>Grand Total Amount:</span>
                    <span className="font-black text-slate-900 text-base">{formatShopCurrency(grandTotalAmount, shop?.country, shop?.currency_code)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-800 font-extrabold border-t border-emerald-200/60 pt-2">
                    <span>Paid Amount (Cash):</span>
                    <span className="font-black text-emerald-600 text-base">{formatShopCurrency(grandTotalAmount, shop?.country, shop?.currency_code)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold text-slate-500">Payment Status:</span>
                    <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-md font-black text-[10px] uppercase">
                      ✓ PAID IN FULL
                    </span>
                  </div>
                </div>
              )}

              {/* DUE SALE PAYMENT & DOWN PAYMENT SUMMARY */}
              {txMode === 'credit_sale' && (
                <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800">Paid Now / Down Payment (Optional)</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 300"
                      value={paidNowStr}
                      onChange={(e) => setPaidNowStr(e.target.value)}
                      className="w-28 px-2.5 py-1.5 bg-white border border-rose-300 rounded-xl text-xs font-black outline-none text-right"
                    />
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-rose-200/60 text-slate-700 font-bold">
                    <div className="flex justify-between">
                      <span>Grand Total Purchase:</span>
                      <span>{formatShopCurrency(grandTotalAmount, shop?.country, shop?.currency_code)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-extrabold">
                      <span>New Purchase Due:</span>
                      <span>{formatShopCurrency(newPurchaseDue, shop?.country, shop?.currency_code)}</span>
                    </div>
                    
                    {/* Requirement #12: Show Previous Due from DB (0 if first transaction) */}
                    <div className="flex justify-between text-slate-600">
                      <span>Previous Outstanding Due:</span>
                      <span>{formatShopCurrency(previousDue, shop?.country, shop?.currency_code)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-slate-900 font-black text-sm pt-2 border-t border-rose-200">
                      <span>Total Outstanding Due:</span>
                      <span className="text-rose-600 text-base">{formatShopCurrency(remainingDue, shop?.country, shop?.currency_code)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PAYMENT RECEIVED / DUE CLEARANCE SUMMARY */}
              {txMode === 'due_payment' && (
                <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 space-y-3 text-xs">
                  <div className="flex justify-between items-center text-blue-950 font-extrabold pb-2 border-b border-blue-200">
                    <span>Previous Outstanding Due:</span>
                    <span className="font-black text-rose-600 text-base">{formatShopCurrency(previousDue, shop?.country, shop?.currency_code)}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Payment Amount Received <span className="text-rose-500">*</span>
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
                    <span>Remaining Outstanding Due:</span>
                    <span className={`text-base font-black ${remainingDue <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatShopCurrency(remainingDue, shop?.country, shop?.currency_code)}
                    </span>
                  </div>
                </div>
              )}

              {/* PROGRESSIVE DISCLOSURE: PAYMENT METHOD & NOTES (REQUIREMENT #14) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                  className="text-xs font-extrabold text-blue-600 flex items-center space-x-1"
                >
                  <span>{showAdvancedDetails ? 'Hide Payment Method & Notes ▲' : 'More Details (Payment Method / Note) ▼'}</span>
                </button>

                {showAdvancedDetails && (
                  <div className="space-y-2.5 pt-2 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">Payment Method</label>
                      <div className="grid grid-cols-4 gap-1.5 text-xs font-extrabold">
                        {['Cash', 'UPI', 'Card', 'Bank'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMethod(m)}
                            className={`py-1.5 rounded-lg text-center ${
                              paymentMethod === m ? 'bg-slate-900 text-white font-black' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">Payment Note / Remarks</label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. Partial down payment or cheque details"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step Navigation Buttons */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(txMode === 'due_payment' ? 2 : 4)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-extrabold rounded-xl text-xs hover:bg-slate-200 transition-colors flex items-center justify-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (txMode === 'due_payment' && enteredVal <= 0) {
                      alert('Please enter a valid payment amount.');
                      return;
                    }
                    setCurrentStep(6); // Advance to Review Step 6!
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white font-extrabold rounded-xl text-xs hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1 shadow-md"
                >
                  <span>Review Transaction</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 6: REVIEW & CONFIRM TRANSACTION (REQUIREMENT #15) */}
          {/* ========================================================================= */}
          {currentStep === 6 && selectedCustomer && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 text-xs shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-extrabold uppercase text-[10px] text-blue-400 tracking-wider">Transaction Summary</span>
                  <span className="font-black text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                    {txMode === 'cash_sale' ? 'Cash Sale' : txMode === 'credit_sale' ? 'Due Sale' : 'Payment Received'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Customer Info</div>
                  <div className="font-black text-white text-sm">{selectedCustomer.display_label}</div>
                  <div className="text-slate-400 font-medium">{selectedCustomer.phone_number}</div>
                  {customerAddress && <div className="text-slate-400 text-[11px]">📍 {customerAddress}</div>}
                </div>

                {isSaleMode && items.length > 0 && (
                  <div className="space-y-1 border-t border-slate-800 pt-2">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Line Items</div>
                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span>{item.name} ({item.quantity}×)</span>
                          <span className="font-bold">{formatShopCurrency(item.total, shop?.country, shop?.currency_code)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 border-t border-slate-800 pt-2 text-slate-300">
                  {isSaleMode && (
                    <>
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-bold">{formatShopCurrency(rawSubtotal, shop?.country, shop?.currency_code)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Discount:</span>
                          <span>-{formatShopCurrency(discountAmount, shop?.country, shop?.currency_code)}</span>
                        </div>
                      )}
                      {isGstEnabled && (
                        <div className="flex justify-between text-blue-300">
                          <span>GST Tax ({gstRate}%):</span>
                          <span>+{formatShopCurrency(gstCalc.taxAmount, shop?.country, shop?.currency_code)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-white font-black text-sm pt-1 border-t border-slate-800">
                        <span>Grand Total:</span>
                        <span>{formatShopCurrency(grandTotalAmount, shop?.country, shop?.currency_code)}</span>
                      </div>
                    </>
                  )}

                  {txMode === 'credit_sale' && (
                    <>
                      <div className="flex justify-between text-emerald-400">
                        <span>Paid Now:</span>
                        <span>{formatShopCurrency(paidNowVal, shop?.country, shop?.currency_code)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>New Purchase Due:</span>
                        <span>{formatShopCurrency(newPurchaseDue, shop?.country, shop?.currency_code)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-slate-400">
                    <span>Previous Outstanding Due:</span>
                    <span>{formatShopCurrency(previousDue, shop?.country, shop?.currency_code)}</span>
                  </div>

                  <div className="flex justify-between items-center text-white font-black text-base pt-2 border-t border-slate-700">
                    <span>Total Outstanding Due:</span>
                    <span className={`text-lg font-black ${remainingDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formatShopCurrency(remainingDue, shop?.country, shop?.currency_code)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit vs Confirm & Generate Receipt */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-extrabold rounded-2xl text-xs hover:bg-slate-200 transition-colors flex items-center justify-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>← Edit Details</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSaveTransaction}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Confirm & Generate Receipt</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
