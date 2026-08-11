import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { translations } from '../i18n/translations';
import { supabase, isSupabaseConfigured, isDevAuth } from '../lib/supabase';
import { CountryPhoneInput } from './CountryPhoneInput';
import {
  Phone,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Code2,
  Edit2,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

interface Props {
  language: Language;
  onSuccess: (phone: string, userId?: string) => void;
  onBack: () => void;
}

export const PhoneAuth: React.FC<Props> = ({ language, onSuccess, onBack }) => {
  const t = translations[language];
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [lastEmail] = useState<string | null>(() => localStorage.getItem('smart_khata_last_account_email'));
  const [lastAvatar] = useState<string | null>(() => localStorage.getItem('smart_khata_last_account_avatar'));
  const [lastName] = useState<string | null>(() => localStorage.getItem('smart_khata_last_account_name'));
  const [avatarErr, setAvatarErr] = useState(false);

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email && email.includes('@')) {
      return email.split('@')[0].slice(0, 2).toUpperCase();
    }
    return 'SK';
  };

  // 30-second Resend OTP Timer State
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Check for OAuth URL Callback Error
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error_description') || urlParams.get('error');
    if (oauthError) {
      console.warn('[AUTH DEBUG] OAuth Callback returned error:', oauthError);
      setErrorMsg(t.google_signin_error);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [t.google_signin_error]);

  // Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (step === 'otp' && resendTimer > 0) {
      setCanResend(false);
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, resendTimer]);

  const startResendCountdown = () => {
    setResendTimer(30);
    setCanResend(false);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneNumber.trim() || phoneNumber.length < 8) {
      setErrorMsg(t.invalid_phone_error);
      return;
    }
    setErrorMsg('');
    setLoading(true);

    if (isDevAuth) {
      console.log(`[AUTH] Step 1: Send OTP initiated for ${phoneNumber} (DEV MODE active)`);
      setTimeout(() => {
        setLoading(false);
        setStep('otp');
        startResendCountdown();
        setInfoMsg(t.otp_sent_to.replace('{phone}', phoneNumber));
      }, 400);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        console.log(`[AUTH] Step 1: Sending real Supabase SMS OTP to ${phoneNumber}`);
        const { error } = await supabase.auth.signInWithOtp({
          phone: phoneNumber,
        });
        if (error) throw error;
        setStep('otp');
        startResendCountdown();
        setInfoMsg(t.otp_sent_to.replace('{phone}', phoneNumber));
      } catch (err: any) {
        console.error(`[AUTH] Error sending Supabase SMS OTP:`, err);
        setErrorMsg(err.message || 'Failed to send OTP. Try again.');
      } finally {
        setLoading(false);
      }
    } else {
      setTimeout(() => {
        setLoading(false);
        setStep('otp');
        startResendCountdown();
        setInfoMsg(t.otp_sent_to.replace('{phone}', phoneNumber));
      }, 400);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 4) {
      setErrorMsg(t.invalid_otp_error);
      return;
    }
    setErrorMsg('');
    setLoading(true);

    if (isDevAuth) {
      console.log(`[AUTH] Step 2: Verify OTP initiated with code "${otpCode}" (DEV MODE active)`);
      setTimeout(() => {
        setLoading(false);
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const devUserId = `00000000-0000-4000-a000-${cleanPhone.padStart(12, '0').slice(-12)}`;
        console.log(`[AUTH] Dev authentication successful for phone: ${phoneNumber}, userId: ${devUserId}`);
        onSuccess(phoneNumber, devUserId);
      }, 400);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        console.log(`[AUTH] Step 2: Verifying real Supabase OTP token`);
        const { data, error } = await supabase.auth.verifyOtp({
          phone: phoneNumber,
          token: otpCode,
          type: 'sms',
        });
        if (error) throw error;
        console.log(`[AUTH] Supabase OTP verification succeeded. User ID: ${data.user?.id}`);
        onSuccess(phoneNumber, data.user?.id);
      } catch (err: any) {
        console.error(`[AUTH] Error verifying Supabase OTP:`, err);
        setErrorMsg(err.message || t.invalid_otp_error);
      } finally {
        setLoading(false);
      }
    } else {
      setTimeout(() => {
        setLoading(false);
        onSuccess(phoneNumber, '00000000-0000-4000-a000-017000000000');
      }, 400);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white flex flex-col justify-between p-4 max-w-md mx-auto">
      <div className="pt-6">
        {/* Back Button */}
        <button
          onClick={step === 'otp' ? () => setStep('phone') : onBack}
          className="inline-flex items-center text-slate-600 dark:text-slate-300 font-bold hover:text-slate-900 dark:hover:text-white transition-colors p-2 -ml-2 mb-4 text-sm"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          {t.back}
        </button>

        {/* DEVELOPMENT MODE BADGE */}
        {isDevAuth && (
          <div className="bg-amber-50 dark:bg-amber-950/80 border-2 border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200 font-extrabold text-xs p-3.5 rounded-2xl mb-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2">
              <span className="bg-amber-500 text-slate-950 text-[10px] uppercase font-black px-2 py-0.5 rounded-md tracking-wider flex items-center shadow-sm">
                <Code2 className="w-3.5 h-3.5 mr-1" />
                {t.dev_mode_title}
              </span>
              <span className="text-xs font-bold">{t.dev_mode_sub}</span>
            </div>
          </div>
        )}

        {!isSupabaseConfigured && !isDevAuth && (
          <div className="bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs p-3 rounded-xl mb-4">
            <span className="font-bold">{t.demo_mode}:</span> {t.demo_notice}
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-5">
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
                  <Phone className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t.phone_login}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">{t.enter_mobile}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {t.customer_phone}
                </label>
                <CountryPhoneInput
                  language={language}
                  value={phoneNumber}
                  onChange={(e164) => setPhoneNumber(e164)}
                  autoFocus
                />
              </div>

              {errorMsg && (
                <div className="text-red-600 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-950/80 p-3 rounded-xl border border-red-200 dark:border-red-800 animate-in fade-in">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <span>{t.send_otp}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-200 dark:border-slate-700 w-full" />
                <span className="bg-white dark:bg-slate-800 px-3 text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                  {t.or_sign_in_with}
                </span>
                <div className="border-t border-slate-200 dark:border-slate-700 w-full" />
              </div>

              {/* Google Sign-In OAuth Button */}
              <button
                type="button"
                onClick={async () => {
                  if (isSupabaseConfigured && supabase) {
                    try {
                      setLoading(true);
                      setErrorMsg('');
                      const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin,
    queryParams: {
      prompt: 'select_account',
    },
  },
});
                  

                     
                      if (error) throw error;
                    } catch (err: any) {
                      console.error('[AUTH] Google Sign-In Error:', err);
                      setErrorMsg(err.message || t.google_signin_error);
                    } finally {
                      setLoading(false);
                    }
                  } else {
                    onSuccess('+8801700000000', 'google-dev-user-12345');
                  }
                }}
                disabled={loading}
                className="w-full py-3.5 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-650 text-slate-700 dark:text-white font-extrabold text-sm rounded-2xl border-2 border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center space-x-2.5 transition-all active:scale-[0.98]"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{t.continue_with_google}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7" />
                </div>

                {/* Edit Phone Number Button */}
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{t.edit_phone_number}</span>
                </button>
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t.verify_otp}</h2>
                <div className="mt-1 flex items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span>{infoMsg || t.otp_sent_to.replace('{phone}', phoneNumber)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {t.enter_otp}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-4 py-4 text-center text-3xl tracking-[0.3em] font-black rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none transition-all"
                  autoFocus
                />
              </div>

              {errorMsg && (
                <div className="text-red-600 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-200 animate-in fade-in">
                  {errorMsg}
                </div>
              )}

              {/* Verify Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <span>{t.verify_otp}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Resend OTP Button with 30s Countdown */}
              <div className="pt-2 text-center">
                {canResend ? (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                    className="inline-flex items-center space-x-1 text-sm font-extrabold text-blue-600 hover:underline py-1"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    <span>{t.resend_otp}</span>
                  </button>
                ) : (
                  <span className="text-xs font-extrabold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl inline-block">
                    {t.resend_in_seconds.replace('{seconds}', resendTimer.toString())}
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="pb-6 text-center text-xs text-slate-400 font-medium">
        {t.step_counter} 3 of 4 • {t.trusted_tagline}
      </div>
    </div>
  );
};
