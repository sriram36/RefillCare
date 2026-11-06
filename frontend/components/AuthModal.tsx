'use client';

import React, { useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { postApi, setToken, setUser } from '../lib/api';

interface AuthModalProps {
  lang: Language;
  onLoginSuccess: (user: any) => void;
  onError: (msg: string) => void;
  onResetDemo?: () => void;
}

// Reviewer shortcuts. Demo labels stay in English on purpose: they are tooling, not product copy.
const DEMO_ACCOUNTS = [
  { phone: '9000000001', name: 'Debasish Ghosh', note: 'Customer · mother’s refill is due' },
  { phone: '9000000002', name: 'Rina Sen', note: 'Customer · order with the pharmacist' },
  { phone: '9000000003', name: 'Arif Mondal', note: 'Customer · prescription sent back' },
  { phone: '9000000099', name: 'Anita Rao', note: 'Pharmacist · verification queue and dashboard' },
  { phone: '9000000081', name: 'Salt Lake store', note: 'Store staff' },
  { phone: '9000000082', name: 'Behala store', note: 'Store staff' },
  { phone: '9000000083', name: 'Howrah store', note: 'Store staff' },
];

const inputClass =
  'h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg text-slate-900 placeholder:text-slate-400 focus:border-teal-700';

export default function AuthModal({ lang, onLoginSuccess, onError, onResetDemo }: AuthModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const t = (k: string) => translate(k, lang);

  const signIn = async (phoneToUse: string, otpToUse: string, nameToUse: string) => {
    setLoading(true);
    try {
      const res = await postApi('login', {
        phone: phoneToUse.trim(),
        otp: otpToUse.trim(),
        name: nameToUse.trim(),
      });
      setToken(res.token);
      setUser(res.user);
      onLoginSuccess(res.user);
    } catch (err: any) {
      onError(err.message || t('try_again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(phone, otp, name);
        }}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
      >
        <div className="space-y-2">
          <label htmlFor="login-phone" className="block text-base font-semibold text-slate-800">
            {t('phone')}
          </label>
          <input
            id="login-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('login_phone_ph')}
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="login-otp" className="block text-base font-semibold text-slate-800">
            {t('otp')}
          </label>
          <input
            id="login-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            className={inputClass}
            required
          />
          <p className="text-base text-slate-500">{t('demo_otp_note')}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="login-name" className="block text-base font-semibold text-slate-800">
            {t('login_name')}
          </label>
          <input
            id="login-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 text-lg font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          <span>{loading ? t('login_working') : t('login_btn')}</span>
          {!loading && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
        </button>

        {loading && (
          <p role="status" className="text-center text-base text-slate-500">
            {t('cold_start')}
          </p>
        )}
      </form>

      <section aria-labelledby="demo-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="demo-heading" className="text-lg font-semibold text-slate-900">
              {t('demo_title')}
            </h2>
            <p className="text-base text-slate-500">{t('demo_note')}</p>
          </div>
          {onResetDemo && (
            <button
              type="button"
              onClick={onResetDemo}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t('demo_restart')}
            </button>
          )}
        </div>

        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.phone}>
              <button
                type="button"
                disabled={loading}
                onClick={() => signIn(a.phone, '123456', '')}
                className="flex min-h-[3.5rem] w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold text-slate-900">{a.name}</span>
                  <span className="block truncate text-base text-slate-500">{a.note}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
