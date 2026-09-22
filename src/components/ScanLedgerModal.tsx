import React, { useState, useRef, useEffect } from 'react';
import { Customer, Language, Shop, TransactionType } from '../types';
import { translations } from '../i18n/translations';
import { analyzeHandwrittenLedger, GeminiOcrResult, GeminiOcrItem, GeminiOcrDraft } from '../lib/geminiUtils';
import { resolveCurrencySymbol, formatShopCurrency } from '../lib/countryPricing';
import { validateImageFile, compressImage, uploadLedgerPhotoProof } from '../lib/imageUtils';
import { parseIndicAmount } from '../lib/indicNumerals';
import {
  resolveCustomerIdentity,
  IdentityStatus,
} from '../lib/customerIdentityResolver';
import {
  captureNativePhoto,
  recoverPendingNativePhoto,
  clearPendingNativePhoto,
} from '../native/nativeCamera';
import {
  ScanWorkspaceService,
  ScanDraft,
  BadgeState,
  getCanonicalWorkspaceIdentity,
} from '../lib/scanWorkspaceService';
import {
  Camera,
  X,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  MinusCircle,
  PlusCircle,
  Loader2,
  FileImage,
  RefreshCw,
  Calculator,
  Phone,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
  List,
} from 'lucide-react';

interface Props {
  shop: Shop;
  customers: Customer[];
  language: Language;
  activeUserId?: string | null;
  onClose: () => void;
  onConfirmSave: (
    customerId: string,
    type: TransactionType,
    amount: number,
    note: string,
    ledgerPhotoUrl?: string,
    newCustomerData?: { name: string; phone: string; displayLabel: string; address?: string },
    draftId?: string
  ) => void;
}

