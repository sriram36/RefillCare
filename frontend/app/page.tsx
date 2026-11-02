'use client';

import React, { useState, useEffect } from 'react';
import { Pill, Users, ShieldCheck, Store, BarChart3, Bell, CheckCircle } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'customer' | 'pharmacist' | 'store' | 'dashboard'>('customer');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    if (u) {
      setUser(u);
      if (u.role === 'pharmacist') setActiveTab('pharmacist');
      else if (u.role === 'store') setActiveTab('store');
      else setActiveTab('customer');
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
    }, 4000);
  };

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'pharmacist') setActiveTab('pharmacist');
    else if (loggedInUser.role === 'store') setActiveTab('store');
    else setActiveTab('customer');
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
    setActiveTab('customer');
    showToast('Signed out successfully');
  };

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">
        Loading RefillCare...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Sticky Header */}
      <Header
        user={user}
        lang={lang}
        onLangChange={handleLangChange}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* If user is not authenticated: Show Sign In & Quick Demo Selectors */}
        {!user ? (
          <div className="space-y-8 py-6">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
                <Pill className="w-3.5 h-3.5" />
                RefillCare • 46 Stores Across Kolkata & Howrah
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Monthly Medicine Refills in 60 Seconds
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Same-day delivery from your nearest neighborhood pharmacy. Safe prescription verification by registered pharmacists, automated generic savings, and timely refill reminders.
              </p>
            </div>

            <AuthModal
              lang={lang}
              onLoginSuccess={handleLoginSuccess}
              onError={showToast}
            />
          </div>
        ) : (
          /* When authenticated: Navigation Tabs & Role Views */
          <div className="space-y-6">
            
            {/* Navigation Tab Bar for Role Switching & Exploration */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
              <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('customer')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'customer'
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Customer Portal
                </button>

                <button
                  onClick={() => setActiveTab('pharmacist')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'pharmacist'
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Pharmacist Verification
                </button>

                <button
                  onClick={() => setActiveTab('store')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'store'
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Store Fulfillment
                </button>

                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Central Dashboard
                </button>
              </div>

              {/* Status Pill indicating Active Role */}
              <div className="text-xs text-slate-500">
                Logged in as <strong className="text-slate-800">{user.name}</strong> ({user.role})
              </div>
            </div>

            {/* Active Tab View */}
            {activeTab === 'customer' && (
              <CustomerView user={user} lang={lang} onToast={showToast} />
            )}

            {activeTab === 'pharmacist' && (
              <PharmacistView
                user={user}
                lang={lang}
                onToast={showToast}
                onOpenDashboard={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'store' && (
              <StoreView user={user} lang={lang} onToast={showToast} />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                user={user}
                lang={lang}
                onToast={showToast}
                onBackToQueue={() => setActiveTab('pharmacist')}
              />
            )}

          </div>
        )}

      </main>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 RefillCare • Kolkata & Howrah Pharmacy Network (46 Stores)</p>
          <p className="text-slate-400">Compliant with Drugs & Cosmetics Act & DPDP Act 2023</p>
        </div>
      </footer>
    </div>
  );
}
