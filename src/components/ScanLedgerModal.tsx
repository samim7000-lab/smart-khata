import React, { useState, useRef } from 'react';
import { Customer, Language, Shop, TransactionType } from '../types';
import { translations } from '../i18n/translations';
import { analyzeHandwrittenLedger, GeminiOcrResult } from '../lib/geminiUtils';
import { resolveCurrencySymbol, formatShopCurrency } from '../lib/countryPricing';
import { validateImageFile, compressImage, uploadLedgerPhotoProof } from '../lib/imageUtils';
import { parseIndicAmount } from '../lib/indicNumerals';
import {
  Camera,
  X,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ArrowRight,
  MinusCircle,
  PlusCircle,
  Loader2,
  FileImage,
  RefreshCw,
  Calculator
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
  const [uploading, setUploading] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<GeminiOcrResult | null>(null);

  // Editable Form State
  const [editedName, setEditedName] = useState('');
  const [editedAmount, setEditedAmount] = useState('');
  const [editedType, setEditedType] = useState<TransactionType>('credit_given');
  const [note, setNote] = useState('');

  // Selected Customer Matching State
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  const [isCreatingNewCust, setIsCreatingNewCust] = useState(false);
  const [newCustPhone, setNewCustPhone] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // 1. Handle File Selection (Dual Camera & Gallery)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file works
    e.target.value = '';
    await processSelectedFile(file);
  };

  const processSelectedFile = async (file: File) => {
    setInputError(null);

    // Client-side validation
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setInputError(validation.error || 'Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    setAnalyzing(true);
    try {
      // Client-side compression to ~250KB JPEG to protect mobile network and prevent base64 bloat
      const compressedDataUrl = await compressImage(file, 1200, 1200, 0.82);
      setImagePreview(compressedDataUrl);
      await runOcr(compressedDataUrl);
    } catch (err: any) {
      console.error('[SCAN] Compression or preview error:', err);
      setInputError('Failed to prepare image for scanning. Please try another photo.');
      setAnalyzing(false);
    }
  };

  // 2. Run Gemini AI OCR via Real Edge Function Only
  const runOcr = async (base64Img: string) => {
    setAnalyzing(true);
    setOcrResult(null);
    try {
      const res = await analyzeHandwrittenLedger(base64Img, 30000, shop.id);
      setOcrResult(res);
      if (res.isValidLedger && !res.error) {
        setEditedName(res.customerName || '');
        setEditedAmount(res.amount ? String(res.amount) : '');
        setEditedType(res.type === 'payment_received' ? 'payment_received' : 'credit_given');
        if (res.customerName) {
          autoMatchCustomer(res.customerName);
        }
      }
    } catch (err: any) {
      console.error('[SCAN] OCR error:', err);
      setOcrResult({
        status: 'unreadable',
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
    // Direct match by name or display_label
    const directMatch = customers.find(
      (c) =>
        c.name.toLowerCase() === trimmed ||
        (c.display_label && c.display_label.toLowerCase() === trimmed)
    );
    if (directMatch) {
      setMatchedCustomer(directMatch);
      setIsCreatingNewCust(false);
      return;
    }

    // Partial / Fuzzy match
    const fuzzyMatches = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(trimmed) ||
        trimmed.includes(c.name.toLowerCase()) ||
        (c.display_label && c.display_label.toLowerCase().includes(trimmed))
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
    setInputError(null);
    setEditedName('');
    setEditedAmount('');
    setMatchedCustomer(null);
    setIsCreatingNewCust(false);
    setNewCustPhone('');
  };

  // 5. Confirm & Save Handler (Explicit Merchant Action)
  const handleConfirmSave = async () => {
    const parsed = parseIndicAmount(editedAmount);
    const numericAmount = parsed.isValid ? parsed.amount : 0;
    if (numericAmount <= 0 || !editedName.trim() || !ocrResult?.isValidLedger || ocrResult?.error || uploading) return;

    setUploading(true);
    try {
      // Upload compressed image proof to Supabase Storage CDN (never multi-MB Base64 in Postgres DB)
      let proofUrl = '';
      if (imagePreview) {
        proofUrl = await uploadLedgerPhotoProof(imagePreview, shop.id);
      }

      const finalCustId = matchedCustomer?.id || `temp-${Date.now()}`;
      let newCustPayload: { name: string; phone: string; displayLabel: string } | undefined;

      if (!matchedCustomer || isCreatingNewCust) {
        newCustPayload = {
          name: editedName.trim(),
          phone: newCustPhone.trim(), // Strict: No hallucinated/random phone numbers!
          displayLabel: editedName.trim(),
        };
      }

      onConfirmSave(
        finalCustId,
        editedType,
        numericAmount,
        note.trim() || t.scan_ledger_title,
        proofUrl || undefined,
        newCustPayload
      );
    } catch (err: any) {
      console.error('[SCAN] Confirm save error:', err);
      // Fallback directly so user never loses their transaction
      const finalCustId = matchedCustomer?.id || `temp-${Date.now()}`;
      onConfirmSave(
        finalCustId,
        editedType,
        numericAmount,
        note.trim() || t.scan_ledger_title,
        undefined,
        !matchedCustomer || isCreatingNewCust
          ? { name: editedName.trim(), phone: newCustPhone.trim(), displayLabel: editedName.trim() }
          : undefined
      );
    } finally {
      setUploading(false);
    }
  };

  const curr = resolveCurrencySymbol(shop?.country, shop?.currency_code);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 my-auto border border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
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
          {/* Step 1: Upload / Dropzone with DUAL Input Options */}
          {!imagePreview && (
            <div className="space-y-4">
              <div className="bg-blue-50/60 dark:bg-slate-800/50 p-6 rounded-3xl border-2 border-dashed border-blue-200 dark:border-slate-700 text-center space-y-3">
                <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">{t.upload_ledger_photo}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                    Bangla, English & Hindi handwritten notebook pages, bills, or chits
                  </p>
                </div>

                {inputError && (
                  <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold p-3 rounded-xl flex items-center space-x-2 text-left">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{inputError}</span>
                  </div>
                )}

                {/* Dual Action Buttons (Camera Intent vs Gallery) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-3 px-4 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
                  >
                    <Upload className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    <span>Choose from Gallery</span>
                  </button>
                </div>

                {/* Hidden native file inputs */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Helpful Shopkeeper Guidance */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                  💡 Tips for best scan accuracy:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 font-medium">
                  <li>Hold camera steady under good room lighting.</li>
                  <li>Ensure customer name and amount are clearly visible in the frame.</li>
                  <li>Works with Bengali (১৫০০), Hindi (१५००), and English (1500) digits.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Processing Spinner */}
          {analyzing && (
            <div className="py-12 text-center space-y-4">
              <div className="relative inline-block">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <Sparkles className="w-6 h-6 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">{t.ai_processing}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  Checking document validity & reading handwriting with Gemini AI...
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Error / Invalid Image Warning */}
          {imagePreview && !analyzing && ocrResult && (!ocrResult.isValidLedger || ocrResult.error) && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 p-5 rounded-3xl text-amber-950 dark:text-amber-100 space-y-3 shadow-sm">
                <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300 font-black text-base">
                  <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600" />
                  <span>Invalid Image or No Ledger Data Found</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed text-amber-900 dark:text-amber-200">
                  {ocrResult.reasonIfInvalid || ocrResult.error || "This image does not contain a valid ledger page or receipt."}
                </p>
                <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/60 p-2.5 rounded-xl border border-amber-200 dark:border-amber-700">
                  💡 Tip: Please take a clearer, well-lit photo of a handwritten notebook entry, bill, or paper ledger page.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-sm rounded-2xl transition-colors"
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

          {/* Step 4: Valid Extracted Data Review & Confirmation */}
          {imagePreview && !analyzing && ocrResult && ocrResult.isValidLedger && !ocrResult.error && (
            <div className="space-y-4 animate-in fade-in">
              {/* Photo Proof & Retake Bar */}
              <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  <img
                    src={imagePreview}
                    alt="Ledger Proof"
                    className="w-12 h-12 object-cover rounded-xl border border-slate-300 dark:border-slate-600"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center">
                      <FileImage className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                      {t.ledger_photo_proof}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                      Uploaded safely to cloud CDN as proof
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetPhoto}
                  className="p-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              </div>

              {/* Large Text Detection Card */}
              <div className="bg-slate-900 text-white p-4.5 rounded-3xl space-y-4 shadow-xl border border-slate-800">
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

                {/* Detected Amount in LARGE Font with Indic digit support */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    {t.amount_detected}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-2xl font-black text-slate-400">
                      {curr}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
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
              <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                {matchedCustomer ? (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 p-3 rounded-xl gap-2 min-w-0">
                    <div className="flex items-center space-x-2 min-w-0 flex-1 pr-1">
                      <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm block truncate">
                          {matchedCustomer.display_label || matchedCustomer.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">
                          {matchedCustomer.phone_number || 'No phone recorded'}
                        </span>
                      </div>
                    </div>
                    <span className="bg-green-600 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded-md shrink-0">
                      Matched
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold">
                      <span>{t.select_customer}:</span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewCust(!isCreatingNewCust)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-extrabold"
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs outline-none"
                    >
                      <option value="">-- {t.select_customer} --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_label || c.name} {c.phone_number ? `(${c.phone_number})` : ''}
                        </option>
                      ))}
                    </select>

                    {isCreatingNewCust && (
                      <div className="pt-2 space-y-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="font-extrabold text-blue-700 dark:text-blue-400 block">
                          Creating New Customer for "{editedName}"
                        </span>
                        <input
                          type="tel"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          placeholder="Enter Mobile Number (Optional)"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 6: Real-Time Balance Preview */}
              {(() => {
                const parsed = parseIndicAmount(editedAmount);
                const numericAmount = parsed.isValid ? parsed.amount : 0;
                const currentBal = matchedCustomer ? (matchedCustomer.balance || 0) : 0;
                const isCredit = editedType === 'credit_given';
                const projectedBal = isCredit ? currentBal + numericAmount : currentBal - numericAmount;

                return (
                  <div className="bg-slate-100 dark:bg-slate-800/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Balance Preview</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold lowercase">
                        {isCredit ? '+ credit' : '- payment'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[11px]">
                          {matchedCustomer ? 'Current Due' : 'Starting Due'}
                        </span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                          {formatShopCurrency(currentBal, shop?.country, shop?.currency_code)}
                        </span>
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mx-2" />

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[11px]">
                          Tx Amount
                        </span>
                        <span className={`font-black text-sm ${isCredit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {isCredit ? '+' : '-'}{formatShopCurrency(numericAmount, shop?.country, shop?.currency_code)}
                        </span>
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mx-2" />

                      <div className="text-right">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[11px]">
                          Projected Due
                        </span>
                        <span
                          className={`font-black text-base ${
                            projectedBal > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                          {formatShopCurrency(Math.abs(projectedBal), shop?.country, shop?.currency_code)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Note Optional */}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.note_optional}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 outline-none"
              />

              {/* Step 7: Explicit Confirm & Save Action Button */}
              <button
                type="button"
                disabled={!editedAmount || !parseIndicAmount(editedAmount).isValid || parseIndicAmount(editedAmount).amount <= 0 || !editedName.trim() || uploading}
                onClick={handleConfirmSave}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Saving Ledger Proof...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{t.confirm_and_save}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
