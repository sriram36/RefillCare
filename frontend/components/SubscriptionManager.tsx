'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, RefreshCw, CheckCircle2, Plus, Trash2, Sparkles, Shield, AlertCircle } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { fetchApi, postApi } from '../lib/api';

interface SubscriptionManagerProps {
  user: any;
  lang: Language;
  onToast: (msg: string) => void;
}

export default function SubscriptionManager({ user, lang, onToast }: SubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [forName, setForName] = useState(user?.name || 'Self');
  const [medId, setMedId] = useState(1);
  const [freqDays, setFreqDays] = useState(30);

  const t = (k: string) => translate(k, lang);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('subscriptions');
      setSubscriptions(res || []);
    } catch (err: any) {
      // Graceful fallback
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await postApi('subscriptions', {
        for_name: forName,
        med_id: Number(medId),
        qty: freqDays === 30 ? 60 : 30,
        per_day: 2,
        frequency_days: Number(freqDays),
      });
      onToast('Automated chronic refill subscription activated!');
      setShowModal(false);
      loadSubscriptions();
    } catch (err: any) {
      onToast(err.message || 'Failed to create subscription');
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await fetchApi(`subscriptions/${id}`, { method: 'DELETE' });
      onToast('Subscription cancelled');
      loadSubscriptions();
    } catch (err: any) {
      onToast(err.message || 'Failed to cancel subscription');
    }
  };

  const activeSubs = subscriptions.filter((s) => s.active === 1);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Chronic Auto-Refill Subscriptions</h2>
            <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full">
              Zero-Forget Policy
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Never run out of essential diabetes, BP, or thyroid medicines. Automatic monthly reorders scheduled to your door.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 hover:bg-teal-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Auto-Refill</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading subscriptions…</div>
      ) : activeSubs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700">No active auto-refill subscriptions</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Set up automatic monthly delivery for regular maintenance prescriptions. We handle the verification and dispatch 5 days before your supply runs low.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeSubs.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/40 to-white p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{s.med_name || 'Chronic Medication'}</h4>
                  <span className="text-xs text-slate-500">For: <strong className="text-slate-700">{s.for_name}</strong></span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-white/80 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase">Next Refill Date</span>
                  <p className="font-bold text-teal-900">{s.next_refill}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase">Frequency</span>
                  <p className="font-semibold text-slate-800">Every {s.frequency_days || 30} Days</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-teal-600" />
                  Prescription on file
                </span>
                <button
                  onClick={() => handleCancel(s.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold hover:underline"
                >
                  Cancel Plan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Subscription Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-700" />
              Subscribe to Monthly Chronic Refills
            </h3>
            <p className="text-xs text-slate-500">
              Medicines will be automatically verified by your registered pharmacist and routed to the nearest store every 30 days.
            </p>

            <form onSubmit={handleCreate} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prescription For</label>
                <input
                  type="text"
                  value={forName}
                  onChange={(e) => setForName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chronic Medicine</label>
                <select
                  value={medId}
                  onChange={(e) => setMedId(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value={1}>Metformin 500 mg (Diabetes)</option>
                  <option value={2}>Telmisartan 40 mg (Blood Pressure)</option>
                  <option value={3}>Levothyroxine 50 mcg (Thyroid)</option>
                  <option value={4}>Atorvastatin 10 mg (Cholesterol)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Interval</label>
                <select
                  value={freqDays}
                  onChange={(e) => setFreqDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value={30}>Every 30 Days (Standard 1 Month)</option>
                  <option value={60}>Every 60 Days (2 Months Supply)</option>
                  <option value={90}>Every 90 Days (Quarterly Supply)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white rounded-xl shadow-xs transition"
                >
                  Activate Auto-Refill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

