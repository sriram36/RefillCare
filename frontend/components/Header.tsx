'use client';

import React from 'react';
import { Pill, LogOut, Globe } from 'lucide-react';
import { Language, translate } from '../lib/i18n';

interface HeaderProps {
  user: any;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onLogout: () => void;
}

export default function Header({ user, lang, onLangChange, onLogout }: HeaderProps) {
  const t = (k: string) => translate(k, lang);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-3.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
          <Pill className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {t('app_title')}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Language Selector */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-800 dark:bg-slate-800">
          <Globe className="h-4 w-4 text-slate-500" />
          <select
            value={lang}
            onChange={(e) => onLangChange(e.target.value as Language)}
            className="bg-transparent font-medium text-slate-700 outline-none dark:text-slate-200"
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="bn">বাংলা</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>

        {/* User Info & Sign out */}
        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 sm:inline-block dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300">
              {user.name} ({user.role})
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('sign_out')}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
