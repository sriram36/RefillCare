'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { getUser, setUser as setStoredUser, setToken, postApi } from '../lib/api';
import Header from '../components/Header';
import AuthModal from '../components/AuthModal';
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

      <main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 ${isStaff ? 'max-w-7xl' : 'max-w-2xl'}`}>
        {!user ? (
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">{t('login_title')}</h1>
              <p className="text-lg text-slate-600">{t('login_sub')}</p>
            </div>
            <AuthModal lang={lang} onLoginSuccess={handleLoginSuccess} onError={showToast} onResetDemo={handleResetDemo} />
          </div>
        ) : (
          <>
            {user.role === 'customer' && <CustomerView user={user} lang={lang} onToast={showToast} onErased={handleLogout} />}

            {user.role === 'store' && <StoreView user={user} onToast={showToast} />}

            {user.role === 'pharmacist' && (
              <div className="space-y-6">
                <div role="tablist" className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
                  {(
                    [
                      ['pharmacist', 'Verification queue'],
                      ['dashboard', 'All stores'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={activeTab === key}
                      onClick={() => setActiveTab(key)}
                      className={`h-11 rounded-lg px-4 text-base font-semibold ${
                        activeTab === key ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeTab === 'pharmacist' && (
                  <PharmacistView onToast={showToast} />
                )}
                {activeTab === 'dashboard' && (
                  <DashboardView onToast={showToast} onBackToQueue={() => setActiveTab('pharmacist')} />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {toastMsg && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-5 py-4 text-base font-medium text-white sm:bottom-6"
        >
          <CheckCircle className="h-5 w-5 shrink-0 text-teal-200" aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-base text-slate-500">
        <Link href="/compliance" className="font-medium text-slate-600 underline-offset-4 hover:underline">
          {t('legal_link')}
        </Link>
      </footer>
    </div>
  );
}
