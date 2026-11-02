'use client';

import React, { useState } from 'react';
import { Phone, KeyRound, ArrowRight, UserCheck } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { postApi, setToken, setUser } from '../lib/api';

interface AuthModalProps {
  lang: Language;
  onLoginSuccess: (user: any) => void;
  onError: (msg: string) => void;
}

export default function AuthModal({ lang, onLoginSuccess, onError }: AuthModalProps) {
  const [phone, setPhone] = useState('9000000001');
  const [otp, setOtp] = useState('123456');
  const [loading, setLoading] = useState(false);

  const t = (k: string) => translate(k, lang);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await postApi('login', { phone: phone.trim(), otp: otp.trim() });
      setToken(res.token);
      setUser(res.user);
      onLoginSuccess(res.user);
    } catch (err: any) {
      onError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoPhone: string) => {
    setPhone(demoPhone);
    setOtp('123456');
  };

  return (
    <div className="mx-auto my-12 max-w-md">
      {/* Sign In Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('sign_in')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('demo_otp_note')}
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('phone')}
            </label>
            <div className="relative mt-1.5 flex items-center">
              <Phone className="absolute left-3.5 h-4 w-4 text-slate-400" />
              <input
                id="ph"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9000000001"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('otp')}
            </label>
            <div className="relative mt-1.5 flex items-center">
              <KeyRound className="absolute left-3.5 h-4 w-4 text-slate-400" />
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-50"
          >
            <span>{loading ? 'Verifying…' : t('sign_in')}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Demo Credentials Card */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          <UserCheck className="h-4 w-4 text-teal-600" />
          <span>{t('quick_demo')}</span>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fillDemo('9000000001')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Customer: Debasish
          </button>
          <button
            type="button"
            onClick={() => fillDemo('9000000002')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Customer: Rina
          </button>
          <button
            type="button"
            onClick={() => fillDemo('9000000099')}
            className="rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300"
          >
            Pharmacist: Anita
          </button>
          <button
            type="button"
            onClick={() => fillDemo('9000000081')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Store: Salt Lake
          </button>
          <button
            type="button"
            onClick={() => fillDemo('9000000083')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Store: Howrah
          </button>
        </div>
      </div>
    </div>
  );
}
