'use client';

import React, { useState } from 'react';
import { Phone, KeyRound, ArrowRight, UserCheck, Shield, Store, User, Sparkles } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { postApi, setToken, setUser } from '../lib/api';

interface AuthModalProps {
  lang: Language;
  onLoginSuccess: (user: any) => void;
  onError: (msg: string) => void;
}

export default function AuthModal({ lang, onLoginSuccess, onError }: AuthModalProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const t = (k: string) => translate(k, lang);

  const handleLogin = async (phoneToUse?: string, otpToUse?: string) => {
    const finalPhone = (phoneToUse || phone).trim();
    const finalOtp = (otpToUse || otp || '123456').trim();
    setLoading(true);
    try {
      const res = await postApi('login', { phone: finalPhone, otp: finalOtp });
      setToken(res.token);
      setUser(res.user);
      onLoginSuccess(res.user);
    } catch (err: any) {
      onError(err.message || 'Login failed. Demo OTP is 123456');
    } finally {
      setLoading(false);
    }
  };

  const handleOneClickLogin = (demoPhone: string) => {
    setPhone(demoPhone);
    setOtp('123456');
    handleLogin(demoPhone, '123456');
  };

  return (
    <div className="mx-auto my-6 max-w-lg space-y-6">
      {/* 1-Tap Quick Demo Role Selector */}
      <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-b from-teal-50/70 to-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900">
            <Sparkles className="h-4 w-4 text-teal-700" />
            <span>1-Tap Instant Role Access</span>
          </div>
          <span className="text-[10px] font-semibold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
            No signup needed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleOneClickLogin('9000000001')}
            className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white hover:border-teal-600 hover:bg-teal-50/50 transition-all text-left shadow-2xs group"
          >
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">Debasish Ghosh</div>
              <div className="text-[10px] text-slate-500 truncate">Customer • Chronic Refills</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOneClickLogin('9000000002')}
            className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white hover:border-teal-600 hover:bg-teal-50/50 transition-all text-left shadow-2xs group"
          >
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">Rina Sen</div>
              <div className="text-[10px] text-slate-500 truncate">Customer • Generic Consent</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOneClickLogin('9000000003')}
            className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white hover:border-teal-600 hover:bg-teal-50/50 transition-all text-left shadow-2xs group"
          >
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">Arif Mondal</div>
              <div className="text-[10px] text-slate-500 truncate">Customer • On-Hold Reupload</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOneClickLogin('9000000099')}
            className="flex items-center gap-3 p-3 rounded-2xl border border-purple-200 bg-white hover:border-purple-600 hover:bg-purple-50/50 transition-all text-left shadow-2xs group"
          >
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">Anita Rao</div>
              <div className="text-[10px] text-purple-700 font-semibold truncate">Registered Pharmacist</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOneClickLogin('9000000081')}
            className="flex items-center gap-3 p-3 rounded-2xl border border-blue-200 bg-white hover:border-blue-600 hover:bg-blue-50/50 transition-all text-left shadow-2xs group"
          >
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">Salt Lake Store #81</div>
              <div className="text-[10px] text-blue-700 font-semibold truncate">Store Fulfillment Staff</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOneClickLogin('9000000082')}
            className="flex items-center gap-3 p-3 rounded-2xl border border-amber-200 bg-white hover:border-amber-600 hover:bg-amber-50/50 transition-all text-left shadow-2xs group"
          >
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">Behala Store Staff</div>
              <div className="text-[10px] text-amber-700 font-semibold truncate">Store Staff • Gate Test</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOneClickLogin('9000000083')}
            className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white hover:border-teal-600 hover:bg-teal-50/50 transition-all text-left shadow-2xs group"
          >
            <div className="p-2 rounded-xl bg-slate-50 text-slate-700 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">Howrah Store #83</div>
              <div className="text-[10px] text-slate-500 truncate">Store Staff • Packing</div>
            </div>
          </button>
        </div>
      </div>

      {/* Manual Phone & OTP Sign In Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm space-y-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Sign In with Registered Phone Number
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter your registered phone number. For the live demo, use any phone number from the cards above — OTP is <code className="font-bold text-teal-800 bg-teal-50 px-1 rounded">123456</code>.
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('phone')}
            </label>
            <div className="relative flex items-center">
              <Phone className="absolute left-3.5 h-4 w-4 text-slate-400" />
              <input
                id="ph"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full rounded-2xl border border-slate-300 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 shadow-2xs outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('otp')}
            </label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3.5 h-4 w-4 text-slate-400" />
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP (demo: 123456)"
                className="w-full rounded-2xl border border-slate-300 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 shadow-2xs outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 py-3 text-sm font-bold text-white shadow-md transition hover:bg-teal-800 disabled:opacity-50 active:scale-95"
          >
            <span>{loading ? 'Authenticating…' : t('sign_in')}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
