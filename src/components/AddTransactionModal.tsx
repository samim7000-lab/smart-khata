import React, { useState } from 'react';
import { Customer, Language, Shop, TransactionType } from '../types';
import { translations } from '../i18n/translations';
import { CountryPhoneInput } from './CountryPhoneInput';
import { calculateGst, ALLOWED_GST_RATES, GstCalculationResult } from '../lib/gstUtils';
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
  MapPin
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
    newCustomerData?: { name: string; phone: string; displayLabel: string; state?: string },
    gstDetails?: GstCalculationResult
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

  // Transaction Details State
  const [txType, setTxType] = useState<TransactionType>('credit_given');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // GST State
  const [gstRate, setGstRate] = useState<number>(shop.default_gst_rate || 18);
  const [customerState, setCustomerState] = useState<string>(preSelectedCustomer?.state || '');

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

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerState(c.state || '');
    setIsAddingNewCustomer(false);
  };

  const handleCreateNewCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

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

  // Live GST Calculation
  const enteredVal = parseFloat(amountStr) || 0;
  const gstCalc = calculateGst(
    enteredVal,
    gstRate,
    shop.gst_enabled,
    shop.state,
    customerState || selectedCustomer?.state
  );

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
    if (!selectedCustomer || enteredVal <= 0) return;

    let newCustPayload;
    if (selectedCustomer.id.startsWith('temp-')) {
      newCustPayload = {
        name: selectedCustomer.name,
        phone: selectedCustomer.phone_number,
        displayLabel: selectedCustomer.display_label,
        state: selectedCustomer.state,
      };
    }

    // Save final total amount
    onSave(
      selectedCustomer.id,
      txType,
      gstCalc.totalAmount,
      note.trim(),
      newCustPayload,
      shop.gst_enabled ? gstCalc : undefined
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
                        {t.currency_symbol} {(c.balance || 0).toLocaleString()}
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

              {/* Transaction Type Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTxType('credit_given')}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                    txType === 'credit_given'
                      ? 'border-red-600 bg-red-50 text-red-700 shadow-md'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <MinusCircle className="w-7 h-7 text-red-600 mb-1" />
                  <span className="font-extrabold text-sm">{t.credit_given}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTxType('payment_received')}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                    txType === 'payment_received'
                      ? 'border-green-600 bg-green-50 text-green-700 shadow-md'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <PlusCircle className="w-7 h-7 text-green-600 mb-1" />
                  <span className="font-extrabold text-sm">{t.payment_received}</span>
                </button>
              </div>

              {/* GST Tax Selector Bar (When GST Enabled) */}
              {shop.gst_enabled && (
                <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-blue-900">
                    <span className="flex items-center">
                      <Percent className="w-4 h-4 mr-1 text-blue-600" />
                      {t.select_gst_rate}
                    </span>
                    <span className="text-[11px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-md uppercase">
                      {gstCalc.taxType === 'intra' ? t.intra_state_tax : t.inter_state_tax}
                    </span>
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
                            : 'bg-white text-slate-700 hover:bg-blue-100 border border-slate-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>

                  {gstCalc.taxAmount > 0 && (
                    <div className="text-xs space-y-0.5 pt-1 text-blue-950 font-medium">
                      <div className="flex justify-between">
                        <span>{t.base_amount}:</span>
                        <span>{t.currency_symbol} {gstCalc.baseAmount.toLocaleString()}</span>
                      </div>
                      {gstCalc.taxType === 'intra' ? (
                        <div className="flex justify-between text-[11px] text-blue-800 font-bold">
                          <span>{t.cgst} ({gstRate / 2}%) + {t.sgst} ({gstRate / 2}%):</span>
                          <span>+{t.currency_symbol} {gstCalc.taxAmount.toLocaleString()}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-[11px] text-blue-800 font-bold">
                          <span>{t.igst} ({gstRate}%):</span>
                          <span>+{t.currency_symbol} {gstCalc.taxAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Amount Display */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 text-center shadow-inner">
                <div className="text-xs text-slate-400 uppercase font-extrabold tracking-wider">
                  {shop.gst_enabled ? t.total_with_tax : t.amount}
                </div>
                <div className="text-4xl font-black mt-1 tracking-tight flex items-center justify-center">
                  <span className="text-slate-400 text-2xl mr-1">{t.currency_symbol}</span>
                  <span className={enteredVal > 0 ? 'text-white' : 'text-slate-600'}>
                    {gstCalc.totalAmount.toLocaleString() || '0'}
                  </span>
                </div>
              </div>

              {/* Keypad */}
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
                disabled={enteredVal <= 0}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
