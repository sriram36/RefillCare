'use client';

import React, { useState, useEffect } from 'react';
import { Pill, Upload, ShoppingCart, Plus, CheckCircle2, ShieldCheck, Download, Search, AlertTriangle, Truck } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { fetchApi, postApi, setUser } from '../lib/api';
import Timeline from './Timeline';

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
    // Poll orders every 10 seconds to update live timeline
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
  };

  const submitCartOrder = async () => {
    if (!cart.length) return;
    try {
      await postApi('cart', {
        for_name: uploadFor,
        payment: paymentMode,
        area: deliveryArea,
        lines: cart.map(c => ({ med_id: c.id, qty: c.qty }))
      });
      setCart([]);
      onToast('Order placed successfully!');
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
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('for_name', uploadFor);
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
      onToast('Prescription sent for pharmacist check!');
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
      onToast('New photo uploaded successfully!');
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
      onToast('Consent recorded');
      loadData();
    } catch (err: any) {
      onToast(err.message);
    }
  };

  // Add Family Profile
  const handleAddProfile = () => {
    const name = window.prompt('Full Name:');
    if (!name || !name.trim()) return;
    const relation = window.prompt('Relation (e.g. Mother, Father, Child, Self):', 'Family') || 'Family';
    const isMinor = window.confirm('Is this person under 18 years old?');
    let guardianConsent = false;
    if (isMinor) {
      guardianConsent = window.confirm('As parent/guardian, do you consent to processing health and prescription data for this minor under DPDP Act?');
      if (!guardianConsent) {
        alert('Guardian consent is required to add an under-18 family profile.');
        return;
      }
    }
    postApi('profiles', {
      name: name.trim(),
      relation: relation.trim(),
      is_minor: isMinor,
      guardian_consent: guardianConsent
    }).then(() => {
      onToast('Family member added');
      loadData();
    }).catch(err => onToast(err.message));
  };

  // Export DPDP Data
  const exportData = async () => {
    try {
      const data = await fetchApi('me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `refillcare-data-${user.phone}.json`;
      a.click();
      onToast('Data export downloaded');
    } catch (err: any) {
      onToast(err.message);
    }
  };

  const dueRefills = refills.filter(r => r.due);

  if (loading) {
    return <div className="py-20 text-center font-medium text-slate-500">Loading your health records…</div>;
  }

  return (
    <div className="space-y-8">
      {/* DPDP Consent Banner */}
      {!user.consent_at && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-6 dark:border-amber-700/60 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-200">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <span>{t('consent_title')}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-amber-800 dark:text-amber-300">
            {t('consent_body')}
          </p>
          <button
            onClick={grantConsent}
            className="mt-4 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            {t('consent_btn')}
          </button>
        </div>
      )}

      {/* Hero Reorder Button */}
      <button
        onClick={() => {
          const el = document.getElementById('up');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-teal-700 via-teal-600 to-teal-800 py-5 text-xl font-bold text-white shadow-lg transition hover:scale-[1.008] hover:shadow-xl focus:ring-4 focus:ring-teal-200 active:scale-100"
      >
        <Pill className="h-6 w-6" />
        <span>{t('reorder')}</span>
      </button>

      {/* Running Low Section */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {t('low')}
        </h2>
        {dueRefills.length > 0 ? (
          <div className="mt-3 space-y-3">
            {dueRefills.map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <b className="text-base font-bold text-slate-900 dark:text-white">{r.name}</b>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('for_lbl')} {r.for_name}. About {r.days_left} days left.
                  </div>
                </div>
                <button
                  onClick={() => handleReorder(r.id)}
                  className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-teal-800"
                >
                  Reorder
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('no_low')}</p>
        )}
      </div>

      {/* Search & Cart Section */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {t('search_title')}
        </h2>
        <div className="relative mt-2">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            id="sq"
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('search_ph')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none shadow-sm transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">{m.name}</span>
                  <span className="ml-2 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {m.schedule}
                  </span>
                  <span className="ml-2 font-bold text-teal-700 dark:text-teal-400">₹{m.price}</span>
                </div>
                {m.rule === 'ok' ? (
                  <button
                    onClick={() => addToCart(m)}
                    className="flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">
                    {m.rule === 'rx' ? 'Needs a prescription' : 'Not sold online'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Cart Box */}
        {cart.length > 0 && (
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900/60 dark:bg-teal-950/30">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">{t('cart_title')}</span>
              <button
                onClick={() => setCart([])}
                className="text-xs text-red-600 hover:underline"
              >
                {t('clear_cart')}
              </button>
            </div>
            <div className="mt-2 space-y-1.5 text-sm">
              {cart.map(c => (
                <div key={c.id} className="flex justify-between">
                  <span>{c.name} × {c.qty}</span>
                  <span className="font-bold">₹{c.price * c.qty}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={submitCartOrder}
                className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-teal-800"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>{t('place_order')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prescription Upload Form */}
      <div id="up" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mt-0 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {t('upload')}
        </h2>
        <form onSubmit={handleUpload} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">For Person</label>
              <div className="mt-1 flex gap-1.5">
                <select
                  name="for_name"
                  value={uploadFor}
                  onChange={(e) => setUploadFor(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddProfile}
                  title={t('add_person')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Payment</label>
              <select
                name="payment"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="cod">{t('cod')}</option>
                <option value="upi_test">{t('upi_test')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Area</label>
              <select
                name="area"
                value={deliveryArea}
                onChange={(e) => setDeliveryArea(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Park Street">Park Street</option>
                <option value="Salt Lake">Salt Lake</option>
                <option value="Behala">Behala</option>
                <option value="Howrah">Howrah</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Or Demo Prescription</label>
              <select
                name="demo"
                value={demoChoice}
                onChange={(e) => setDemoChoice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">No demo</option>
                <option value="clean">Demo: clear printed</option>
                <option value="handwritten">Demo: handwritten</option>
                <option value="blurry">Demo: blurry</option>
                <option value="schedx">Demo: restricted item</option>
                <option value="h1">Demo: controlled (H1)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Upload Photo</label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-300"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('rx_safety_note')}
            </span>
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-teal-800 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              <span>{uploading ? 'Sending…' : t('send')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Messages / Notifications */}
      {notes.length > 0 && (
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {t('messages')}
          </h2>
          <div className="mt-3 space-y-2">
            {notes.map((n, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                {n.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders List */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {t('orders')}
        </h2>
        {orders.length > 0 ? (
          <div className="mt-3 space-y-4">
            {orders.map(o => (
              <div
                key={o.code}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{o.code}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {o.status}
                  </span>
                </div>

                <Timeline status={o.status} lang={lang} />

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('for_lbl')} {o.for_name}
                  {o.store && ` · ${t('store_lbl')}: ${o.store}`}
                  {o.payment === 'upi_test'
                    ? ` · ${t('paid_upi')}${o.payment_ref ? ` (${o.payment_ref})` : ''}`
                    : ` · ${t('pay_delivery')}`
                  }
                </div>

                {o.delivery_partner && o.status === 'dispatched' && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Truck className="h-4 w-4" />
                    <span>{t('delivery_by')}: {o.delivery_partner}</span>
                  </div>
                )}

                {o.total_savings > 0 && (
                  <div className="mt-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      🎉 {t('saved_lbl')} ₹{o.total_savings}
                    </span>
                  </div>
                )}

                {o.note && (
                  <div className={`mt-2 text-xs font-medium ${o.status === 'on_hold' ? 'text-amber-600' : 'text-slate-500'}`}>
                    {o.note}
                  </div>
                )}

                {/* Re-upload on hold */}
                {o.status === 'on_hold' && (
                  <form onSubmit={(e) => handleReupload(o.code, e)} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50/50 p-3 dark:bg-amber-950/20">
                    <input type="file" name="file" accept="image/png,image/jpeg" className="text-xs text-slate-500" />
                    <select name="demo" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium dark:border-slate-700 dark:bg-slate-800">
                      <option value="">No demo</option>
                      <option value="clean">Demo: clear printed</option>
                      <option value="handwritten">Demo: handwritten</option>
                      <option value="blurry">Demo: blurry</option>
                    </select>
                    <button type="submit" className="rounded-lg bg-teal-700 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-teal-800">
                      {t('upload_new')}
                    </button>
                  </form>
                )}

                {/* Item Lines */}
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {o.items?.map((item: any) => (
                    <div key={item.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span>
                          {item.name} × {item.qty}
                          {item.status === 'rejected' && (
                            <span className="ml-2 font-bold text-red-600">({item.reason})</span>
                          )}
                        </span>
                        {item.savings > 0 && (
                          <span className="text-xs font-bold text-emerald-600">Saved ₹{item.savings}</span>
                        )}
                      </div>

                      {/* Generic Offer Banner */}
                      {item.offer_med && item.consent == null && (
                        <div className="mt-2 rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-xs dark:border-teal-900/60 dark:bg-teal-950/30">
                          <span>
                            {t('generic_offer')} <b>{item.offer_med.name}</b> (₹{item.offer_med.price} {t('instead_of')} ₹{item.price}).
                          </span>
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={async () => {
                                await postApi(`items/${item.id}/consent`, { accept: true });
                                onToast('Generic accepted');
                                loadData();
                              }}
                              className="rounded-lg bg-teal-700 px-3 py-1 font-semibold text-white hover:bg-teal-800"
                            >
                              {t('accept')}
                            </button>
                            <button
                              onClick={async () => {
                                await postApi(`items/${item.id}/consent`, { accept: false });
                                onToast('Keeping the original');
                                loadData();
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {t('keep_original')}
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
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('no_orders')}</p>
        )}
      </div>

      {/* DPDP Data Export */}
      <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
        <button
          onClick={exportData}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <Download className="h-4 w-4" />
          <span>{t('export_data')}</span>
        </button>
      </div>
    </div>
  );
}
