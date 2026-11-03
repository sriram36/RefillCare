'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, BarChart3, CheckCircle, Sparkles, Shield, Clock } from 'lucide-react';
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
  // Only pharmacists have a 2-tab UI; customers & store staff go straight to their view
  const [activeTab, setActiveTab] = useState<'pharmacist' | 'dashboard'>('pharmacist');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'pharmacist') setActiveTab('pharmacist');
    showToast(`Welcome back, ${loggedInUser.name}`);
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
    showToast('Signed out successfully');
  };

  // Suppress SSR/hydration mismatch
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-medium">Loading RefillCare Network…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Sticky Header */}
      <Header user={user} lang={lang} onLangChange={handleLangChange} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ══════════════ UNAUTHENTICATED — Landing + Auth ══════════════ */}
        {!user ? (
          <div className="space-y-8 py-6">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                RefillCare • 46 Stores Across Kolkata &amp; Howrah
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Monthly Medicine Refills in 60 Seconds
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Rapid prescription verification by licensed pharmacists, bioequivalent generic savings under
                Pradhan Mantri Janaushadhi guidelines, and same-day delivery from your nearest neighborhood pharmacy.
              </p>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
                  <Shield className="w-3.5 h-3.5 text-teal-700" />
                  WBMC Registered Pharmacists
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-teal-700" />
                  &lt; 10 Min Verification SLA
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                  DPDP Act 2023 Encrypted
                </span>
              </div>
            </div>

            <AuthModal lang={lang} onLoginSuccess={handleLoginSuccess} onError={showToast} />
          </div>

        ) : (
          /* ══════════════ AUTHENTICATED — role-gated, no cross-role surfing ══════════════ */
          <div className="space-y-6">

            {/* ── CUSTOMER: direct full-screen view, zero tabs ── */}
            {user.role === 'customer' && (
              <CustomerView user={user} lang={lang} onToast={showToast} />
            )}

            {/* ── STORE STAFF: direct full-screen view, zero tabs ── */}
            {user.role === 'store' && (
              <StoreView user={user} lang={lang} onToast={showToast} />
            )}

            {/* ── PHARMACIST: 2-tab nav (Verification ↔ Central Operations) ── */}
            {user.role === 'pharmacist' && (
              <>
                {/* Pharmacist-only pill nav */}
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3">
                  <div className="flex items-center gap-1 sm:gap-2 bg-slate-200/60 p-1.5 rounded-2xl">
                    <button
                      onClick={() => setActiveTab('pharmacist')}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'pharmacist'
                          ? 'bg-white text-purple-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                      Pharmacist Verification
                    </button>

                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'dashboard'
                          ? 'bg-white text-teal-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-teal-700" />
                      Central Operations
                    </button>
                  </div>

                  {/* Identity / role badge */}
                  <div className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="font-bold text-slate-900">{user.name}</span>
                    <span className="mx-1.5 text-slate-300">•</span>
                    <span className="text-purple-700 font-semibold">Pharmacist</span>
                  </div>
                </div>

                {/* Tab content */}
                {activeTab === 'pharmacist' && (
                  <PharmacistView
                    user={user}
                    lang={lang}
                    onToast={showToast}
                    onOpenDashboard={() => setActiveTab('dashboard')}
                  />
                )}
                {activeTab === 'dashboard' && (
                  <DashboardView
                    user={user}
                    lang={lang}
                    onToast={showToast}
                    onBackToQueue={() => setActiveTab('pharmacist')}
                  />
                )}
              </>
            )}

          </div>
        )}

      </main>

      {/* Toast notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-slate-900/95 px-5 py-3.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md border border-slate-700/50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">RefillCare Healthcare</span>
            <span>• 46 Pharmacy Locations in Kolkata &amp; Howrah</span>
          </div>
          <p className="text-slate-400">
            Compliant with Drugs &amp; Cosmetics Act (Rule 65) &amp; DPDP Act 2023
          </p>
        </div>
      </footer>
    </div>
  );
}
