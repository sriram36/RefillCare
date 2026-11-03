'use client';

import React, { useState, useEffect } from 'react';
import { 
  Pill, Upload, ShoppingCart, Plus, CheckCircle2, ShieldCheck, 
  Download, Search, AlertTriangle, Truck, Clock, UserPlus, 
  FileText, X, Check, ArrowRight, Sparkles, MapPin, CreditCard, ChevronRight
} from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { fetchApi, postApi, setUser } from '../lib/api';
import Timeline from './Timeline';
import LiveTrackingModal from './LiveTrackingModal';
import SubscriptionManager from './SubscriptionManager';

interface CustomerViewProps {
  user: any;
  lang: Language;
  onToast: (msg: string) => void;
}

export default function CustomerView({ user, lang, onToast }: CustomerViewProps) {
  const [refills, setRefills] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Cart
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);

  // Prescription Form
  const [uploadFor, setUploadFor] = useState('');
  const [paymentMode, setPaymentMode] = useState('cod');
  const [deliveryArea, setDeliveryArea] = useState('Park Street');
  const [demoChoice, setDemoChoice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [payingCode, setPayingCode] = useState<string | null>(null);

  // Add Family Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRelation, setNewProfileRelation] = useState('Self');
  const [newProfileIsMinor, setNewProfileIsMinor] = useState(false);
  const [newProfileConsent, setNewProfileConsent] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const t = (k: string) => translate(k, lang);

  const loadData = async () => {
    try {
      const [rf, os, pr, nt] = await Promise.all([
        fetchApi('refills'),
        fetchApi('orders'),
        fetchApi('profiles'),
        fetchApi('notes')
      ]);
      setRefills(rf);
      setOrders(os);
      setProfiles(pr);
      if (pr.length > 0 && !uploadFor) {
        setUploadFor(pr[0].name);
      }
      setNotes(nt);
    } catch (err: any) {
      onToast(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Live polling: refresh order status every 10 seconds
    const interval = setInterval(() => {
      fetchApi('orders')
        .then(os => setOrders(os))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Search handler
  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetchApi(`search?term=${encodeURIComponent(val)}`);
      setSearchResults(res);
    } catch (err: any) {
      onToast(err.message);
    }
  };

  const addToCart = (med: any) => {
    const existing = cart.find(c => c.id === med.id);
    if (existing) {
      setCart(cart.map(c => c.id === med.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { id: med.id, name: med.name, price: med.price, qty: 1 }]);
    }
    onToast(`Added ${med.name} to cart`);
  };

  const submitCartOrder = async () => {
    if (!cart.length) return;
    try {
      await postApi('cart', {
        for_name: uploadFor || user.name,
        payment: paymentMode,
        area: deliveryArea,
        lines: cart.map(c => ({ med_id: c.id, qty: c.qty }))
      });
      setCart([]);
      onToast('Order placed successfully! Routing to nearest pharmacy.');
      loadData();
    } catch (err: any) {
      onToast(err.message);
    }
  };

  // Reorder refill
  const handleReorder = async (refillId: number) => {
    try {
      await postApi(`refills/${refillId}/reorder`);
      onToast('Refill request sent to the pharmacist!');
      loadData();
    } catch (err: any) {
      onToast(err.message);
    }
  };

  // Upload prescription
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !demoChoice) {
      onToast('Please select a prescription photo or choose a demo prescription.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('for_name', uploadFor || user.name);
      fd.append('payment', paymentMode);
      fd.append('area', deliveryArea);
      fd.append('demo', demoChoice);
      if (file) {
        fd.append('file', file);
      }
      await fetchApi('orders', {
        method: 'POST',
        body: fd
      });
      onToast('Prescription submitted! Registered pharmacist assigned for review.');
      setFile(null);
      setDemoChoice('');
      loadData();
    } catch (err: any) {
      onToast(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Re-upload for held order
  const handleReupload = async (code: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput && !fileInput.files?.length) {
      fd.delete('file');
    }
    try {
      await fetchApi(`orders/${code}/reupload`, {
        method: 'POST',
        body: fd
      });
      onToast('New photo uploaded successfully! Queue updated.');
      loadData();
    } catch (err: any) {
      onToast(err.message);
    }
  };

  // DPDP Consent grant
  const grantConsent = async () => {
    try {
      const res = await postApi('consent');
      user.consent_at = res.consent_at;
      setUser(user);
      onToast('Health data processing consent recorded');
      loadData();
    } catch (err: any) {
      onToast(err.message);
    }
  };

  // Handle Save New Family Member Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) {
      onToast('Please enter full name');
      return;
    }
    if (newProfileIsMinor && !newProfileConsent) {
      onToast('Parent/Guardian consent is required for under-18 family members');
      return;
    }

    try {
      setSavingProfile(true);
      await postApi('profiles', {
        name: newProfileName.trim(),
        relation: newProfileRelation.trim(),
        is_minor: newProfileIsMinor,
        guardian_consent: newProfileConsent
      });
      onToast(`Added profile for ${newProfileName.trim()}`);
      setShowProfileModal(false);
      setNewProfileName('');
      setNewProfileRelation('Self');
      setNewProfileIsMinor(false);
      setNewProfileConsent(false);
      loadData();
    } catch (err: any) {
      onToast(err.message || 'Failed to create profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Online Payment via UPI (Razorpay)
  const handlePayOnline = async (orderCode: string) => {
    try {
      setPayingCode(orderCode);
      const res = await postApi(`orders/${orderCode}/pay`);
      // Simulate real-time Razorpay payment capture webhook
      await postApi('payments/webhook', {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_${Date.now()}`,
              order_id: res.razorpay_order_id,
              amount: res.amount,
              status: 'captured',
              notes: { order_code: orderCode }
            }
          }
        }
      });
      onToast(`Payment of ₹${res.amount_rupees || res.amount / 100} verified via UPI (Razorpay)`);
      loadData();
    } catch (err: any) {
      onToast(err.message || 'Payment initiation failed');
    } finally {
      setPayingCode(null);
    }
  };

  // Export DPDP Data
  const exportData = async () => {
    try {
      const data = await fetchApi('me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `refillcare-health-data-${user.phone}.json`;
      a.click();
      onToast('Personal health record download complete');
    } catch (err: any) {
      onToast(err.message);
    }
  };

  const dueRefills = refills.filter(r => r.due);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-medium text-slate-500">Loading your health records & prescriptions…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* DPDP Consent Banner */}
      {!user.consent_at && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
                <span>{t('consent_title')}</span>
                <span className="text-[11px] font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                  DPDP Act 2023 Required
                </span>
              </h3>
              <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-amber-900">
                {t('consent_body')}
              </p>
              <button
                onClick={grantConsent}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-amber-700 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>{t('consent_btn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Offer Pending Notification Bar */}
      {(() => {
        const pendingOffers = orders.filter(
          o => (o.items || []).some((it: any) => it.offer && it.consent == null)
        );
        if (!pendingOffers.length) return null;
        return (
          <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 shadow-xs flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-emerald-950 text-sm flex items-center gap-2 flex-wrap">
                <span>Generic Savings Offer Waiting for Your Response</span>
                <span className="text-[11px] font-semibold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                  {pendingOffers.length} order{pendingOffers.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                Your pharmacist found a cheaper bioequivalent generic alternative. Check your orders below to accept and save.
              </p>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('orders-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="shrink-0 text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
            >
              View
            </button>
          </div>
        );
      })()}

      {/* Hero 1-Tap Reorder Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-8 -bottom-8 w-56 h-56 rounded-full bg-white/5 blur-2xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
            46 Neighborhood Stores • Under 60-Minute Local Dispatch
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Need Your Monthly Medicine Refill?
          </h2>
          <p className="text-sm sm:text-base text-teal-100 leading-relaxed">
            Upload your prescription photo or choose a chronic prescription. A licensed pharmacist will review, verify generic savings, and route to the nearest store.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => {
                const el = document.getElementById('up');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-bold text-teal-900 shadow-md transition hover:bg-teal-50 hover:shadow-lg active:scale-95"
            >
              <Upload className="w-4 h-4 text-teal-700" />
              <span>Upload Prescription Photo</span>
            </button>
            
            <button
              onClick={() => {
                const el = document.getElementById('search-catalog');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-900/60 border border-teal-400/30 px-5 py-3 text-sm font-semibold text-white backdrop-blur-xs transition hover:bg-teal-900"
            >
              <Search className="w-4 h-4" />
              <span>Search Drug Catalog</span>
            </button>
          </div>
        </div>
      </div>

      {/* Running Low Section (Visual Supply Meters) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-700" />
              <span>{t('low')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Refill alerts calculated based on remaining daily dosages
            </p>
          </div>
          {dueRefills.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {dueRefills.length} due for refill
            </span>
          )}
        </div>

        {dueRefills.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dueRefills.map(r => {
              const days = r.days_left ?? 0;
              const isUrgent = days <= 5;
              const isWarning = days <= 10;
              const progressPct = Math.max(5, Math.min(100, (days / 30) * 100));

              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                          <Pill className="w-4 h-4" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">{r.name}</h4>
                      </div>
                      <div className="text-xs text-slate-500 pl-8">
                        {t('for_lbl')} <strong className="text-slate-800">{r.for_name}</strong> • {r.per_day} tab/day
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      isUrgent
                        ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                        : isWarning
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {days} days remaining
                    </span>
                  </div>

                  {/* Supply Progress Meter */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500">
                      <span>Supply Remaining</span>
                      <span className="font-semibold text-slate-700">{days} of 30 days left</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isUrgent ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">
                      Last filled: {r.last_filled || 'Prior month'}
                    </span>
                    <button
                      onClick={() => handleReorder(r.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800 active:scale-95"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Reorder 30-Day Pack</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-50 shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">All supplies are topped up</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('no_low')} We'll alert you 10 days before any medicine runs low.</p>
            </div>
          </div>
        )}
      </div>

      {/* Prescription Upload Form */}
      <div id="up" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-teal-700" />
              <span>{t('upload')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload prescription image (PNG/JPEG) or try a sample prescription
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 transition active:scale-95 self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Family Member</span>
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-6">
          {/* Controls Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* For Person */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Prescription For *
              </label>
              <select
                value={uploadFor}
                onChange={(e) => setUploadFor(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-2xs focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name} {p.relation ? `(${p.relation})` : ''} {p.is_minor ? '• Minor' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <span>Delivery Area *</span>
              </label>
              <select
                value={deliveryArea}
                onChange={(e) => setDeliveryArea(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-2xs focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none"
              >
                <option value="Park Street">Park Street, Central Kolkata</option>
                <option value="Salt Lake">Salt Lake (Sector I - V)</option>
                <option value="Behala">Behala, South Kolkata</option>
                <option value="Howrah">Howrah Central / Station</option>
              </select>
            </div>

            {/* Payment */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                <span>Payment Mode *</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-2xs focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none"
              >
                <option value="cod">{t('cod')}</option>
                <option value="upi_test">{t('upi_test')}</option>
              </select>
            </div>
          </div>

          {/* Quick Demo Selector Chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Or Choose a Verified Demo Prescription
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'clean', label: 'Clear Printed (Valid)', color: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
                { id: 'handwritten', label: 'Handwritten Rx', color: 'border-teal-300 bg-teal-50 text-teal-800' },
                { id: 'blurry', label: 'Blurry Photo (Hold)', color: 'border-amber-300 bg-amber-50 text-amber-800' },
                { id: 'schedx', label: 'Schedule X (Prohibited)', color: 'border-rose-300 bg-rose-50 text-rose-800' },
                { id: 'h1', label: 'Controlled (H1 Register)', color: 'border-purple-300 bg-purple-50 text-purple-800' },
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setDemoChoice(demoChoice === d.id ? '' : d.id);
                    setFile(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    demoChoice === d.id
                      ? `${d.color} ring-2 ring-teal-600 shadow-xs`
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {d.label} {demoChoice === d.id ? '✓' : ''}
                </button>
              ))}
              {demoChoice && (
                <button
                  type="button"
                  onClick={() => setDemoChoice('')}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear demo
                </button>
              )}
            </div>
          </div>

          {/* Drag & Drop File Upload Area */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Prescription Photo File
            </label>
            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-teal-600 transition-colors bg-slate-50/50">
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setDemoChoice('');
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-3 bg-teal-50 text-teal-700 rounded-full">
                  <FileText className="w-6 h-6" />
                </div>
                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5 justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{file.name}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB • Click or drop another image to replace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-700">
                      Drop prescription photo here, or <span className="text-teal-700 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Supports JPG, PNG up to 10MB • AES-128 Encrypted at rest
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('rx_safety_note')}</span>
            </span>

            <button
              type="submit"
              disabled={uploading || (!file && !demoChoice)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-800 disabled:opacity-50 active:scale-95"
            >
              <Upload className="h-4 w-4" />
              <span>{uploading ? 'Processing & Encrypting…' : t('send')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Search Drug Catalog & Add to Cart */}
      <div id="search-catalog" className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-teal-700" />
            <span>{t('search_title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Check stock across 46 stores and view generic bioequivalent alternatives
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            id="sq"
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('search_ph')}
            className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none shadow-2xs transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {searchResults.map(m => (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.schedule === 'OTC'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : m.schedule === 'H1'
                        ? 'bg-purple-50 text-purple-800 border border-purple-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {m.schedule}
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-teal-800">
                    ₹{m.price}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  {m.rule === 'ok' ? (
                    <button
                      onClick={() => addToCart(m)}
                      className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800 active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to Cart</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500">
                      {m.rule === 'rx' ? 'Requires Rx Verification' : 'Restricted (In-store only)'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Cart Drawer / Summary */}
        {cart.length > 0 && (
          <div className="rounded-2xl border border-teal-300 bg-teal-50/70 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-teal-200/60 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-teal-800" />
                <h4 className="font-bold text-slate-900">{t('cart_title')}</h4>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-200 text-teal-900">
                  {cart.reduce((sum, item) => sum + item.qty, 0)} items
                </span>
              </div>
              <button
                onClick={() => setCart([])}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                {t('clear_cart')}
              </button>
            </div>

            <div className="space-y-2 text-sm">
              {cart.map(c => (
                <div key={c.id} className="flex justify-between items-center bg-white/70 px-3 py-2 rounded-xl">
                  <span className="font-medium text-slate-800">{c.name} × {c.qty}</span>
                  <span className="font-bold text-teal-900">₹{c.price * c.qty}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Total Order Amount</div>
                <div className="text-lg font-extrabold text-teal-900">
                  ₹{cart.reduce((sum, item) => sum + (item.price * item.qty), 0)}
                </div>
              </div>

              <button
                onClick={submitCartOrder}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-2.5 text-xs font-bold text-white shadow transition hover:bg-teal-800 active:scale-95"
              >
                <span>{t('place_order')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chronic Auto-Refill Subscriptions Engine */}
      <SubscriptionManager user={user} lang={lang} onToast={onToast} />

      {/* Orders List & Active Timeline Tracking */}
      <div id="orders-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-700" />
              <span>{t('orders')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status tracking with pharmacist review stages
            </p>
          </div>
          {orders.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {orders.length} orders recorded
            </span>
          )}
        </div>

        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map(o => (
              <div
                key={o.code}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900">#{o.code}</span>
                    <span className="text-xs text-slate-400">• For {o.for_name}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    o.status === 'dispatched'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : o.status === 'on_hold'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-teal-50 text-teal-800 border-teal-200'
                  }`}>
                    {o.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* Progress Timeline */}
                <Timeline status={o.status} lang={lang} />

                {/* Meta details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500 pt-1">
                  <div>
                    <span className="text-slate-400">Store:</span> <strong>{o.store || 'Routing to nearest…'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Payment:</span>{' '}
                    <strong>{o.payment === 'upi_test' ? 'Paid via UPI' : 'Cash on Delivery (COD)'}</strong>
                  </div>
                  {o.delivery_partner && (
                    <div className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" />
                      <span>Partner: {o.delivery_partner}</span>
                    </div>
                  )}
                </div>

                {/* Online Payment & Live GPS Delivery Tracking Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 text-xs">
                  {o.paid !== 1 && o.payment !== 'upi_test' && o.status !== 'rejected' && o.status !== 'on_hold' && (
                    <button
                      onClick={() => handlePayOnline(o.code)}
                      disabled={payingCode === o.code}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-50 border border-teal-300 text-teal-900 font-bold hover:bg-teal-100 transition shadow-2xs"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-teal-700" />
                      <span>{payingCode === o.code ? 'Processing UPI…' : 'Pay Online via UPI (Razorpay)'}</span>
                    </button>
                  )}
                  {o.status === 'dispatched' && (
                    <button
                      onClick={() => setTrackingOrder(o)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold shadow-xs transition active:scale-95 ml-auto"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Track Live Delivery GPS</span>
                    </button>
                  )}
                </div>

                {o.total_savings > 0 && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Total Generic Savings Achieved: ₹{o.total_savings}</span>
                  </div>
                )}

                {/* If on hold: Re-upload form */}
                {o.status === 'on_hold' && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Pharmacist Note: {o.note || 'Prescription image is blurry. Please upload a clear photo.'}</span>
                    </div>
                    <form onSubmit={(e) => handleReupload(o.code, e)} className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        name="file"
                        accept="image/png,image/jpeg"
                        className="text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-200/60 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-amber-900"
                      />
                      <select
                        name="demo"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        <option value="">Upload new file above</option>
                        <option value="clean">Use clear printed demo</option>
                        <option value="handwritten">Use handwritten demo</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-800"
                      >
                        {t('upload_new')}
                      </button>
                    </form>
                  </div>
                )}

                {/* Ordered Items List */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  {o.items?.map((item: any) => (
                    <div key={item.id} className="text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {item.name} × {item.qty}
                          {item.status === 'rejected' && (
                            <span className="ml-2 font-bold text-rose-600">({item.reason})</span>
                          )}
                        </span>
                        {item.savings > 0 && (
                          <span className="font-bold text-emerald-700">Saved ₹{item.savings}</span>
                        )}
                      </div>

                      {/* Generic Alternative Option Callout */}
                      {item.offer_med && item.consent == null && (
                        <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                              <span>Cheaper Generic Alternative Offered</span>
                            </div>
                            <p className="text-[11px] text-teal-800">
                              Switch to bioequivalent <strong>{item.offer_med.name}</strong> at <strong>₹{item.offer_med.price}</strong> (Save ₹{item.price - item.offer_med.price})
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                await postApi(`items/${item.id}/consent`, { accept: true });
                                onToast('Generic alternative accepted! Savings applied.');
                                loadData();
                              }}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white text-xs hover:bg-emerald-700 shadow-xs"
                            >
                              Accept (Save ₹{item.price - item.offer_med.price})
                            </button>
                            <button
                              onClick={async () => {
                                await postApi(`items/${item.id}/consent`, { accept: false });
                                onToast('Prescribed brand retained');
                                loadData();
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 text-xs hover:bg-slate-50"
                            >
                              Keep Original
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-xs text-slate-500">
            {t('no_orders')}
          </div>
        )}
      </div>

      {/* DPDP Privacy & Data Export Footer */}
      <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
          <span>Your personal health data is processed in compliance with DPDP Act 2023.</span>
        </div>
        <button
          onClick={exportData}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95"
        >
          <Download className="h-4 w-4" />
          <span>{t('export_data')}</span>
        </button>
      </div>

      {/* Add Family Member Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-teal-900">
                <UserPlus className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-base text-slate-900">Add Family Member Profile</h3>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rina Sen"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Relationship</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Self', 'Mother', 'Father', 'Spouse', 'Child', 'Grandparent'].map(rel => (
                    <button
                      key={rel}
                      type="button"
                      onClick={() => setNewProfileRelation(rel)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        newProfileRelation === rel
                          ? 'border-teal-700 bg-teal-50 text-teal-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minor Checkbox */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProfileIsMinor}
                    onChange={(e) => setNewProfileIsMinor(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-700 focus:ring-teal-600"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    This person is under 18 years of age (Minor)
                  </span>
                </label>

                {newProfileIsMinor && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      <strong>DPDP Act Section 9:</strong> Processing personal and prescription health data of a minor requires verifiable consent from their parent or lawful guardian.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={newProfileConsent}
                        onChange={(e) => setNewProfileConsent(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-teal-700 focus:ring-teal-600"
                        required={newProfileIsMinor}
                      />
                      <span className="text-[11px] font-semibold text-amber-950">
                        I declare that I am the parent or lawful guardian and consent to managing prescriptions for this minor.
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs transition-colors"
                >
                  {savingProfile ? 'Saving…' : 'Save Family Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
