'use client';

import React, { useState } from 'react';
import { Phone, KeyRound, ArrowRight, UserCheck, Shield, Store, User, Sparkles, Clock, RotateCcw, UserPlus } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { postApi, setToken, setUser } from '../lib/api';

interface AuthModalProps {
  lang: Language;
  onLoginSuccess: (user: any) => void;
  onError: (msg: string) => void;
  onResetDemo?: () => void;
}

export default function AuthModal({ lang, onLoginSuccess, onError, onResetDemo }: AuthModalProps) {
  const [tab, setTab] = useState<'demo' | 'general'>('demo');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('123456');
  const [loading, setLoading] = useState(false);

  const t = (k: string) => translate(k, lang);

  const handleLogin = async (phoneToUse?: string, otpToUse?: string, nameToUse?: string) => {
    const finalPhone = (phoneToUse || phone).trim();
    const finalOtp = (otpToUse || otp || '123456').trim();
    const finalName = (nameToUse !== undefined ? nameToUse : name).trim();
    setLoading(true);
    try {
      const res = await postApi('login', {
        phone: finalPhone,
        otp: finalOtp,
        name: finalName,
      });
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
    handleLogin(demoPhone, '123456', '');
  };

  return (
    <div className="mx-auto my-6 max-w-lg space-y-5">
      {/* Top Tab Switcher: Demo Roles vs General Sign In */}
      <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200">
        <button
          type="button"
          onClick={() => setTab('demo')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            tab === 'demo'
              ? 'bg-white text-teal-950 shadow-xs border border-teal-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-teal-700" />
          <span>1-Tap Demo Roles</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('general')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            tab === 'general'
              ? 'bg-white text-teal-950 shadow-xs border border-teal-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4 text-teal-700" />
          <span>General Sign In / Register</span>
        </button>
      </div>

      {/* Live Cold-Start Loading Notification */}
      {loading && (
        <div className="rounded-2xl border-2 border-teal-400 bg-teal-50/95 p-4 text-center shadow-sm space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-center gap-2.5 text-teal-950 font-bold text-sm">
            <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Connecting to RefillCare Server…</span>
          </div>
          <p className="text-xs text-teal-800 leading-relaxed max-w-sm mx-auto">
            Backend is hosted on Render free tier. If the server is waking up from sleep, cold start may take 30–45 seconds on first request. Please wait, authenticating now!
          </p>
        </div>
      )}

      {/* TAB 1: 1-Tap Quick Demo Role Selector */}
      {tab === 'demo' && (
        <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-b from-teal-50/70 to-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900">
              <Sparkles className="h-4 w-4 text-teal-700" />
              <span>1-Tap Instant Role Access</span>
            </div>
            <span className="text-[10px] font-semibold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
              Pre-seeded accounts
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
              className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white hover:border-teal-600 hover:bg-teal-50/50 transition-all text-left shadow-2xs group sm:col-span-2"
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

          {/* Restart Demo Flow Banner */}
          {onResetDemo && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-2xs">
              <div className="flex items-center gap-2 text-amber-950 font-semibold text-xs">
                <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Re-running the demo flow?</span>
              </div>
              <button
                type="button"
                onClick={onResetDemo}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-xs shadow-2xs transition active:scale-95"
              >
                Restart Demo Flow
              </button>
            </div>
          )}

          {/* Note on Render Cold Start */}
          <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center border-t border-teal-100/80">
            <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>Note: Render free tier spins down after idle; first request may take ~30–45s to wake up.</span>
          </div>
        </div>
      )}

      {/* TAB 2: General Sign In & Registration Card */}
      {tab === 'general' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold mb-2">
              <UserPlus className="w-3.5 h-3.5 text-teal-700" />
              <span>Reviewer &amp; Live User Sign In</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Sign In or Register
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Enter any 10-digit mobile number. If the number is not yet registered, RefillCare will automatically create a fresh customer account with its own order history and DPDP health data records.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Full Name <span className="text-slate-400 font-normal lowercase">(optional for new users)</span>
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 h-4 w-4 text-slate-400" />
                <input
                  id="general-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Mukherjee"
                  className="w-full rounded-2xl border border-slate-300 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 shadow-2xs outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('phone')}
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-3.5 h-4 w-4 text-slate-400" />
                <input
                  id="general-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  className="w-full rounded-2xl border border-slate-300 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 shadow-2xs outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('otp')}
                </label>
                <span className="text-[11px] font-semibold text-teal-700">
                  Demo OTP: 123456
                </span>
              </div>
              <div className="relative flex items-center">
                <KeyRound className="absolute left-3.5 h-4 w-4 text-slate-400" />
                <input
                  id="general-otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
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
              <span>{loading ? 'Authenticating…' : 'Sign In as Customer'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick info note */}
          <div className="rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1 border border-slate-200/80">
            <p className="font-semibold text-slate-800">💡 Tip for Reviewers:</p>
            <p>
              You can test the entire customer journey — uploading a prescription, browsing medicines, placing an order, and reviewing DPDP consent — with your own mobile number.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