export const ScanLedgerModal: React.FC<Props> = ({
  shop,
  customers,
  language,
  activeUserId,
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

  // Multi-entry / Bulk-Scan Batch State
  const [drafts, setDrafts] = useState<ScanDraft[]>([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('detail');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // 1. Rehydrate active Scan Workspace from storage on mount (survives WhatsApp & App restart)
  useEffect(() => {
    const identity = getCanonicalWorkspaceIdentity(shop, activeUserId);
    if (!identity.isValid) return;
    const existingWs = ScanWorkspaceService.loadWorkspace(identity.shopId, identity.userId);
    if (existingWs && existingWs.drafts && existingWs.drafts.length > 0) {
      setDrafts(existingWs.drafts);
      setActiveDraftIndex(existingWs.activeDraftIndex || 0);
      if (existingWs.stage === 'draft_review' && existingWs.currentDraftId) {
        const foundIdx = existingWs.drafts.findIndex((d) => d.id === existingWs.currentDraftId);
        if (foundIdx >= 0) {
          setActiveDraftIndex(foundIdx);
          setViewMode('detail');
          return;
        }
      }
      if (existingWs.drafts.length > 1) {
        setViewMode('list');
      } else {
        setViewMode('detail');
      }
    }
  }, [shop, activeUserId]);

  // 1b. Recover completed native camera photo if Activity/Component was recreated during capture
  useEffect(() => {
    let isCancelled = false;
    const checkPendingCamera = async () => {
      const pendingMarker = ScanWorkspaceService.getPendingCameraCapture();
      const nativeRes = await recoverPendingNativePhoto();
      if (isCancelled) return;

      if (nativeRes.hasPending && nativeRes.blob) {
        console.log('[SCAN] Successfully recovered pending camera photo from native storage!');
        ScanWorkspaceService.clearPendingCameraCapture();
        await clearPendingNativePhoto();
        await processSelectedFile(nativeRes.blob);
      } else if (pendingMarker && Date.now() - pendingMarker.createdAt > 2 * 60 * 1000) {
        ScanWorkspaceService.clearPendingCameraCapture();
      }
    };

    checkPendingCamera();
    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Automatically sync active workspace to local storage (24-hour TTL, zero base64)
  useEffect(() => {
    const identity = getCanonicalWorkspaceIdentity(shop, activeUserId);
    if (!identity.isValid) return;
    if (drafts.length > 0) {
      ScanWorkspaceService.saveWorkspace({
        workspaceId: `ws-${identity.shopId}`,
        shopId: identity.shopId,
        userId: identity.userId,
        currentDraftId: drafts[activeDraftIndex]?.id,
        stage: viewMode === 'list' ? 'batch_list' : 'draft_review',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        drafts,
        activeDraftIndex,
        status: drafts.every((d) => d.saveStatus === 'saved') ? 'completed' : 'in_progress',
      });
    }
  }, [drafts, activeDraftIndex, viewMode, shop, activeUserId]);

  // Helper: Initialize a draft card from OCR data using Canonical Identity Resolver
  const createDraftFromData = (
    id: string,
    name: string,
    phone: string,
    amountNum: number,
    txType: TransactionType | 'unknown',
    items: GeminiOcrItem[] = [],
    memo: string = '',
    confidence: number = 0.9,
    existingData?: Partial<ScanDraft>
  ): ScanDraft => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    // Canonical Identity Resolution
    const resolution = resolveCustomerIdentity({
      extractedName: cleanName,
      extractedPhone: cleanPhone,
      shopId: shop.id,
      customers,
    });

    const nameBadge: BadgeState = cleanName
      ? confidence >= 0.8 ? 'detected' : 'check'
      : 'manual';

    const phoneBadge: BadgeState = cleanPhone
      ? confidence >= 0.8 ? 'detected' : 'check'
      : resolution.matchedCustomer?.phone_number ? 'detected' : 'manual';

    const amountBadge: BadgeState = amountNum > 0
      ? confidence >= 0.8 ? 'detected' : 'check'
      : 'manual';

    const resolvedPhone = cleanPhone || (resolution.matchedCustomer?.phone_number || '');
    const firstItem = items && items.length > 0 ? items[0] : null;

    return {
      id,
      customerName: cleanName || (resolution.matchedCustomer?.name || ''),
      phone: resolvedPhone,
      amount: amountNum > 0 ? String(amountNum) : '',
      type: txType === 'payment_received' ? 'payment_received' : 'credit_given',
      productName: existingData?.productName !== undefined ? existingData.productName : (firstItem?.name || ''),
      optionalQuantity: existingData?.optionalQuantity !== undefined ? existingData.optionalQuantity : (firstItem?.quantity || ''),
      optionalUnitPrice: existingData?.optionalUnitPrice !== undefined ? existingData.optionalUnitPrice : (firstItem?.unit_price || ''),
      customerAddress: existingData?.customerAddress || '',
      optionalItems: items,
      optionalNote: existingData?.optionalNote !== undefined ? existingData.optionalNote : memo,
      confidence,
      matchedCustomer: resolution.matchedCustomer,
      isCreatingNewCust: resolution.status === 'NO_MATCH',
      identityStatus: resolution.status,
      resolutionReasons: resolution.reasons,
      candidates: resolution.candidates,
      nameBadge,
      phoneBadge,
      amountBadge,
      confirmed: existingData?.confirmed || false,
      saveStatus: existingData?.saveStatus || 'pending',
      whatsappStatus: existingData?.whatsappStatus || 'ready',
      transactionId: existingData?.transactionId,
    };
  };

  // 1. Direct Camera Action (Native Camera with explicit URI permissions -> Web Fallback)
  const handleTakePhoto = async () => {
    setInputError(null);
    const identity = getCanonicalWorkspaceIdentity(shop, activeUserId);
    const captureRequestId = `cam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (identity.isValid) {
      ScanWorkspaceService.savePendingCameraCapture({
        captureRequestId,
        userId: identity.userId,
        shopId: identity.shopId,
      });
    }

    try {
      const nativeRes = await captureNativePhoto(captureRequestId);
      if (nativeRes.cancelled) {
        ScanWorkspaceService.clearPendingCameraCapture();
        await clearPendingNativePhoto();
        return;
      }
      if (nativeRes.blob) {
        ScanWorkspaceService.clearPendingCameraCapture();
        await clearPendingNativePhoto();
        await processSelectedFile(nativeRes.blob);
        return;
      }
      if (nativeRes.useWebFallback) {
        ScanWorkspaceService.clearPendingCameraCapture();
        cameraInputRef.current?.click();
        return;
      }
      if (nativeRes.error) {
        ScanWorkspaceService.clearPendingCameraCapture();
        setInputError(nativeRes.error);
      }
    } catch (err: any) {
      ScanWorkspaceService.clearPendingCameraCapture();
      console.warn('[SCAN] Native camera error, falling back to web file input:', err);
      cameraInputRef.current?.click();
    }
  };

  // 2. Handle File Selection (Dual Camera & Gallery)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    await processSelectedFile(file);
  };

  const processSelectedFile = async (fileOrBlob: File | Blob) => {
    setInputError(null);

    const validation = validateImageFile(fileOrBlob);
    if (!validation.valid) {
      setInputError(validation.error || 'Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    setAnalyzing(true);
    try {
      const compressedDataUrl = await compressImage(fileOrBlob, 1200, 1200, 0.82);
      setImagePreview(compressedDataUrl);
      await runOcr(compressedDataUrl);
    } catch (err: any) {
      console.error('[SCAN] Compression or preview error:', err);
      setInputError('Failed to prepare image for scanning. Please try another photo.');
      setAnalyzing(false);
    }
  };

  // 3. Run Gemini AI OCR via Real Edge Function Only
  const runOcr = async (base64Img: string) => {
    setAnalyzing(true);
    setOcrResult(null);
    setDrafts([]);
    setActiveDraftIndex(0);

    try {
      const res = await analyzeHandwrittenLedger(base64Img, 30000, shop.id);
      setOcrResult(res);

      if (res.isValidLedger && !res.error) {
        if (res.drafts && res.drafts.length > 1) {
          const generatedDrafts: ScanDraft[] = res.drafts.map((d: GeminiOcrDraft, idx: number) =>
            createDraftFromData(
              d.id || `draft-${idx + 1}`,
              d.customerName,
              d.phone,
              d.amount,
              d.type,
              d.optionalItems || [],
              d.optionalNote || '',
              d.confidence
            )
          );
          setDrafts(generatedDrafts);
          setViewMode('list');
        } else {
          const singleDraft = createDraftFromData(
            'draft-1',
            res.customerName,
            res.phone || '',
            res.amount,
            res.type,
            res.optionalItems || [],
            res.optionalNote || '',
            res.confidence
          );
          setDrafts([singleDraft]);
          setViewMode('detail');
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

  // Current Active Draft Accessor & Mutator
  const activeDraft = drafts[activeDraftIndex] || null;

  const updateActiveDraft = (updater: Partial<ScanDraft>) => {
    setDrafts((prev) =>
      prev.map((d, idx) => (idx === activeDraftIndex ? { ...d, ...updater } : d))
    );
  };

  // Handlers for Active Draft Field Changes
  const handleNameChange = (val: string) => {
    if (!activeDraft) return;
    const res = resolveCustomerIdentity({
      extractedName: val,
      extractedPhone: activeDraft.phone,
      shopId: shop.id,
      customers,
    });
    updateActiveDraft({
      customerName: val,
      matchedCustomer: res.matchedCustomer,
      identityStatus: res.status,
      resolutionReasons: res.reasons,
      candidates: res.candidates,
      isCreatingNewCust: res.status === 'NO_MATCH',
      nameBadge: 'manual',
    });
  };

  const handlePhoneChange = (val: string) => {
    if (!activeDraft) return;
    const res = resolveCustomerIdentity({
      extractedName: activeDraft.customerName,
      extractedPhone: val,
      shopId: shop.id,
      customers,
    });
    updateActiveDraft({
      phone: val,
      matchedCustomer: res.matchedCustomer,
      identityStatus: res.status,
      resolutionReasons: res.reasons,
      candidates: res.candidates,
      isCreatingNewCust: res.status === 'NO_MATCH',
      phoneBadge: 'manual',
    });
  };

  const handleAmountChange = (val: string) => {
    updateActiveDraft({
      amount: val,
      amountBadge: 'manual',
    });
  };

  const handleTypeChange = (type: TransactionType) => {
    updateActiveDraft({ type });
  };

  const handleSelectCustomer = (customer: Customer | null) => {
    if (!activeDraft) return;
    if (customer) {
      updateActiveDraft({
        matchedCustomer: customer,
        customerName: customer.display_label || customer.name,
        phone: customer.phone_number || activeDraft.phone,
        identityStatus: 'EXACT_PHONE_AND_NAME',
        resolutionReasons: ['Merchant explicitly confirmed this customer'],
        candidates: [],
        isCreatingNewCust: false,
      });
    } else {
      updateActiveDraft({
        matchedCustomer: null,
        identityStatus: 'NO_MATCH',
        candidates: [],
        isCreatingNewCust: true,
      });
    }
  };

  // Reset / Try Another Photo
  const handleResetPhoto = () => {
    setImagePreview(null);
    setOcrResult(null);
    setInputError(null);
    setDrafts([]);
    setActiveDraftIndex(0);
    setShowOptionalDetails(false);
    const identity = getCanonicalWorkspaceIdentity(shop, activeUserId);
    if (identity.isValid) {
      ScanWorkspaceService.clearWorkspace(identity.shopId, identity.userId);
    } else {
      ScanWorkspaceService.clearWorkspace();
    }
  };

  // Mandatory Validation Gate
  // 1. Name is non-empty
  // 2. Phone digits length >= 10
  // 3. Amount > 0
  // 4. Direction is selected
  // 5. Must NOT be an unresolved PHONE_CONFLICT or AMBIGUOUS state
  const activeAmountParsed = activeDraft ? parseIndicAmount(activeDraft.amount) : { amount: 0, isValid: false };
  const hasValidName = Boolean(activeDraft && activeDraft.customerName.trim().length > 0);
  const activePhoneDigits = activeDraft ? activeDraft.phone.replace(/\D/g, '') : '';
  const hasValidPhone = activePhoneDigits.length >= 10;
  const hasValidAmount = Boolean(activeAmountParsed.isValid && activeAmountParsed.amount > 0);
  const isUnresolvedConflictOrAmbiguity = Boolean(
    activeDraft &&
    (activeDraft.identityStatus === 'PHONE_CONFLICT' || activeDraft.identityStatus === 'AMBIGUOUS') &&
    !activeDraft.matchedCustomer &&
    !activeDraft.isCreatingNewCust
  );

  const isDraftSavable = Boolean(
    activeDraft &&
    hasValidName &&
    hasValidPhone &&
    hasValidAmount &&
    !isUnresolvedConflictOrAmbiguity &&
    !activeDraft.confirmed &&
    !uploading
  );

  // Confirm & Save Active Draft
  const handleConfirmActiveDraft = async () => {
    if (!activeDraft || !isDraftSavable) return;

    setUploading(true);
    try {
      let proofUrl = '';
      if (imagePreview) {
        proofUrl = await uploadLedgerPhotoProof(imagePreview, shop.id);
      }

      const finalCustId = activeDraft.matchedCustomer?.id || `temp-${Date.now()}`;
      let newCustPayload: { name: string; phone: string; displayLabel: string; address?: string } | undefined;

      if (!activeDraft.matchedCustomer || activeDraft.isCreatingNewCust) {
        newCustPayload = {
          name: activeDraft.customerName.trim(),
          phone: activeDraft.phone.trim(),
          displayLabel: activeDraft.customerName.trim(),
          address: activeDraft.customerAddress?.trim() || undefined,
        };
      } else if (!activeDraft.matchedCustomer.address && activeDraft.customerAddress?.trim()) {
        newCustPayload = {
          name: activeDraft.matchedCustomer.name,
          phone: activeDraft.matchedCustomer.phone_number || activeDraft.phone.trim(),
          displayLabel: activeDraft.matchedCustomer.display_label || activeDraft.matchedCustomer.name,
          address: activeDraft.customerAddress.trim(),
        };
      }

      // Format note with optional items / details if present
      const itemDesc = [
        activeDraft.productName?.trim(),
        activeDraft.optionalQuantity ? `(Qty: ${activeDraft.optionalQuantity}${activeDraft.optionalUnitPrice ? ` @ ${activeDraft.optionalUnitPrice}` : ''})` : '',
      ].filter(Boolean).join(' ');

      const noteText = [
        itemDesc,
        activeDraft.optionalNote?.trim(),
      ].filter(Boolean).join(' - ') || t.scan_ledger_title;

      const identity = getCanonicalWorkspaceIdentity(shop, activeUserId);

      onConfirmSave(
        finalCustId,
        activeDraft.type,
        activeAmountParsed.amount,
        noteText,
        proofUrl || undefined,
        newCustPayload,
        activeDraft.id
      );

      // Mark this draft as confirmed & saved
      const updatedDrafts = drafts.map((d, i) =>
        i === activeDraftIndex
          ? { ...d, confirmed: true, saveStatus: 'saved' as const }
          : d
      );
      setDrafts(updatedDrafts);
      if (identity.isValid) {
        ScanWorkspaceService.markDraftSaved(activeDraft.id, undefined, identity.shopId, identity.userId);
      }

      // Check if there are unconfirmed drafts remaining
      const remainingUnsaved = updatedDrafts.filter((d) => d.saveStatus !== 'saved');
      if (remainingUnsaved.length > 0 && drafts.length > 1) {
        // Return to batch list view so the merchant sees progress and selects next entry
        setViewMode('list');
      } else {
        if (identity.isValid) {
          ScanWorkspaceService.clearWorkspace(identity.shopId, identity.userId);
        }
        onClose();
      }
    } catch (err: any) {
      console.error('[SCAN] Confirm save error:', err);
      const identity = getCanonicalWorkspaceIdentity(shop, activeUserId);
      const finalCustId = activeDraft.matchedCustomer?.id || `temp-${Date.now()}`;
      onConfirmSave(
        finalCustId,
        activeDraft.type,
        activeAmountParsed.amount,
        activeDraft.optionalNote?.trim() || t.scan_ledger_title,
        undefined,
        !activeDraft.matchedCustomer || activeDraft.isCreatingNewCust
          ? {
              name: activeDraft.customerName.trim(),
              phone: activeDraft.phone.trim(),
              displayLabel: activeDraft.customerName.trim(),
              address: activeDraft.customerAddress?.trim() || undefined,
            }
          : undefined,
        activeDraft.id
      );
      updateActiveDraft({ confirmed: true, saveStatus: 'saved' });
      if (identity.isValid) {
        ScanWorkspaceService.markDraftSaved(activeDraft.id, undefined, identity.shopId, identity.userId);
      }
      const remaining = drafts.filter((d, idx) => idx !== activeDraftIndex && d.saveStatus !== 'saved');
      if (remaining.length > 0 && drafts.length > 1) {
        setViewMode('list');
      } else {
        if (identity.isValid) {
          ScanWorkspaceService.clearWorkspace(identity.shopId, identity.userId);
        }
        onClose();
      }
    } finally {
      setUploading(false);
    }
  };

  const curr = resolveCurrencySymbol(shop?.country, shop?.currency_code);

  const renderBadge = (badge: BadgeState, manualText = '! Enter manually') => {
    if (badge === 'detected') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <Check className="w-3 h-3" />
          <span>✓ Detected</span>
        </span>
      );
    }
    if (badge === 'check') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <AlertTriangle className="w-3 h-3" />
          <span>⚠ Check this</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
        <span>{manualText}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 my-auto border border-slate-200 dark:border-slate-800">
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
          {!imagePreview && drafts.length === 0 && !analyzing && (
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
                    onClick={handleTakePhoto}
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

              {/* Shopkeeper Guidance */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                  💡 Tips for best scan accuracy:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 font-medium">
                  <li>Hold camera steady under good room lighting.</li>
                  <li>Customer name, phone (if written), and amount will be extracted.</li>
                  <li>Works with Bengali (১৫০০), Hindi (१५००), and English (1500) numbers.</li>
                  <li>Multiple rows on one page can be reviewed individually.</li>
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
                  {ocrResult.reasonIfInvalid || ocrResult.error || 'This image does not contain a valid ledger page or receipt.'}
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

          {/* Step 4A: Batch Overview List View (When viewMode === 'list' && drafts.length > 1) */}
          {!analyzing && drafts.length > 1 && viewMode === 'list' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Photo Proof & Retake Bar */}
              <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Ledger Proof"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-300 dark:border-slate-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-700 shrink-0">
                      <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center">
                      <Layers className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                      {language === 'bn' ? `${drafts.length}টি এন্ট্রি পাওয়া গেছে` : `${drafts.length} Entries Detected`}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                      {drafts.filter((d) => d.saveStatus === 'saved').length} of {drafts.length} saved
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetPhoto}
                  className="p-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              </div>

              {/* List of drafts */}
              <div className="space-y-2.5">
                {drafts.map((d, idx) => {
                  const isSaved = d.saveStatus === 'saved';
                  const isSent = d.whatsappStatus === 'sent';
                  const isHandedOff = d.whatsappStatus === 'handed_off';
                  const isFailed = d.whatsappStatus === 'failed';
                  const isNeedReview =
                    d.identityStatus === 'PHONE_CONFLICT' ||
                    d.identityStatus === 'AMBIGUOUS' ||
                    !d.customerName ||
                    d.phone.replace(/\D/g, '').length < 10;

                  return (
                    <div
                      key={d.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isSaved
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : isNeedReview
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap mb-1">
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              #{idx + 1}
                            </span>
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {d.customerName || '(No Name)'}
                            </span>
                            {/* Semantic WhatsApp & Save Status Badges */}
                            {isSent && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                <Send className="w-2.5 h-2.5" />
                                <span>✓ Sent</span>
                              </span>
                            )}
                            {isHandedOff && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300">
                                <ArrowRight className="w-2.5 h-2.5" />
                                <span>↗ Chat Opened</span>
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>⚠ Send Failed</span>
                              </span>
                            )}
                            {isSaved && !isSent && !isHandedOff && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                <Check className="w-2.5 h-2.5" />
                                <span>✓ Saved</span>
                              </span>
                            )}
                            {!isSaved && isNeedReview && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>⚠ Review</span>
                              </span>
                            )}
                            {!isSaved && !isNeedReview && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                <span>Ready</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                            {d.phone && (
                              <div className="flex items-center space-x-1 font-medium">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{d.phone}</span>
                              </div>
                            )}
                            {d.productName && (
                              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                                📦 {d.productName} {d.optionalQuantity ? `(Qty: ${d.optionalQuantity})` : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`font-black text-base ${
                              d.type === 'credit_given'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-green-600 dark:text-green-400'
                            }`}
                          >
                            {d.type === 'credit_given' ? '+' : '-'}
                            {curr} {d.amount || '0'}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDraftIndex(idx);
                              setViewMode('detail');
                            }}
                            className={`mt-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all ${
                              isSaved
                                ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            }`}
                          >
                            {isSaved ? 'View' : 'Review & Save →'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action: Done or Clear */}
              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    const identity = getCanonicalWorkspaceIdentity(shop, activeUserId);
                    if (identity.isValid) {
                      ScanWorkspaceService.clearWorkspace(identity.shopId, identity.userId);
                    } else {
                      ScanWorkspaceService.clearWorkspace();
                    }
                    onClose();
                  }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl transition-colors"
                >
                  {drafts.every((d) => d.saveStatus === 'saved') ? 'Done' : 'Discard Batch'}
                </button>
                {drafts.some((d) => d.saveStatus !== 'saved') && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstPending = drafts.findIndex((d) => d.saveStatus !== 'saved');
                      if (firstPending !== -1) {
                        setActiveDraftIndex(firstPending);
                        setViewMode('detail');
                      }
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
                  >
                    Continue Reviewing →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 4B: Extracted Data Review & Confirmation (Detail Mode) */}
          {!analyzing && activeDraft && drafts.length > 0 && (viewMode === 'detail' || drafts.length === 1) && (
            <div className="space-y-4 animate-in fade-in">
              {/* Back to list button if multi-draft */}
              {drafts.length > 1 && (
                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center space-x-1.5 hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>← {language === 'bn' ? `সব এন্ট্রি দেখুন (${drafts.length})` : `All Entries (${drafts.length})`}</span>
                  </button>
                  <span className="text-[11px] font-bold text-slate-500">
                    Entry {activeDraftIndex + 1} of {drafts.length}
                  </span>
                </div>
              )}

              {/* Photo Proof & Retake Bar */}
              <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Ledger Proof"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-300 dark:border-slate-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-700 shrink-0">
                      <FileImage className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
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

              {/* Multi-Draft Batch Selector (If multiple entries exist) */}
              {drafts.length > 1 && (
                <div className="bg-indigo-50/80 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center space-x-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 mr-1" />
                      <span>Batch Entries Detected ({drafts.length} entries)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-300 flex items-center space-x-1 hover:underline"
                    >
                      <List className="w-3 h-3" />
                      <span>View List</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                    {drafts.map((d, idx) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setActiveDraftIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all flex items-center space-x-1 border ${
                          idx === activeDraftIndex
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                            : d.confirmed
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {d.confirmed && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                        <span>#{idx + 1} {d.customerName || 'Entry'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Field Verification Notice */}
              <div className="bg-blue-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-blue-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>AI Detection is Draft Only — Merchant Confirmation Required</span>
                </span>
              </div>

              {/* Review Card */}
              <div className="bg-slate-900 text-white p-4.5 rounded-3xl space-y-4 shadow-xl border border-slate-800">
                {/* Customer Name + Detection Badge */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Customer Name <span className="text-red-400">*</span>
                    </label>
                    {renderBadge(activeDraft.nameBadge)}
                  </div>
                  <input
                    type="text"
                    value={activeDraft.customerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter Customer Name"
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 font-black text-lg outline-none focus:border-blue-500"
                  />
                </div>

                {/* Mobile Number (Mandatory) + Detection Badge */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center">
                      <Phone className="w-3 h-3 mr-1 text-slate-400" />
                      Mobile Number <span className="text-red-400">*</span>
                    </label>
                    {renderBadge(activeDraft.phoneBadge, '! Phone required')}
                  </div>
                  <input
                    type="tel"
                    value={activeDraft.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 font-bold text-base outline-none focus:border-blue-500"
                  />
                  {!hasValidPhone && (
                    <span className="text-[10px] text-amber-400 font-semibold mt-1 block">
                      ⚠️ Valid mobile number is required to save and send WhatsApp receipt
                    </span>
                  )}
                </div>

                {/* Detected Amount in LARGE Font with Indic digit support */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      {t.amount_detected} <span className="text-red-400">*</span>
                    </label>
                    {renderBadge(activeDraft.amountBadge)}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-2xl font-black text-slate-400">
                      {curr}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={activeDraft.amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 font-black text-3xl tracking-tight outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Transaction Type Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('credit_given')}
                    className={`py-3 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-1.5 transition-all border-2 ${
                      activeDraft.type === 'credit_given'
                        ? 'bg-red-600 border-red-500 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <MinusCircle className="w-4 h-4" />
                    <span>{t.credit_given}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('payment_received')}
                    className={`py-3 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-1.5 transition-all border-2 ${
                      activeDraft.type === 'payment_received'
                        ? 'bg-green-600 border-green-500 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{t.payment_received}</span>
                  </button>
                </div>
              </div>

              {/* ----------------------------------------------------------------- */}
              {/* CANONICAL CUSTOMER IDENTITY RESOLUTION CARD                       */}
              {/* ----------------------------------------------------------------- */}
              <div className="space-y-3">
                {/* 1. PHONE CONFLICT STATE */}
                {activeDraft.identityStatus === 'PHONE_CONFLICT' && (
                  <div className="bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 p-4 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300 font-black text-xs sm:text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                      <span>⚠ নাম মিলে গেছে, কিন্তু Mobile Number আলাদা</span>
                    </div>
                    <p className="text-xs text-rose-900 dark:text-rose-200 font-medium leading-relaxed">
                      {activeDraft.resolutionReasons[0] ||
                        'Customer name matches an existing record, but the mobile number is different. Please select the correct action to prevent account mix-ups.'}
                    </p>

                    <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-rose-200 dark:border-rose-900 text-xs space-y-1">
                      <div className="text-slate-600 dark:text-slate-400">
                        Scanned Entry: <strong className="text-slate-900 dark:text-white">{activeDraft.customerName}</strong> ({activeDraft.phone})
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      {activeDraft.candidates.map((cand) => (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cand)}
                          className="w-full text-left p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-100/50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                              {cand.display_label || cand.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Recorded Phone: {cand.phone_number} • Current Due: ₹{cand.balance || 0}
                            </span>
                          </div>
                          <span className="text-rose-700 dark:text-rose-400 font-black text-xs">
                            ✓ Use This Customer
                          </span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleSelectCustomer(null)}
                        className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98]"
                      >
                        <span>+ Save as Separate New Customer</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. AMBIGUOUS CANDIDATES STATE */}
                {activeDraft.identityStatus === 'AMBIGUOUS' && (
                  <div className="bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-800 p-4 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-200 font-black text-xs sm:text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                      <span>⚠ একই রকম একাধিক Customer পাওয়া গেছে</span>
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                      Select which customer account this transaction belongs to:
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {activeDraft.candidates.map((cand) => (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cand)}
                          className="w-full text-left p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-100/50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                              {cand.display_label || cand.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Phone: {cand.phone_number || 'No phone'} • Due: ₹{cand.balance || 0}
                            </span>
                          </div>
                          <span className="text-amber-700 dark:text-amber-400 font-black text-xs">
                            Select
                          </span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleSelectCustomer(null)}
                        className="w-full py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl text-center"
                      >
                        + None of these (Save as New Customer)
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. CONFIRMED / EXACT / STRONG MATCH STATE */}
                {activeDraft.matchedCustomer && (
                  <div className="bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 p-3.5 rounded-2xl gap-2 min-w-0 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-xl shrink-0">
                          <UserCheck className="w-5 h-5 text-green-700 dark:text-green-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                              {activeDraft.matchedCustomer.display_label || activeDraft.matchedCustomer.name}
                            </span>
                            <span className="bg-green-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                              ✓ আগের Customer-এর সাথে মিলেছে
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate mt-0.5">
                            Phone: {activeDraft.matchedCustomer.phone_number || activeDraft.phone || 'No phone recorded'} • Current Due: ₹{activeDraft.matchedCustomer.balance || 0}
                          </span>
                          {activeDraft.resolutionReasons.length > 0 && (
                            <span className="text-[10px] text-green-700 dark:text-green-300 font-semibold block mt-0.5">
                              {activeDraft.resolutionReasons.join(' • ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectCustomer(null)}
                        className="bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase px-2.5 py-1.5 rounded-xl shrink-0 transition-colors shadow-sm"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. NEW CUSTOMER SELECTION / NO MATCH STATE */}
                {!activeDraft.matchedCustomer &&
                  activeDraft.identityStatus !== 'PHONE_CONFLICT' &&
                  activeDraft.identityStatus !== 'AMBIGUOUS' && (
                    <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold">
                        <span>{t.select_customer}:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                          + নতুন Customer যোগ করুন
                        </span>
                      </div>

                      <select
                        value=""
                        onChange={(e) => {
                          const found = customers.find((c) => c.id === e.target.value);
                          handleSelectCustomer(found || null);
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs outline-none"
                      >
                        <option value="">-- Save as New Customer: "{activeDraft.customerName || 'New'}" --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.display_label || c.name} {c.phone_number ? `(${c.phone_number})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
              </div>

              {/* Real-Time Balance Preview (Cross-Account Mislink Detection) */}
              {(() => {
                const numericAmount = activeAmountParsed.amount;
                const currentBal = activeDraft.matchedCustomer ? activeDraft.matchedCustomer.balance || 0 : 0;
                const isCredit = activeDraft.type === 'credit_given';
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
                          {activeDraft.matchedCustomer ? 'Current Due' : 'Starting Due'}
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
                        <span
                          className={`font-black text-sm ${
                            isCredit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatShopCurrency(numericAmount, shop?.country, shop?.currency_code)}
                        </span>
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mx-2" />

                      <div className="text-right">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[11px]">
                          Projected Due
                        </span>
                        <span
                          className={`font-black text-base ${
                            projectedBal > 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                          {formatShopCurrency(Math.abs(projectedBal), shop?.country, shop?.currency_code)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Collapsible Optional Details Drawer (Problem 2: Product name, Qty, Unit Price, Address, Note) */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                  className="w-full p-3 flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="flex items-center space-x-1.5">
                    <span>
                      {language === 'bn'
                        ? 'অতিরিক্ত তথ্য (ঐচ্ছিক - পণ্য, পরিমাণ, ঠিকানা)'
                        : 'More details (Optional - Item, Qty, Address)'}
                    </span>
                    {(activeDraft.productName || activeDraft.customerAddress || (activeDraft.optionalItems && activeDraft.optionalItems.length > 0)) && (
                      <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded-md text-[10px]">
                        ✓ Added
                      </span>
                    )}
                  </span>
                  {showOptionalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showOptionalDetails && (
                  <div className="p-3 pt-0 space-y-3 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                    {/* Product / Item Name */}
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        {language === 'bn' ? 'পণ্যের নাম / কী কেনা হয়েছে (ঐচ্ছিক)' : 'Product / Item Name (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={activeDraft.productName || ''}
                        onChange={(e) => updateActiveDraft({ productName: e.target.value })}
                        placeholder={language === 'bn' ? 'যেমন: আলু, চাল ২৫ কেজি, সিমেন্ট...' : 'e.g. Potato, Rice 25kg, Cement...'}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:border-blue-600 outline-none"
                      />
                    </div>

                    {/* Quantity & Unit Price in 2 Columns */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          {language === 'bn' ? 'পরিমাণ (ঐচ্ছিক)' : 'Quantity (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={activeDraft.optionalQuantity || ''}
                          onChange={(e) => updateActiveDraft({ optionalQuantity: e.target.value })}
                          placeholder={language === 'bn' ? 'যেমন: ৫ কেজি, ২ ব্যাগ' : 'e.g. 5 kg, 2 bags'}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:border-blue-600 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          {language === 'bn' ? 'দর / ইউনিট রেট (ঐচ্ছিক)' : 'Unit Price (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={activeDraft.optionalUnitPrice || ''}
                          onChange={(e) => updateActiveDraft({ optionalUnitPrice: e.target.value })}
                          placeholder="e.g. 40, 1200"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:border-blue-600 outline-none"
                        />
                      </div>
                    </div>

                    {/* Customer Address */}
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        {language === 'bn' ? 'কাস্টমারের ঠিকানা (ঐচ্ছিক)' : 'Customer Address (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={activeDraft.customerAddress || ''}
                        onChange={(e) => updateActiveDraft({ customerAddress: e.target.value })}
                        placeholder={language === 'bn' ? 'যেমন: গ্রাম: রামপুর, পোস্ট অফিসের কাছে' : 'e.g. Vill: Rampur, Near Post Office'}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:border-blue-600 outline-none"
                      />
                    </div>

                    {/* Detected Items */}
                    {activeDraft.optionalItems && activeDraft.optionalItems.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                          Detected Items ({activeDraft.optionalItems.length})
                        </span>
                        <div className="space-y-1">
                          {activeDraft.optionalItems.map((it, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-lg text-xs font-semibold"
                            >
                              <span>{it.name} {it.quantity > 1 ? `x${it.quantity}` : ''}</span>
                              <span className="font-bold">{curr} {it.total || it.unit_price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Note Input */}
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        {t.note_optional}
                      </label>
                      <input
                        type="text"
                        value={activeDraft.optionalNote || ''}
                        onChange={(e) => updateActiveDraft({ optionalNote: e.target.value })}
                        placeholder={t.note_optional}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Explicit Confirm & Save Action Button */}
              <button
                type="button"
                disabled={!isDraftSavable}
                onClick={handleConfirmActiveDraft}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Saving Ledger Proof...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      {drafts.length > 1
                        ? `Confirm & Save Entry #${activeDraftIndex + 1}`
                        : t.confirm_and_save}
                    </span>
                  </>
                )}
              </button>

              {/* Helpful Validation Hint if Disabled */}
              {!isDraftSavable && !uploading && (
                <div className="text-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {!hasValidName
                    ? '⚠️ Customer name is required'
                    : !hasValidPhone
                    ? '⚠️ Valid 10-digit mobile number is required'
                    : !hasValidAmount
                    ? '⚠️ Amount must be greater than 0'
                    : isUnresolvedConflictOrAmbiguity
                    ? '⚠️ Please resolve customer selection above before saving'
                    : activeDraft.confirmed
                    ? '✅ This entry is already saved!'
                    : ''}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
