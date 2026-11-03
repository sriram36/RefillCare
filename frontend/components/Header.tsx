'use client';

import React from 'react';
import { Pill, LogOut, Globe, Shield, Sparkles } from 'lucide-react';
import { Language, translate } from '../lib/i18n';

interface HeaderProps {
  user: any;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onLogout: () => void;
}

export default function Header({ user, lang, onLangChange, onLogout }: HeaderProps) {
  const t = (k: string) => translate(k, lang);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'pharmacist':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'store':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'customer':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 py-3.5 shadow-xs backdrop-blur-md">
      {/* Brand logo & live network status */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-800 to-teal-600 text-white shadow-sm">
          <Pill className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight text-slate-900">
              {t('app_title')}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              46 Stores Live
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-400 font-medium">
            Kolkata & Howrah Chronic Pharmacy Network
          </p>
        </div>
      </div>

      {/* Right Actions: Language & User */}
      <div className="flex items-center gap-3">
        {/* Language Selector Pill */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors">
          <Globe className="h-3.5 w-3.5 text-teal-700" />
          <select
            value={lang}
            onChange={(e) => onLangChange(e.target.value as Language)}
            className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer"
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="bn">বাংলা (Bengali)</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </select>
        </div>

        {/* User Info & Sign out */}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`hidden sm:flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${getRoleBadge(user.role)}`}>
              <span className="capitalize">{user.name}</span>
              <span className="text-[10px] opacity-70">({user.role})</span>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('sign_out')}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
