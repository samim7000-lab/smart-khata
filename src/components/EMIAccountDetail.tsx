import React, { useState } from 'react';
import { Customer, Language, Shop } from '../types';
import { EMIAccountDB, EMIInstallmentDB, EMIService } from '../lib/emiService';
import { formatShopCurrency } from '../lib/countryPricing';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  DollarSign,
  Loader2,
  X,
  ShoppingBag
} from 'lucide-react';

interface Props {
  shop: Shop;
  account: EMIAccountDB;
  customer?: Customer;
  language: Language;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export const EMIAccountDetail: React.FC<Props> = ({
  shop,
  account,
  customer = account.customer,
  language,
  onClose,
  onPaymentSuccess,
}) => {
  const [selectedInst, setSelectedInst] = useState<EMIInstallmentDB | null>(null);
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [customPaidAmount, setCustomPaidAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waNotice, setWaNotice] = useState<string | null>(null);

  const installments = account.installments || [];

  // Summary Metrics
  const totalAmount = Number(account.total_amount) || 0;
  const downPayment = Number(account.down_payment) || 0;
  const financedAmount = Number(account.financed_amount) || 0;

  const totalPaid = installments.reduce((acc, i) => acc + (Number(i.paid_amount) || 0), 0);
  const remainingAmount = Math.max(financedAmount - totalPaid, 0);

  const paidCount = installments.filter((i) => i.status === 'paid' || (Number(i.paid_amount) || 0) >= (Number(i.amount) || 0)).length;
  const remainingCount = Math.max(installments.length - paidCount, 0);

  const nextDueInst = installments.find((i) => i.status !== 'paid' && (Number(i.paid_amount) || 0) < (Number(i.amount) || 0));

  const handleOpenPaymentModal = (inst: EMIInstallmentDB) => {
    setSelectedInst(inst);
    setPaymentType('full');
    const dueLeft = Math.max((Number(inst.amount) || 0) - (Number(inst.paid_amount) || 0), 0);
    setCustomPaidAmount(String(dueLeft));
    setErrorMsg(null);
  };

  const handleConfirmPayment = async () => {
    if (!selectedInst) return;

    const dueLeft = Math.max((Number(selectedInst.amount) || 0) - (Number(selectedInst.paid_amount) || 0), 0);
    const payAmt = paymentType === 'full' ? dueLeft : Number(customPaidAmount) || 0;

    if (payAmt <= 0) {
      setErrorMsg(language === 'bn' ? 'টাকার পরিমাণ ১-এর বেশি হতে হবে' : 'Payment amount must be greater than zero');
      return;
    }
    if (payAmt > dueLeft) {
      setErrorMsg(
        language === 'bn'
          ? `জমার পরিমাণ বকেয়া ${formatShopCurrency(dueLeft, shop.country, shop.currency_code)}-এর বেশি হতে পারবে না`
          : `Payment cannot exceed remaining installment due`
      );
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    const res = await EMIService.markInstallmentPayment(selectedInst, payAmt);
    setIsSubmitting(false);

    if (res.success) {
      setSelectedInst(null);
      onPaymentSuccess();
    } else {
      setErrorMsg(res.error || 'Payment failed');
    }
  };

  const handleSendWAReminder = (inst: EMIInstallmentDB) => {
    setWaNotice(
      language === 'bn'
        ? `WhatsApp নোটিফিকেশন সুবিধা ভবিষ্যতে যুক্ত হবে। (${customer?.name || 'Customer'}-এর কিস্তি #${inst.installment_number})`
        : `WhatsApp automation will be connected in a future phase. (Installment #${inst.installment_number} for ${customer?.name || 'Customer'})`
    );
    setTimeout(() => setWaNotice(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl my-auto animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 rounded-2xl flex items-center justify-center font-black">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {account.product_name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                👤 {customer?.name || 'Customer'} ({customer?.phone_number || 'No Phone'})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Numbers Overview Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {language === 'bn' ? 'মোট বিক্রয়' : 'Total'}
            </span>
            <span className="text-base font-black text-slate-900 dark:text-white">
              {formatShopCurrency(totalAmount, shop.country, shop.currency_code)}
            </span>
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">
              {language === 'bn' ? 'মোট জমা' : 'Total Paid'}
            </span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {formatShopCurrency(downPayment + totalPaid, shop.country, shop.currency_code)}
            </span>
          </div>

          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800">
            <span className="text-[10px] uppercase font-bold text-rose-600 block">
              {language === 'bn' ? 'অবশিষ্ট বাকি' : 'Remaining'}
            </span>
            <span className="text-base font-black text-rose-600 dark:text-rose-400">
              {formatShopCurrency(remainingAmount, shop.country, shop.currency_code)}
            </span>
          </div>

          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800">
            <span className="text-[10px] uppercase font-bold text-purple-600 block">
              {language === 'bn' ? 'পরের কিস্তি' : 'Next Due'}
            </span>
            <span className="text-base font-black text-purple-600 dark:text-purple-300">
              {nextDueInst ? formatShopCurrency((Number(nextDueInst.amount) || 0) - (Number(nextDueInst.paid_amount) || 0), shop.country, shop.currency_code) : 'Completed'}
            </span>
          </div>
        </div>

        {/* Progress Breakdown bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold">
          <div>
            <span className="text-slate-500">{language === 'bn' ? 'কতগুলো দেওয়া হয়েছে: ' : 'Paid EMIs: '}</span>
            <span className="text-emerald-600 font-black">{paidCount}</span> / {installments.length}
          </div>
          <div>
            <span className="text-slate-500">{language === 'bn' ? 'কতগুলো বাকি: ' : 'Remaining: '}</span>
            <span className="text-amber-600 font-black">{remainingCount}</span>
          </div>
        </div>

        {waNotice && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-200 text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{waNotice}</span>
          </div>
        )}

        {/* INSTALLMENT SCHEDULE LIST */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
            {language === 'bn' ? 'কিস্তির সময়সূচী' : 'Installment Schedule'} ({installments.length})
          </h4>

          {installments.map((inst) => {
            const isPaid = inst.status === 'paid' || (Number(inst.paid_amount) || 0) >= (Number(inst.amount) || 0);
            const isPartial = inst.status === 'partially_paid' && !isPaid;
            const isOverdue = inst.status === 'overdue' && !isPaid;
            const dueLeft = Math.max((Number(inst.amount) || 0) - (Number(inst.paid_amount) || 0), 0);

            return (
              <div
                key={inst.id}
                className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  isPaid
                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : isOverdue
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/30'
                    : isPartial
                    ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {language === 'bn' ? `কিস্তি #${inst.installment_number}` : `EMI #${inst.installment_number}`}
                    </span>
                    <span
                      className={`font-black text-[9px] uppercase px-2 py-0.5 rounded-full ${
                        isPaid
                          ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : isOverdue
                          ? 'bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : isPartial
                          ? 'bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {inst.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    📅 {language === 'bn' ? 'তারিখ: ' : 'Due Date: '} {inst.due_date}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end space-x-3">
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {formatShopCurrency(inst.amount, shop.country, shop.currency_code)}
                    </div>
                    {inst.paid_amount > 0 && (
                      <div className="text-[10px] font-bold text-emerald-600">
                        Paid: {formatShopCurrency(inst.paid_amount, shop.country, shop.currency_code)}
                      </div>
                    )}
                  </div>

                  {!isPaid ? (
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleSendWAReminder(inst)}
                        className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Send WhatsApp Reminder"
                      >
                        <Send className="w-4 h-4 text-emerald-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(inst)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors min-h-[44px] flex items-center space-x-1"
                      >
                        <span>{language === 'bn' ? 'কিস্তি জমা' : 'Collect Pay'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center text-emerald-600 dark:text-emerald-400 text-xs font-extrabold space-x-1 px-3 py-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === 'bn' ? 'পরিশোধিত' : 'Paid'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* PAYMENT COLLECTION MODAL OVERLAY */}
        {selectedInst && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="font-black text-slate-900 dark:text-white text-base flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>{language === 'bn' ? 'কিস্তি জমা নিশ্চিত করুন' : 'Confirm Installment Payment'}</span>
                </h4>
                <button onClick={() => setSelectedInst(null)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs space-y-1 font-bold">
                <div>👤 {customer?.name} ({customer?.phone_number})</div>
                <div>🛍️ {account.product_name}</div>
                <div>📌 {language === 'bn' ? `কিস্তি #${selectedInst.installment_number}` : `Installment #${selectedInst.installment_number}`}</div>
                <div className="text-purple-600 text-sm">
                  {language === 'bn' ? 'বকেয়া পাওনা: ' : 'Due Amount: '}
                  {formatShopCurrency(
                    Math.max((Number(selectedInst.amount) || 0) - (Number(selectedInst.paid_amount) || 0), 0),
                    shop.country,
                    shop.currency_code
                  )}
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div className="space-y-2 text-xs">
                <label className="font-extrabold text-slate-700 dark:text-slate-300 block">
                  {language === 'bn' ? 'পেমেন্ট ধরন' : 'Payment Mode'}
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('full')}
                    className={`p-3 rounded-xl border-2 text-xs font-black transition-all min-h-[44px] ${
                      paymentType === 'full'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    {language === 'bn' ? 'পুরো কিস্তি জমা' : 'Full Payment'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentType('partial')}
                    className={`p-3 rounded-xl border-2 text-xs font-black transition-all min-h-[44px] ${
                      paymentType === 'partial'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    {language === 'bn' ? 'আংশিক জমা' : 'Partial Payment'}
                  </button>
                </div>

                {paymentType === 'partial' && (
                  <div className="space-y-1 pt-1">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300 block">
                      {language === 'bn' ? 'জমার পরিমাণ (₹)' : 'Partial Paid Amount'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={customPaidAmount}
                      onChange={(e) => setCustomPaidAmount(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-extrabold text-sm outline-none min-h-[44px]"
                    />
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-rose-700 dark:text-rose-300 text-xs font-extrabold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInst(null)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl min-h-[44px]"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-1 min-h-[44px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === 'bn' ? 'জমা নিশ্চিত করুন' : 'Confirm Payment'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
