import React, { useState, useEffect } from 'react';
import { X, FlaskConical, Play, CheckCircle2, AlertTriangle, Smartphone, Info } from 'lucide-react';
import { Customer, Shop, Language, Transaction, ReceiptDetailsPayload } from '../types';
import {
  WhatsAppCapabilities,
  IntentTestResult,
  queryNativeWhatsAppCapabilities,
  executeIntentCandidate,
  fileToBase64,
} from '../native/whatsappExperiment';

interface WhatsAppExperimentLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCustomer: Customer;
  shop: Shop;
  language: Language;
  transaction?: Transaction;
  details?: ReceiptDetailsPayload | null;
  receiptText: string;
  generateReceiptImage: () => Promise<File | null>;
}

export const WhatsAppExperimentLabModal: React.FC<WhatsAppExperimentLabModalProps> = ({
  isOpen,
  onClose,
  activeCustomer,
  shop,
  receiptText,
  generateReceiptImage,
}) => {
  const [capabilities, setCapabilities] = useState<WhatsAppCapabilities | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'>('A');
  const [testPhone, setTestPhone] = useState<string>(activeCustomer.phone_number || '');
  const [delayMs, setDelayMs] = useState<number>(100);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<IntentTestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      queryNativeWhatsAppCapabilities().then((caps) => {
        setCapabilities(caps);
      });
      setTestPhone(activeCustomer.phone_number || '');
      setResult(null);
      setErrorMsg(null);
    }
  }, [isOpen, activeCustomer]);

  if (!isOpen) return null;

  const candidateDescriptions: Record<string, { title: string; desc: string; type: string }> = {
    A: {
      title: 'Candidate A: Standard ACTION_SEND (Consumer)',
      desc: 'Standard Android share with EXTRA_STREAM (image) & EXTRA_TEXT targeting com.whatsapp.',
      type: 'Single Intent',
    },
    B: {
      title: 'Candidate B: Standard ACTION_SEND (Business)',
      desc: 'Standard Android share targeting com.whatsapp.w4b (WhatsApp Business).',
      type: 'Single Intent',
    },
    C: {
      title: 'Candidate C: ACTION_SEND + Experimental Recipient Extras',
      desc: 'Injects jid, address, and EXTRA_PHONE_NUMBER to test if modern WhatsApp accepts recipient targeting.',
      type: 'Single Intent (Experimental)',
    },
    D: {
      title: 'Candidate D: ACTION_VIEW Deep Link (whatsapp://)',
      desc: 'Launches whatsapp://send?phone=...&text=... without image attachment.',
      type: 'Single Intent (Deep Link)',
    },
    E: {
      title: 'Candidate E: Two-Intent Sequence Timing Hack',
      desc: 'Launches Intent 1 (whatsapp://send?phone=...) then waits X ms before launching Intent 2 (ACTION_SEND image).',
      type: 'Dual Intent Sequence',
    },
    F: {
      title: 'Candidate F: ACTION_SENDTO (smsto: scheme)',
      desc: 'Uses smsto:<phone> with EXTRA_STREAM targeting WhatsApp.',
      type: 'Single Intent (Scheme)',
    },
    G: {
      title: 'Candidate G: Baseline wa.me (Working Production Fallback)',
      desc: 'Official direct wa.me link. 100% verified working for unsaved numbers (text-only).',
      type: 'Production Baseline',
    },
  };

  const handleRunTest = async () => {
    setIsRunning(true);
    setResult(null);
    setErrorMsg(null);

    try {
      let imageBase64: string | null = null;
      // Only generate image for candidates that accept images (A, B, C, E, F)
      if (['A', 'B', 'C', 'E', 'F'].includes(selectedCandidate)) {
        const imageFile = await generateReceiptImage();
        if (imageFile) {
          imageBase64 = await fileToBase64(imageFile);
        }
      }

      const res = await executeIntentCandidate({
        candidate: selectedCandidate,
        phone: testPhone.replace(/\D/g, ''),
        text: receiptText,
        imageBase64,
        fileName: `Receipt_${Date.now()}.png`,
        delayMs,
      });

      setResult(res);
      if (!res.success && res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to execute intent candidate');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-indigo-400" />
            <h3 className="font-extrabold text-base tracking-tight">WhatsApp Native Intent Lab (Isolated POC)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Working Fallback Guarantee Alert */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-900 dark:text-emerald-200 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Production Fallback Protected</p>
              <p className="text-[11px] opacity-90">
                Primary "Send on WhatsApp" button uses the verified <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 py-0.5 rounded">wa.me</code> direct-chat path. This laboratory is completely isolated.
              </p>
            </div>
          </div>

          {/* Capabilities Detection Banner */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 text-xs">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                Device WhatsApp Discovery
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {capabilities ? 'DETECTED' : 'NOT ON NATIVE / PENDING'}
              </span>
            </div>
            {capabilities ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <div>
                  Consumer App:{' '}
                  <span className={capabilities.whatsappInstalled ? 'text-emerald-600 font-bold' : 'text-red-500'}>
                    {capabilities.whatsappInstalled ? `Yes (${capabilities.whatsappVersion || 'Installed'})` : 'Not Found'}
                  </span>
                </div>
                <div>
                  Business App:{' '}
                  <span className={capabilities.whatsappBusinessInstalled ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                    {capabilities.whatsappBusinessInstalled ? `Yes (${capabilities.whatsappBusinessVersion || 'Installed'})` : 'Not Found'}
                  </span>
                </div>
                <div>
                  whatsapp:// Scheme:{' '}
                  <span className={capabilities.viewSchemeResolves ? 'text-emerald-600 font-bold' : 'text-red-500'}>
                    {capabilities.viewSchemeResolves ? 'Resolves' : 'No'}
                  </span>
                </div>
                <div>
                  ACTION_SEND (image):{' '}
                  <span className={capabilities.sendImageResolves ? 'text-emerald-600 font-bold' : 'text-red-500'}>
                    {capabilities.sendImageResolves ? 'Resolves' : 'No'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                Querying device PackageManager or running in web preview.
              </p>
            )}
          </div>

          {/* Test Phone Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Test Unsaved Phone Number:
            </label>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="e.g. 919876543210 (Must NOT be in phone Contacts)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
              ⚠️ Mandatory rule: Do NOT test using a saved phone contact.
            </p>
          </div>

          {/* Candidate Matrix Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Intent Candidate to Test:
            </label>
            <div className="space-y-2">
              {(Object.keys(candidateDescriptions) as Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'>).map((cand) => {
                const info = candidateDescriptions[cand];
                const isSelected = selectedCandidate === cand;
                return (
                  <button
                    key={cand}
                    type="button"
                    onClick={() => setSelectedCandidate(cand)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{info.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                        {info.type}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-1">{info.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Candidate E Timing Config */}
          {selectedCandidate === 'E' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-1.5">
              <label className="block font-bold text-xs text-amber-900 dark:text-amber-300">
                Delay between Intent 1 and Intent 2:
              </label>
              <div className="flex gap-2">
                {[0, 50, 100, 250, 500].map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => setDelayMs(ms)}
                    className={`px-3 py-1 text-xs rounded-lg font-mono font-bold transition-all ${
                      delayMs === ms
                        ? 'bg-amber-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {ms}ms
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Execution Result Telemetry Box */}
          {result && (
            <div className={`p-3 rounded-xl border space-y-1 text-xs font-mono ${
              result.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
            }`}>
              <div className="font-bold flex items-center justify-between">
                <span>Result: {result.success ? 'LAUNCHED' : 'FAILED'}</span>
                <span className="text-[10px]">{result.executionTimeMs}ms</span>
              </div>
              <p className="text-[11px]">Mode: {result.mode}</p>
              {result.resolvedComponent && <p className="text-[11px] truncate">Component: {result.resolvedComponent}</p>}
              {result.contentUri && <p className="text-[10px] truncate">URI: {result.contentUri}</p>}
              {result.details && <p className="text-[11px] opacity-90">{result.details}</p>}
              {result.error && <p className="text-[11px] text-red-600 font-bold">{result.error}</p>}
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Close Lab
          </button>
          <button
            type="button"
            onClick={handleRunTest}
            disabled={isRunning}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            {isRunning ? (
              <span className="animate-pulse">Rendering & Launching...</span>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Candidate {selectedCandidate}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
