'use client';

import React, { useState } from 'react';
import { ArrowRight, RotateCcw, Stethoscope, Store, User } from 'lucide-react';
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
  { phone: '9000000001', name: 'Debasish Ghosh', note: 'Refill is due', kind: 'customer' },
  { phone: '9000000002', name: 'Rina Sen', note: 'Order being checked', kind: 'customer' },
  { phone: '9000000003', name: 'Arif Mondal', note: 'Photo sent back', kind: 'customer' },
  { phone: '9000000099', name: 'Anita Rao', note: 'Pharmacist', kind: 'pharmacist' },
  { phone: '9000000081', name: 'Salt Lake store', note: 'Store staff', kind: 'store' },
  { phone: '9000000082', name: 'Behala store', note: 'Store staff', kind: 'store' },
  { phone: '9000000083', name: 'Howrah store', note: 'Store staff', kind: 'store' },
];

const ICONS = { customer: User, pharmacist: Stethoscope, store: Store };

const inputClass =
  'h-12 w-full rounded-xl border border-stone-300 bg-cream px-4 text-slate-900 placeholder:text-slate-400 focus:border-teal-600';

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
    <div className="space-y-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(phone, otp, name);
        }}
        className="space-y-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6"
      >
        <div className="space-y-1.5">
          <label htmlFor="login-phone" className="block text-sm font-semibold text-slate-800">
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

        <div className="space-y-1.5">
          <label htmlFor="login-otp" className="block text-sm font-semibold text-slate-800">
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
        </div>

        <div className="space-y-1.5">
          <label htmlFor="login-name" className="block text-sm font-semibold text-slate-800">
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
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
        >
          <span>{loading ? t('login_working') : t('login_btn')}</span>
          {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </button>

        {loading && (
          <p role="status" className="text-center text-sm text-slate-500">
            {t('cold_start')}
          </p>
        )}
      </form>

      <section aria-labelledby="demo-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="demo-heading" className="text-lg text-slate-900">
              {t('demo_title')}
            </h2>
            <p className="text-sm text-slate-500">{t('demo_note')}</p>
          </div>
          {onResetDemo && (
            <button
              type="button"
              onClick={onResetDemo}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-stone-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('demo_restart')}
            </button>
          )}
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((a) => {
            const Icon = ICONS[a.kind as keyof typeof ICONS];
            return (
              <li key={a.phone}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => signIn(a.phone, '123456', '')}
                  className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-left transition-colors hover:border-teal-500 hover:bg-teal-50 disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold text-slate-900">{a.name}</span>
                    <span className="block truncate text-sm text-slate-500">{a.note}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
