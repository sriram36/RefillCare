'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, Lock, ShieldCheck, Truck } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { getUser, setUser as setStoredUser, setToken, postApi } from '../lib/api';
import Header from '../components/Header';
import AuthModal from '../components/AuthModal';
import { StripArt } from '../components/Brand';
import CustomerView from '../components/CustomerView';
import PharmacistView from '../components/PharmacistView';
import StoreView from '../components/StoreView';
import DashboardView from '../components/DashboardView';

export default function Home() {
  const [user, setUser] = useState<any | null>(null);
  const [lang, setLang] = useState<Language>('en');
  // Only pharmacists have two tabs; customers and store staff go straight to their screen
  const [activeTab, setActiveTab] = useState<'pharmacist' | 'dashboard'>('pharmacist');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const t = (k: string) => translate(k, lang);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    if (u) {
      setUser(u);
      if (u.role === 'pharmacist') setActiveTab('pharmacist');
    }
    const savedLang = localStorage.getItem('lang') as Language;
    if (savedLang && ['en', 'bn', 'hi'].includes(savedLang)) {
      setLang(savedLang);
    }
  }, []);

  // keep the page language attribute right for screen readers and fonts
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Reminders are sent in the customer's language, so the server needs to know it
  const rememberLanguage = (l: Language) => {
    postApi('me/language', { lang: l }).catch(() => {});
  };

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    if (user) rememberLanguage(newLang);
  };

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'pharmacist') setActiveTab('pharmacist');
    rememberLanguage(lang);
  };

  const handleLogout = async () => {
    try {
      await postApi('logout');
    } catch {
      // Ignore network errors on logout
    }
    setToken('');
    setStoredUser(null);
    setUser(null);
    setActiveTab('pharmacist');
  };

  const handleResetDemo = async () => {
    try {
      await postApi('demo/reset');
      showToast('Demo data restored.');
      window.location.reload();
    } catch (err: any) {
      showToast(err.message || 'Could not restart the demo.');
    }
  };

  // Avoid a server/client mismatch flash
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" role="status" aria-label="Loading" />
      </div>
    );
  }

  const isStaff = user && user.role !== 'customer';

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-slate-900">
      <Header user={user} lang={lang} onLangChange={handleLangChange} onLogout={handleLogout} />

      <main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 ${isStaff ? 'max-w-7xl' : 'max-w-5xl'}`}>
        {!user ? (
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_26rem] lg:gap-14">
            <section className="space-y-6 lg:pt-6">
              <h1 className="max-w-xl text-3xl text-slate-900 sm:text-4xl">{t('login_title')}</h1>
              <p className="max-w-md text-base text-slate-600">{t('login_sub')}</p>

              <ul className="space-y-3">
                {[
                  [ShieldCheck, 'signin_b1'],
                  [Truck, 'signin_b2'],
                  [Lock, 'signin_b3'],
                ].map(([Icon, key]: any) => (
                  <li key={key} className="flex items-center gap-3 text-base text-slate-800">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {t(key)}
                  </li>
                ))}
              </ul>

              <div className="hidden rounded-[2rem] bg-teal-100/70 p-6 lg:block">
                <StripArt className="mx-auto w-full max-w-sm" />
              </div>
            </section>

            <AuthModal lang={lang} onLoginSuccess={handleLoginSuccess} onError={showToast} onResetDemo={handleResetDemo} />
          </div>
        ) : (
          <>
            {user.role === 'customer' && <CustomerView user={user} lang={lang} onToast={showToast} onErased={handleLogout} />}

            {user.role === 'store' && <StoreView user={user} lang={lang} onToast={showToast} />}

            {user.role === 'pharmacist' && (
              <div className="space-y-6">
                <div role="tablist" className="inline-flex rounded-full bg-stone-100 p-1">
                  {(
                    [
                      ['pharmacist', t('ph_tab_queue')],
                      ['dashboard', t('db_tab_all')],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={activeTab === key}
                      onClick={() => setActiveTab(key)}
                      className={`h-10 rounded-full px-5 text-base font-semibold transition-colors ${
                        activeTab === key ? 'bg-teal-700 text-white' : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeTab === 'pharmacist' && <PharmacistView lang={lang} onToast={showToast} />}
                {activeTab === 'dashboard' && <DashboardView lang={lang} onToast={showToast} onBackToQueue={() => setActiveTab('pharmacist')} />}
              </div>
            )}
          </>
        )}
      </main>

      {toastMsg && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-base font-medium text-white shadow-soft sm:bottom-6"
        >
          <CheckCircle className="h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}

      <footer className="border-t border-stone-200 py-5 text-center text-sm text-slate-500">
        <Link href="/compliance" className="font-medium underline-offset-4 hover:text-slate-700 hover:underline">
          {t('legal_link')}
        </Link>
      </footer>
    </div>
  );
}
