'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Check, ChevronDown, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { fetchApi, postApi, getToken, buildApiUrl } from '../lib/api';
import { translate, type Language } from '../lib/i18n';

type T = (k: string, vars?: Record<string, string | number>) => string;

interface PharmacistViewProps {
  onToast: (msg: string) => void;
  lang: Language;
}

const LOCALE: Record<Language, string> = { en: 'en-IN', bn: 'bn-IN', hi: 'hi-IN' };

const STATUS_KEY: Record<string, string> = {
  awaiting_pharmacist: 'ph_status_awaiting_pharmacist',
  on_hold: 'ph_status_on_hold',
  approved: 'ph_status_approved',
  packed: 'ph_status_packed',
  dispatched: 'ph_status_dispatched',
  rejected: 'ph_status_rejected',
};

const STATUS_STYLE: Record<string, string> = {
  awaiting_pharmacist: 'bg-amber-100 text-amber-900',
  on_hold: 'bg-orange-100 text-orange-900',
  approved: 'bg-teal-100 text-teal-900',
  packed: 'bg-slate-200 text-slate-800',
  dispatched: 'bg-slate-200 text-slate-800',
  rejected: 'bg-rose-100 text-rose-900',
};

const OTHERS_SHOWN = 6; // the rest of the past orders sit behind "Show all"
const btnPrimary = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60';
const btnSecondary = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-900 hover:bg-slate-50';
const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-teal-700';

function waited(created: number, t: T) {
  const min = Math.max(0, Math.round((Date.now() / 1000 - created) / 60));
  return min < 1 ? t('ph_just_now') : min < 60 ? t('ph_min', { n: min }) : t('ph_h_min', { h: Math.floor(min / 60), m: min % 60 });
}

function Badge({ status, t }: { status: string; t: T }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-sm font-semibold ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-800'}`}>
      {STATUS_KEY[status] ? t(STATUS_KEY[status]) : status}
    </span>
  );
}

