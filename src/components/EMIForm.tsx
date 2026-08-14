import React, { useState, useMemo } from 'react';
import { Customer, Language, Shop } from '../types';
import { calculateFinancedAmount, calculateInstallmentAmount } from '../lib/emiCalculations';
import { EMIService, CreateEMIPayload } from '../lib/emiService';
import { formatShopCurrency } from '../lib/countryPricing';
import { CreditCard, Calendar, ShoppingBag, Calculator, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface EMIPayloadData {
  product_name: string;
  total_amount: number;
  down_payment: number;
  financed_amount: number;
  installment_count: number;
  installment_amount: number;
  start_date: string;
  notes?: string;
  customer_id?: string;
}

interface Props {
  shop: Shop;
  customers: Customer[];
  selectedCustomer?: Customer | null;
  language: Language;
  initialAmount?: number;
  initialNote?: string;
  onSaveEMI: (emiData: EMIPayloadData) => void;
  onCancel: () => void;
}

export const EMIForm: React.FC<Props> = ({
  shop,
  customers,
  selectedCustomer,
  language,
  initialAmount = 0,
  initialNote = '',
  onSaveEMI,
  onCancel,
}) => {
  const [customerId, setCustomerId] = useState<string>(selectedCustomer?.id || (customers[0]?.id || ''));
  const [productName, setProductName] = useState<string>(initialNote || '');
  const [totalAmountStr, setTotalAmountStr] = useState<string>(initialAmount > 0 ? String(initialAmount) : '');
  const [downPaymentStr, setDownPaymentStr] = useState<string>('0');
  const [installmentCount, setInstallmentCount] = useState<number>(6);

  // Default first due date: 1 month from today
  const defaultFirstDueDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [firstDueDate, setFirstDueDate] = useState<string>(defaultFirstDueDate);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Math Computations
  const totalAmount = Number(totalAmountStr) || 0;
  const downPayment = Number(downPaymentStr) || 0;
  const financedAmount = calculateFinancedAmount(totalAmount, downPayment);
  const monthlyInstallment = calculateInstallmentAmount(financedAmount, installmentCount);

  // Real-time validation
  const validationError = useMemo<string | null>(() => {
    if (!selectedCustomer && !customerId) {
      return language === 'bn' ? 'অনুগৃহ করে একজন কাস্টমার নির্বাচন করুন' : 'Please select a customer';
    }
    if (!productName || productName.trim() === '') {
      return language === 'bn' ? 'পণ্যের নাম লিখুন' : 'Please enter product name';
    }
    if (totalAmount <= 0) {
      return language === 'bn' ? 'মোট টাকার পরিমাণ ১-এর বেশি হতে হবে' : 'Total amount must be greater than zero';
    }
    if (downPayment < 0) {
      return language === 'bn' ? 'ডাউন পেমেন্ট ঋণাত্মক হতে পারবে না' : 'Down payment cannot be negative';
    }
    if (downPayment > totalAmount) {
      return language === 'bn' ? 'ডাউন পেমেন্ট মোট টাকার থেকে বেশি হতে পারবে না' : 'Down payment cannot exceed total amount';
    }
    if (installmentCount <= 0) {
      return language === 'bn' ? 'কিস্তির সংখ্যা ১ বা তার বেশি দিন' : 'Installment count must be at least 1';
    }
    return null;
  }, [selectedCustomer, customerId, productName, totalAmount, downPayment, installmentCount, language]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setErrorMsg(null);
    onSaveEMI({
      customer_id: customerId,
      product_name: productName.trim(),
      total_amount: totalAmount,
      down_payment: downPayment,
      financed_amount: financedAmount,
      installment_count: installmentCount,
      installment_amount: monthlyInstallment,
      start_date: firstDueDate,
      notes: notes.trim(),
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-w-lg w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 rounded-xl">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              {language === 'bn' ? 'নতুন EMI হিসাব যোগ করুন' : 'New EMI Account Setup'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {language === 'bn' ? 'পণ্য বিক্রয় ও কিস্তি নির্ধারণ' : 'Set up installment breakdown'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Customer Selector */}
        {!selectedCustomer && (
          <div className="space-y-1">
            <label className="font-extrabold text-slate-700 dark:text-slate-300 block">
              👤 {language === 'bn' ? 'কাস্টমার নির্বাচন করুন' : 'Select Customer'}
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-bold outline-none min-h-[44px]"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone_number})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Product / Item Description */}
        <div className="space-y-1">
          <label className="font-extrabold text-slate-700 dark:text-slate-300 block">
            🛍️ {language === 'bn' ? 'পণ্য বা আইটেমের নাম' : 'Product / Item Name'}
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={language === 'bn' ? 'যেমন: স্মার্টফোন / আলমারি / মালামাল' : 'e.g. Smartphone 128GB'}
            className="w-full p-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-bold outline-none min-h-[44px]"
          />
        </div>

        {/* Total Amount & Down Payment Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-extrabold text-slate-700 dark:text-slate-300 block">
              💰 {language === 'bn' ? 'মোট বিক্রয় মূল্য (Total)' : 'Total Amount'}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={totalAmountStr}
              onChange={(e) => setTotalAmountStr(e.target.value)}
              placeholder="30000"
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-extrabold text-sm outline-none min-h-[44px]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-extrabold text-slate-700 dark:text-slate-300 block">
              💵 {language === 'bn' ? 'ডাউন পেমেন্ট (জমা)' : 'Down Payment'}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={downPaymentStr}
              onChange={(e) => setDownPaymentStr(e.target.value)}
              placeholder="6000"
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-extrabold text-sm outline-none min-h-[44px]"
            />
          </div>
        </div>

        {/* Installment Count & First Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-extrabold text-slate-700 dark:text-slate-300 block">
              📅 {language === 'bn' ? 'কিস্তির সংখ্যা (Months)' : 'Number of EMIs'}
            </label>
            <select
              value={installmentCount}
              onChange={(e) => setInstallmentCount(Number(e.target.value))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-bold outline-none min-h-[44px]"
            >
              {[3, 6, 9, 12, 18, 24].map((cnt) => (
                <option key={cnt} value={cnt}>
                  {cnt} {language === 'bn' ? 'টি কিস্তি (মাসিক)' : 'Monthly EMIs'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-extrabold text-slate-700 dark:text-slate-300 block">
              🗓️ {language === 'bn' ? 'প্রথম কিস্তির তারিখ' : 'First Due Date'}
            </label>
            <input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-bold outline-none min-h-[44px]"
            />
          </div>
        </div>

        {/* LIVE CALCULATION BREAKDOWN BOX */}
        <div className="p-4 bg-purple-50 dark:bg-purple-950/60 rounded-2xl border border-purple-200 dark:border-purple-800 space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-black text-purple-900 dark:text-purple-200">
            <Calculator className="w-4 h-4 text-purple-600" />
            <span>{language === 'bn' ? 'স্বয়ংক্রিয় হিসাব বিবরণী' : 'Automatic EMI Calculation'}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-semibold">
                {language === 'bn' ? 'মোট বিক্রয়' : 'Total Amount'}
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {formatShopCurrency(totalAmount, shop.country, shop.currency_code)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-semibold">
                {language === 'bn' ? 'নগদ জমা' : 'Down Payment'}
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatShopCurrency(downPayment, shop.country, shop.currency_code)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-semibold">
                {language === 'bn' ? 'বাকি কিস্তি ঋণ' : 'Financed Amount'}
              </span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400">
                {formatShopCurrency(financedAmount, shop.country, shop.currency_code)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-semibold">
                {language === 'bn' ? 'প্রতি মাসে কিস্তি' : 'Monthly EMI'}
              </span>
              <span className="font-black text-purple-600 dark:text-purple-300 text-sm">
                {formatShopCurrency(monthlyInstallment, shop.country, shop.currency_code)}
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert Callout */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-rose-700 dark:text-rose-300 text-xs font-extrabold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-extrabold rounded-2xl min-h-[44px]"
          >
            {language === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>

          <button
            type="submit"
            disabled={!!validationError}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-2 disabled:opacity-50 min-h-[44px]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === 'bn' ? 'EMI তৈরি করুন' : 'Create EMI Plan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
