'use client';

import React from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { Logo } from './Brand';

interface HeaderProps {
  user: any;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onLogout: () => void;
}

// One tap to switch, and each language written in its own script
const LANGS: { code: Language; short: string; name: string }[] = [
  { code: 'en', short: 'EN', name: 'English' },
  { code: 'bn', short: 'বাং', name: 'বাংলা' },
  { code: 'hi', short: 'हिं', name: 'हिन्दी' },
];

const ROLE_LABEL: Record<string, string> = {
  pharmacist: 'Pharmacist',
};

export default function Header({ user, lang, onLangChange, onLogout }: HeaderProps) {
  const t = (k: string) => translate(k, lang);
  // customers by first name; staff by full name, without a trailing "(pharmacist)"
  const shownName = !user?.name
    ? ''
    : user.role === 'customer'
    ? String(user.name).split(' ')[0]
    : String(user.name).replace(/\s*\(.*?\)\s*$/, '');
  // staff screens are wider; customers get the narrower, calmer column
  const width = user && user.role !== 'customer' ? 'max-w-7xl' : 'max-w-5xl';

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
      <div className={`mx-auto flex ${width} items-center justify-between gap-2 px-4 py-2.5 sm:px-6`}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={t('app_title')}>
          <Logo className="h-9 w-9 shrink-0" />
          <span className={`font-serif text-lg text-slate-900 ${user ? 'hidden sm:inline' : ''}`}>{t('app_title')}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <div role="group" aria-label="Language" className="inline-flex rounded-full bg-stone-100 p-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                data-lang={l.code}
                aria-pressed={lang === l.code}
                aria-label={l.name}
                title={l.name}
                onClick={() => onLangChange(l.code)}
                className={`h-8 min-w-[2.5rem] rounded-full px-2.5 text-sm font-semibold transition-colors ${
                  lang === l.code ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {l.short}
              </button>
            ))}
          </div>

          {user && (
            <>
              <span className="hidden text-sm text-slate-600 md:inline">
                {shownName}
                {ROLE_LABEL[user.role] ? ` · ${ROLE_LABEL[user.role]}` : ''}
              </span>
              <button
                onClick={onLogout}
                className="flex h-10 items-center gap-2 rounded-full border border-stone-300 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
                aria-label={t('sign_out')}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('sign_out')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