function Modal({ title, children, onClose, t }: { title: string; children: React.ReactNode; onClose: () => void; t: T }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-md space-y-5 overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label={t('ph_close')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Add a medicine the AI missed or read wrongly. The line starts as a draft, so it still needs approval. */
function AddMedicine({ code, onToast, onAdded, t }: { code: string; onToast: (m: string) => void; onAdded: () => void; t: T }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0); // a slow answer to an old search must not replace the newer list

  const search = async (value: string) => {
    setTerm(value);
    const mine = ++latest.current;
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const rows = await fetchApi(`medicines?term=${encodeURIComponent(value.trim())}`);
      if (mine === latest.current) setResults(rows);
    } catch (err: any) {
      if (mine === latest.current) onToast(err.message || t('ph_err_search'));
    }
  };

  const add = async (m: any) => {
    setBusy(true);
    try {
      await postApi(`orders/${code}/items`, { med_id: m.id, qty });
      onToast(t('ph_added', { name: m.name.split(',')[0] }));
      setTerm('');
      setResults([]);
      setQty(1);
      onAdded();
    } catch (err: any) {
      onToast(err.message || t('ph_err_add'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="rounded-xl border border-dashed border-slate-300 p-4">
      <summary className="min-h-[2.75rem] cursor-pointer select-none text-base font-semibold text-slate-800">{t('ph_add_med')}</summary>
      <div className="mt-2 space-y-3">
        <p className="text-base text-slate-600">{t('ph_add_med_hint')}</p>
        <div className="flex gap-2">
          <input
            type="search"
            value={term}
            onChange={(e) => search(e.target.value)}
            aria-label={t('ph_search_aria')}
            placeholder={t('ph_search_ph')}
            className={`${fieldClass} flex-1`}
          />
          <input
            type="number"
            min={1}
            max={50}
            value={qty}
            onChange={(e) => setQty(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
            aria-label={t('ph_packs_aria')}
            className="h-[3.25rem] w-20 rounded-xl border border-slate-300 px-3 text-center text-lg font-semibold"
          />
        </div>
        {results.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {results.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0 text-base text-slate-900">
                  {m.name.split(',')[0]}
                  <span className="block text-slate-600">
                    {m.name.split(',').slice(1).join(',').trim()}
                    {m.name.includes(',') ? ' · ' : ''}{t('ph_schedule', { s: m.schedule })} · ₹{m.price}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => add(m)}
                  className="h-11 shrink-0 rounded-xl border border-teal-700 px-4 text-base font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"
                >
                  {t('ph_add')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export default function PharmacistView({ onToast, lang }: PharmacistViewProps) {
  const t: T = (k, vars) => translate(k, lang, vars);
  const locale = LOCALE[lang] || 'en-IN';
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrderState] = useState<any | null>(null);
  // The refresh timer below was created on the first render, so it must not read selectedOrder from state:
  // it would always see "nothing selected" and jump the pharmacist to another prescription every refresh.
  const selectedCodeRef = useRef<string | null>(null);
  const setSelectedOrder = (o: any | null) => {
    selectedCodeRef.current = o ? o.code : null;
    setSelectedOrderState(o);
  };
  const [loading, setLoading] = useState(true);
  const [rxImageUrl, setRxImageUrl] = useState<string | null>(null);
  const [rxLoading, setRxLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [h1Modal, setH1Modal] = useState<{ itemId: number; qty: number } | null>(null);
  const [h1Doctor, setH1Doctor] = useState('');
  const [h1Patient, setH1Patient] = useState('');
  const [rejectModal, setRejectModal] = useState<{ itemId: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [holdModal, setHoldModal] = useState<{ code: string } | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [showAllOthers, setShowAllOthers] = useState(false);

  const loadOrders = async (selectCode?: string) => {
    try {
      const data = await fetchApi('orders');
      setOrders(data);
      if (data.length > 0) {
        const keep = selectCode || selectedCodeRef.current;
        let match = keep ? data.find((o: any) => o.code === keep) : null;
        if (!match) match = data.find((o: any) => o.status === 'awaiting_pharmacist') || data[0];
        setSelectedOrder(match);
      } else {
        setSelectedOrder(null);
      }
    } catch (err: any) {
      onToast(err.message || t('ph_err_queue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const timer = setInterval(() => loadOrders(), 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // what needs a decision comes first, oldest waiting at the top
  const { needsCheck, others } = useMemo(() => {
    const waiting = orders.filter((o) => o.status === 'awaiting_pharmacist').sort((a, b) => a.created - b.created);
    return { needsCheck: waiting, others: orders.filter((o) => o.status !== 'awaiting_pharmacist') };
  }, [orders]);

  useEffect(() => {
    setZoomLevel(1);
    if (!selectedOrder) {
      setRxImageUrl(null);
      setAuditLogs([]);
      return;
    }
    const initial: Record<number, number> = {};
    (selectedOrder.items || []).forEach((item: any) => (initial[item.id] = item.qty));
    setQtys(initial);

    let revoked: string | null = null;
    (async () => {
      setRxLoading(true);
      try {
        const token = getToken();
        const res = await fetch(buildApiUrl(`orders/${selectedOrder.code}/rx`), {
          headers: token ? { Authorization: token } : {},
        });
        if (res.ok) {
          revoked = URL.createObjectURL(await res.blob());
          setRxImageUrl(revoked);
        } else {
          setRxImageUrl(null);
        }
      } catch {
        setRxImageUrl(null);
      } finally {
        setRxLoading(false);
      }
    })();

    (async () => {
      setLoadingAudit(true);
      try {
        setAuditLogs((await fetchApi(`orders/${selectedOrder.code}/audit`)) || []);
      } catch {
        setAuditLogs([]);
      } finally {
        setLoadingAudit(false);
      }
    })();

    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [selectedOrder?.code]);

  const handleApprove = async (item: any) => {
    const qty = qtys[item.id] || item.qty;
    if (item.schedule === 'H1') {
      setH1Modal({ itemId: item.id, qty });
      setH1Doctor('');
      setH1Patient(selectedOrder.for_name || '');
      return;
    }
    try {
      await postApi(`items/${item.id}/decide`, { action: 'approve', qty });
      onToast(t('ph_approved_item', { name: item.name.split(',')[0] }));
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || t('ph_err_approve'));
    }
  };

  const submitH1Approval = async () => {
    if (!h1Modal) return;
    if (!h1Doctor.trim() || !h1Patient.trim()) {
      onToast(t('ph_h1_need'));
      return;
    }
    try {
      await postApi(`items/${h1Modal.itemId}/decide`, {
        action: 'approve',
        qty: h1Modal.qty,
        prescriber: h1Doctor.trim(),
        patient: h1Patient.trim(),
      });
      onToast(t('ph_h1_done'));
      setH1Modal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || t('ph_err_approve'));
    }
  };

  const submitReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      onToast(t('ph_reason_need'));
      return;
    }
    try {
      await postApi(`items/${rejectModal.itemId}/decide`, { action: 'reject', reason: rejectReason.trim() });
      onToast(t('ph_rejected_done'));
      setRejectModal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || t('ph_err_reject'));
    }
  };

  const submitHold = async () => {
    if (!holdModal) return;
    if (!holdReason.trim()) {
      onToast(t('ph_hold_need'));
      return;
    }
    try {
      await postApi(`orders/${holdModal.code}/hold`, { reason: holdReason.trim() });
      onToast(t('ph_hold_done'));
      setHoldModal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || t('ph_err_hold'));
    }
  };

  const handleOfferGeneric = async (item: any) => {
    try {
      await postApi(`items/${item.id}/offer-generic`);
      onToast(t('ph_offered', { name: item.generic.name.split(',')[0] }));
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || t('ph_err_offer'));
    }
  };

  const queueRow = (o: any) => {
    const isSelected = selectedOrder?.code === o.code;
    return (
      <li key={o.code}>
        <button
          onClick={() => setSelectedOrder(o)}
          aria-current={isSelected}
          className={`w-full rounded-xl border p-4 text-left ${
            isSelected ? 'border-teal-700 bg-teal-50 ring-2 ring-teal-700' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-bold text-slate-900">{o.code}</span>
            <Badge status={o.status} t={t} />
          </div>
          <div className="mt-1 text-base text-slate-700">{o.for_name}</div>
          <div className="mt-1 truncate text-base text-slate-500">
            {(o.items || []).map((i: any) => i.name.split(',')[0]).join(', ') || t('ph_no_lines')}
          </div>
          {o.status === 'awaiting_pharmacist' && (
            <div className="mt-1 text-base font-medium text-amber-800">{t('ph_waiting', { time: waited(o.created, t) })}</div>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('ph_tab_queue')}</h1>
          <p className="text-base text-slate-600">
            {needsCheck.length === 0 ? t('ph_nothing_waiting') : t('ph_n_waiting', { n: needsCheck.length })}
          </p>
        </div>
        <button
          onClick={() => loadOrders(selectedOrder?.code)}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          aria-label={t('ph_refresh')}
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-lg text-slate-600" role="status">
          {t('ph_loading_queue')}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-lg text-slate-600">
          {t('ph_no_orders')}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-4">
            {needsCheck.length > 0 && (
              <section aria-label={t('ph_status_awaiting_pharmacist')} className="space-y-2">
                <h2 className="text-base font-semibold text-slate-600">{t('ph_needs_heading', { n: needsCheck.length })}</h2>
                <ul className="space-y-2">{needsCheck.map(queueRow)}</ul>
              </section>
            )}
            {others.length > 0 && (
              <section aria-label={t('ph_other_aria')} className="space-y-2">
                <h2 className="text-base font-semibold text-slate-600">{t('ph_other_heading', { n: others.length })}</h2>
                <ul className="space-y-2">
                  {(showAllOthers ? others : others.filter((o, i) => i < OTHERS_SHOWN || o.code === selectedOrder?.code)).map(queueRow)}
                </ul>
                {others.length > OTHERS_SHOWN && (
                  <button type="button" onClick={() => setShowAllOthers((v) => !v)} className={`${btnSecondary} h-11 w-full`}>
                    {showAllOthers ? t('ph_show_fewer') : t('ph_show_all', { n: others.length })}
                  </button>
                )}
              </section>
            )}
          </div>

          {selectedOrder && (
            <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-8">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">{selectedOrder.code}</h2>
                    <Badge status={selectedOrder.status} t={t} />
                  </div>
                  <p className="text-base text-slate-600">
                    {t('ph_patient')} <strong className="text-slate-900">{selectedOrder.for_name}</strong>
                    {' · '}
                    {selectedOrder.store ? t('ph_store', { store: selectedOrder.store }) : t('ph_no_store')}
                  </p>
                </div>
                {selectedOrder.status === 'awaiting_pharmacist' && (
                  <button
                    onClick={() => {
                      setHoldReason(t('ph_hold_default'));
                      setHoldModal({ code: selectedOrder.code });
                    }}
                    className={btnSecondary}
                  >
                    {t('ph_ask_photo')}
                  </button>
                )}
              </div>

              {selectedOrder.note && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
                  <strong>{t('ph_note')}</strong> {selectedOrder.note}
                </p>
              )}

              {/* The point of this screen: the prescription and what was read from it, side by side */}
              <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
                <section aria-label={t('ph_prescription')} className="space-y-3 md:sticky md:top-24">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{t('ph_prescription')}</h3>
                    {rxImageUrl && (
                      <div className="flex items-center gap-1 rounded-xl border border-slate-300 p-1">
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.max(0.7, +(z - 0.2).toFixed(1)))}
                          className="h-10 w-10 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-100"
                          aria-label={t('ph_zoom_out')}
                        >
                          −
                        </button>
                        <span className="w-12 text-center text-base font-medium text-slate-700">{Math.round(zoomLevel * 100)}%</span>
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.2).toFixed(1)))}
                          className="h-10 w-10 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-100"
                          aria-label={t('ph_zoom_in')}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <div className="flex max-h-[34rem] min-h-[10rem] items-start justify-center overflow-auto rounded-xl border border-slate-200 bg-stone-100 p-3">
                      {rxLoading ? (
                        <p className="self-center text-base text-slate-600" role="status">
                          {t('ph_rx_opening')}
                        </p>
                      ) : rxImageUrl ? (
                        <img
                          src={rxImageUrl}
                          alt={t('ph_rx_alt', { name: selectedOrder.for_name })}
                          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                          className="h-auto max-w-full rounded-lg border border-slate-200 bg-white"
                        />
                      ) : (
                        <p className="self-center text-center text-base text-slate-600">{t('ph_rx_none')}</p>
                      )}
                    </div>
                    {['approved', 'packed', 'dispatched'].includes(selectedOrder.status) && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-4 right-5 max-w-[9rem] -rotate-6 select-none rounded-xl border-4 border-double border-teal-700 px-3 py-1.5 text-center text-sm font-bold leading-tight text-teal-800 opacity-70 mix-blend-multiply"
                      >
                        {t('ph_stamp')}
                      </div>
                    )}
                  </div>
                  <p className="text-base text-slate-500">{t('ph_rx_logged')}</p>
                </section>

                <section aria-label={t('ph_matched')} className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{t('ph_matched')}</h3>
                    <span className="text-base text-slate-500">{t('ph_ai_draft')}</span>
                  </div>

                  {(selectedOrder.items || []).length === 0 ? (
                    <p className="rounded-xl border border-slate-200 bg-stone-50 p-4 text-base text-slate-700">
                      {t('ph_nothing_read')}
                    </p>
                  ) : (
                    (selectedOrder.items || []).map((item: any) => {
                      const isDraft = item.status === 'draft';
                      const isApproved = item.status === 'approved';
                      const isRejected = item.status === 'rejected';
                      const lowConf = item.conf < 0.75;
                      const locked = ['on_hold', 'packed', 'dispatched'].includes(selectedOrder.status);

                      return (
                        <div
                          key={item.id}
                          className={`space-y-3 rounded-xl border p-4 ${
                            isApproved ? 'border-teal-300 bg-teal-50' : isRejected ? 'border-slate-200 bg-stone-50' : 'border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <div className="text-lg font-semibold leading-snug text-slate-900">{item.name.split(',')[0]}</div>
                            <div className="text-base text-slate-600">
                              {item.name.split(',').slice(1).join(',').trim()}
                              {item.name.includes(',') ? ' · ' : ''}{t('ph_price_each', { price: item.price })}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
                                  item.schedule === 'H1' ? 'bg-amber-200 text-amber-950' : 'bg-slate-200 text-slate-800'
                                }`}
                              >
                                {item.schedule === 'H1' ? t('ph_schedule_h1', { s: item.schedule }) : t('ph_schedule', { s: item.schedule })}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-base font-medium ${lowConf ? 'text-amber-800' : 'text-slate-600'}`}
                              >
                                {item.reason === 'Added by pharmacist' ? (
                                  t('ph_added_by_you')
                                ) : (
                                  <>
                                    {lowConf && <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                                    {t(lowConf ? 'ph_conf_low' : 'ph_conf_ok', { pct: Math.round(item.conf * 100) })}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>

                          {isDraft && !locked && (
                            <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                              <label className="text-base font-medium text-slate-700">
                                {t('ph_quantity')}
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={qtys[item.id] ?? item.qty}
                                  onChange={(e) => setQtys({ ...qtys, [item.id]: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="ml-2 h-12 w-20 rounded-xl border border-slate-300 px-3 text-center text-lg font-semibold"
                                />
                              </label>
                              <button onClick={() => handleApprove(item)} className={`${btnPrimary} flex-1`}>
                                <Check className="h-5 w-5" aria-hidden="true" />
                                {t('ph_approve')}
                              </button>
                              <button
                                onClick={() => {
                                  setRejectModal({ itemId: item.id });
                                  setRejectReason('');
                                }}
                                className={`${btnSecondary} text-rose-800`}
                              >
                                {t('ph_reject')}
                              </button>
                            </div>
                          )}

                          {isApproved && (
                            <div className="space-y-2 border-t border-teal-200 pt-3 text-base">
                              <p className="flex items-center gap-2 font-semibold text-teal-900">
                                <Check className="h-5 w-5" aria-hidden="true" />
                                {t(item.qty === 1 ? 'ph_approved_pack' : 'ph_approved_packs', { n: item.qty })}
                              </p>
                              {item.generic && !item.offer && !locked && (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
                                  <span className="text-slate-800">
                                    {t('ph_cheaper')} <strong>{item.generic.name.split(',')[0]}</strong> ₹{item.generic.price}
                                  </span>
                                  <button onClick={() => handleOfferGeneric(item)} className="h-11 rounded-lg border border-teal-700 px-4 font-semibold text-teal-800 hover:bg-teal-50">
                                    {t('ph_offer')}
                                  </button>
                                </div>
                              )}
                              {item.offer && (
                                <p className="text-slate-700">
                                  {item.consent == null
                                    ? t('ph_offer_waiting')
                                    : item.consent
                                    ? t('ph_offer_yes')
                                    : t('ph_offer_no')}
                                </p>
                              )}
                            </div>
                          )}

                          {isRejected && (
                            <p className="border-t border-slate-200 pt-3 text-base font-medium text-slate-700">{t('ph_rejected_reason', { reason: item.reason })}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                  {!['on_hold', 'packed', 'dispatched'].includes(selectedOrder.status) && (
                    <AddMedicine code={selectedOrder.code} onToast={onToast} onAdded={() => loadOrders(selectedOrder.code)} t={t} />
                  )}
                </section>
              </div>

              <details className="group border-t border-slate-200 pt-4">
                <summary className="flex min-h-[2.75rem] cursor-pointer select-none items-center gap-2 text-base font-semibold text-slate-700">
                  <ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden="true" />
                  {t('ph_audit_title')}
                  <ChevronDown className="ml-auto h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl bg-stone-50 p-4 text-base text-slate-700">
                  {loadingAudit ? (
                    <p>{t('ph_loading')}</p>
                  ) : auditLogs.length === 0 ? (
                    <p>{t('ph_audit_none')}</p>
                  ) : (
                    auditLogs.map((log: any, idx: number) => (
                      <p key={idx}>
                        {new Date(log.ts * 1000).toLocaleTimeString(locale)} · <strong>{log.actor}</strong> · {log.action}
                      </p>
                    ))
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {h1Modal && (
        <Modal title={t('ph_h1_title')} onClose={() => setH1Modal(null)} t={t}>
          <p className="text-base text-slate-700">
            {t('ph_h1_body')}
          </p>
          <div className="space-y-2">
            <label htmlFor="h1-doc" className="block text-base font-semibold text-slate-800">
              {t('ph_h1_doc_label')}
            </label>
            <input id="h1-doc" value={h1Doctor} onChange={(e) => setH1Doctor(e.target.value)} placeholder={t('ph_h1_doc_ph')} className={fieldClass} />
            <button type="button" onClick={() => setH1Doctor('Dr. Sample Doctor, WBMC-00000')} className="min-h-[2.75rem] text-base font-semibold text-teal-700 underline underline-offset-4">
              {t('ph_h1_sample')}
            </button>
          </div>
          <div className="space-y-2">
            <label htmlFor="h1-pat" className="block text-base font-semibold text-slate-800">
              {t('ph_patient_name')}
            </label>
            <input id="h1-pat" value={h1Patient} onChange={(e) => setH1Patient(e.target.value)} className={fieldClass} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setH1Modal(null)} className={btnSecondary}>
              {t('ph_cancel')}
            </button>
            <button onClick={submitH1Approval} className={btnPrimary}>
              {t('ph_h1_submit')}
            </button>
          </div>
        </Modal>
      )}

      {rejectModal && (
        <Modal title={t('ph_reject_title')} onClose={() => setRejectModal(null)} t={t}>
          <p className="text-base text-slate-700">{t('ph_reject_body')}</p>
          <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} aria-label={t('ph_reason')} className={fieldClass} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setRejectModal(null)} className={btnSecondary}>
              {t('ph_cancel')}
            </button>
            <button onClick={submitReject} className="inline-flex h-12 items-center justify-center rounded-xl bg-rose-700 px-5 text-base font-semibold text-white hover:bg-rose-800">
              {t('ph_reject')}
            </button>
          </div>
        </Modal>
      )}

      {holdModal && (
        <Modal title={t('ph_ask_photo')} onClose={() => setHoldModal(null)} t={t}>
          <p className="text-base text-slate-700">{t('ph_hold_body')}</p>
          <input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} aria-label={t('ph_hold_aria')} className={fieldClass} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setHoldModal(null)} className={btnSecondary}>
              {t('ph_cancel')}
            </button>
            <button onClick={submitHold} className={btnPrimary}>
              {t('ph_send_request')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
