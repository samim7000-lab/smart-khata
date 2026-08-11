import React, { useState, useRef } from 'react';
import { Customer, Language, Shop, TransactionType } from '../types';
import { translations } from '../i18n/translations';
import { analyzeHandwrittenLedger, GeminiOcrResult } from '../lib/geminiUtils';
import { resolveCurrencySymbol } from '../lib/countryPricing';
import {
  Camera,
  X,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserPlus,
  ArrowRight,
  MinusCircle,
  PlusCircle,
  Loader2,
  FileImage,
  RefreshCw
} from 'lucide-react';

interface Props {
  shop: Shop;
  customers: Customer[];
  language: Language;
  onClose: () => void;
  onConfirmSave: (
    customerId: string,
    type: TransactionType,
    amount: number,
    note: string,
    ledgerPhotoUrl?: string,
    newCustomerData?: { name: string; phone: string; displayLabel: string }
  ) => void;
}

export const ScanLedgerModal: React.FC<Props> = ({
  shop,
  customers,
  language,
  onClose,
  onConfirmSave,
}) => {
  const t = translations[language];

  // OCR Workflow State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<GeminiOcrResult | null>(null);

  // Editable Form State (LARGE text edit fields)
  const [editedName, setEditedName] = useState('');
  const [editedAmount, setEditedAmount] = useState('');
  const [editedType, setEditedType] = useState<TransactionType>('credit_given');
  const [note, setNote] = useState('');

  // Selected Customer Matching State
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  const [isCreatingNewCust, setIsCreatingNewCust] = useState(false);
  const [newCustPhone, setNewCustPhone] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Handle File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      runOcr(base64);
    };
    reader.readAsDataURL(file);
  };

  // 2. Run Gemini AI OCR via Real Edge Function Only
  const runOcr = async (base64Img: string) => {
    setAnalyzing(true);
    setOcrResult(null);
    try {
      const res = await analyzeHandwrittenLedger(base64Img);
      setOcrResult(res);
      if (res.isValidLedger && !res.error) {
        setEditedName(res.customerName);
        setEditedAmount(res.amount ? res.amount.toString() : '');
        setEditedType(res.type);
        autoMatchCustomer(res.customerName);
      }
    } catch (err: any) {
      console.error('[SCAN] OCR error:', err);
      setOcrResult({
        isValidLedger: false,
        reasonIfInvalid: err.message || 'Failed to analyze image with AI Scanner.',
        customerName: '',
        amount: 0,
        type: 'credit_given',
        confidence: 0,
        error: err.message || 'Analysis Error',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // 3. Customer Matching Engine
  const autoMatchCustomer = (detectedName: string) => {
    if (!detectedName.trim()) {
      setMatchedCustomer(null);
      return;
    }

    const trimmed = detectedName.trim().toLowerCase();
    // Direct match
    const directMatch = customers.find((c) => c.name.toLowerCase() === trimmed);
    if (directMatch) {
      setMatchedCustomer(directMatch);
      setIsCreatingNewCust(false);
      return;
    }

    // Partial/Fuzzy match
    const fuzzyMatches = customers.filter(
      (c) => c.name.toLowerCase().includes(trimmed) || trimmed.includes(c.name.toLowerCase())
    );

    if (fuzzyMatches.length === 1) {
      setMatchedCustomer(fuzzyMatches[0]);
      setIsCreatingNewCust(false);
    } else {
      setMatchedCustomer(null);
      setIsCreatingNewCust(fuzzyMatches.length === 0);
    }
  };

  const handleNameInputChange = (val: string) => {
    setEditedName(val);
    autoMatchCustomer(val);
  };

  // 4. Reset / Try Another Photo
  const handleResetPhoto = () => {
    setImagePreview(null);
    setOcrResult(null);
    setEditedName('');
    setEditedAmount('');
    setMatchedCustomer(null);
    setIsCreatingNewCust(false);
  };

  // 5. Confirm & Save Handler (Explicit Action)
  const handleConfirmSave = () => {
    const numericAmount = parseFloat(editedAmount) || 0;
    if (numericAmount <= 0 || !editedName.trim() || !ocrResult?.isValidLedger || ocrResult?.error) return;

    let finalCustId = (matchedCustomer as Customer | null)?.id || `temp-${Date.now()}`;
    let newCustPayload;

    if (!matchedCustomer || isCreatingNewCust) {
      const displayLabel = editedName.trim();
      newCustPayload = {
        name: editedName.trim(),
        phone: newCustPhone.trim() || `017${Math.floor(10000000 + Math.random() * 90000008)}`,
        displayLabel,
      };
    }

    // Call save callback with ledger photo proof
    onConfirmSave(
      finalCustId,
      editedType,
      numericAmount,
      note || t.scan_ledger_title,
      imagePreview || undefined,
      newCustPayload
    );
  };

  const curr = resolveCurrencySymbol(shop?.country, shop?.currency_code);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 my-auto">
        {/* Modal Header */}
        <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight">{t.scan_ledger_title}</h3>
              <p className="text-xs text-blue-100 font-medium">{t.scan_ledger_subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Step 1: Upload / Dropzone */}
          {!imagePreview && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-3 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 p-8 rounded-3xl text-center cursor-pointer transition-all space-y-3 group"
            >
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base">{t.upload_ledger_photo}</h4>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  JPG, PNG or WebP • Bangla, English, Hindi Notebooks
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Step 2: Processing Spinner */}
          {analyzing && (
            <div className="py-12 text-center space-y-4">
              <div className="relative inline-block">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <Sparkles className="w-6 h-6 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-lg">{t.ai_processing}</h4>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Checking document validity & reading handwriting...
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Error / Invalid Image Warning (STOPS FLOW - HIDES NAME/AMOUNT/SAVE BUTTON) */}
          {imagePreview && !analyzing && ocrResult && (!ocrResult.isValidLedger || ocrResult.error) && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-3xl text-amber-950 space-y-3 shadow-sm">
                <div className="flex items-center space-x-2 text-amber-700 font-black text-base">
                  <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600" />
                  <span>Invalid Image or No Ledger Data Found</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed text-amber-900">
                  {ocrResult.reasonIfInvalid || ocrResult.error || "This image does not contain a valid ledger page or receipt."}
                </p>
                <div className="text-[11px] font-medium text-amber-800 bg-amber-100/80 p-2.5 rounded-xl border border-amber-200">
                  💡 Tip: Please upload a clear photo of a handwritten notebook entry, bill, or paper ledger page.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-2xl transition-colors"
                >
                  {t.back}
                </button>
                <button
                  type="button"
                  onClick={handleResetPhoto}
                  className="py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-2xl shadow-lg flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98]"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Another Photo</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Valid Extracted Data Review & Confirmation (Only rendered when isValidLedger === true AND no error) */}
          {imagePreview && !analyzing && ocrResult && ocrResult.isValidLedger && !ocrResult.error && (
            <div className="space-y-4 animate-in fade-in">
              {/* Photo Proof & Retake Bar */}
              <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-2xl border border-slate-200">
                <div className="flex items-center space-x-3">
                  <img
                    src={imagePreview}
                    alt="Ledger Proof"
                    className="w-12 h-12 object-cover rounded-xl border border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 flex items-center">
                      <FileImage className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      {t.ledger_photo_proof}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Saved alongside receipt as proof
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetPhoto}
                  className="p-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              </div>

              {/* Large Text Detection Card */}
              <div className="bg-slate-900 text-white p-4.5 rounded-3xl space-y-4 shadow-xl">
                {/* Detected Customer Name */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    {t.name_detected}
                  </label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => handleNameInputChange(e.target.value)}
                    placeholder="Customer Name"
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 font-black text-xl outline-none focus:border-blue-500"
                  />
                </div>

                {/* Detected Amount in LARGE Font */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    {t.amount_detected}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-2xl font-black text-slate-400">
                      {curr}
                    </span>
                    <input
                      type="number"
                      value={editedAmount}
                      onChange={(e) => setEditedAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 font-black text-3xl tracking-tight outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Transaction Type Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditedType('credit_given')}
                    className={`py-3 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-1.5 transition-all border-2 ${
                      editedType === 'credit_given'
                        ? 'bg-red-600 border-red-500 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <MinusCircle className="w-4 h-4" />
                    <span>{t.credit_given}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditedType('payment_received')}
                    className={`py-3 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-1.5 transition-all border-2 ${
                      editedType === 'payment_received'
                        ? 'bg-green-600 border-green-500 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{t.payment_received}</span>
                  </button>
                </div>
              </div>

              {/* Customer Auto-Matching Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                {matchedCustomer ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded-xl gap-2 min-w-0">
                    <div className="flex items-center space-x-2 min-w-0 flex-1 pr-1">
                      <UserCheck className="w-5 h-5 text-green-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-extrabold text-slate-900 text-sm block truncate">
                          {matchedCustomer.display_label}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium block truncate">
                          {matchedCustomer.phone_number}
                        </span>
                      </div>
                    </div>
                    <span className="bg-green-600 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded-md shrink-0">
                      Matched
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-slate-700 font-bold">
                      <span>{t.select_customer}:</span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewCust(!isCreatingNewCust)}
                        className="text-blue-600 hover:underline font-extrabold"
                      >
                        + {t.add_customer}
                      </button>
                    </div>

                    <select
                      value={(matchedCustomer as Customer | null)?.id || ''}
                      onChange={(e) => {
                        const found = customers.find((c) => c.id === e.target.value);
                        setMatchedCustomer(found || null);
                      }}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold text-xs outline-none"
                    >
                      <option value="">-- {t.select_customer} --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_label} ({c.phone_number})
                        </option>
                      ))}
                    </select>

                    {isCreatingNewCust && (
                      <div className="pt-2 space-y-2 border-t border-slate-200">
                        <span className="font-extrabold text-blue-700 block">
                          Creating New Customer for "{editedName}"
                        </span>
                        <input
                          type="tel"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          placeholder="Enter Mobile Number (Optional)"
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Note Optional */}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.note_optional}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 outline-none"
              />

              {/* Explicit Action Button */}
              <button
                type="button"
                disabled={!editedAmount || parseFloat(editedAmount) <= 0 || !editedName.trim()}
                onClick={handleConfirmSave}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{t.confirm_and_save}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
