'use client';

import React from 'react';
import Link from 'next/link';
import { Pill, LogOut } from 'lucide-react';
import { Language, translate } from '../lib/i18n';

interface HeaderProps {
  user: any;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onLogout: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  pharmacist: 'Pharmacist',
  store: 'Store',
};

export default function Header({ user, lang, onLangChange, onLogout }: HeaderProps) {
  const t = (k: string) => translate(k, lang);
  const firstName = user?.name ? String(user.name).split(' ')[0] : '';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={t('app_title')}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
            <Pill className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="whitespace-nowrap text-base font-bold text-slate-900 sm:text-lg">{t('app_title')}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="lang">
            Language
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => onLangChange(e.target.value as Language)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-1.5 text-base font-medium text-slate-800"
          >
            <option value="en">English</option>
            <option value="bn">বাংলা</option>
            <option value="hi">हिन्दी</option>
          </select>

          {user && (
            <>
              <span className="hidden text-base text-slate-600 sm:inline">
                {firstName}
                {ROLE_LABEL[user.role] ? ` · ${ROLE_LABEL[user.role]}` : ''}
              </span>
              <button
                onClick={onLogout}
                className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-base font-medium text-slate-700 hover:bg-slate-50"
                aria-label={t('sign_out')}
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('sign_out')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
