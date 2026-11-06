'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, CheckCircle2, Package, Plus, RefreshCw, Truck, X } from 'lucide-react';
import { fetchApi, postApi } from '../lib/api';
import { translate, type Language } from '../lib/i18n';

interface StoreViewProps {
  user: any;
  lang: Language;
  onToast: (msg: string) => void;
}

// The catalogue ids and names, matching the server. Needed only for the stock-transfer request.
const MEDICINES = [
  { id: 1, name: 'Metformin 500 mg' },
  { id: 2, name: 'Telmisartan 40 mg' },
  { id: 3, name: 'Levothyroxine 50 mcg' },
  { id: 4, name: 'Amlodipine 5 mg' },
  { id: 5, name: 'Glimepiride 1 mg' },
];
const STORES = [
  { id: 1, name: 'Salt Lake' },
  { id: 2, name: 'Behala' },
  { id: 3, name: 'Howrah Maidan' },
  { id: 4, name: 'Garia' },
  { id: 5, name: 'Dum Dum' },
  { id: 6, name: 'Jadavpur' },
  { id: 7, name: 'New Town' },
  { id: 8, name: 'Baranagar' },
  { id: 9, name: 'Tollygunge' },
  { id: 10, name: 'Dhakuria' },
  { id: 11, name: 'Santragachi' },
  { id: 12, name: 'Belgharia' },
  { id: 13, name: 'Rajarhat' },
  { id: 14, name: 'Kasba' },
  { id: 15, name: 'Thakurpukur' },
];
const COURIERS = ['Store delivery staff', 'Local courier'];
// The raw value is sent to the server; only the label shown on screen is translated.
const COURIER_KEYS: Record<string, string> = {
  'Store delivery staff': 'sv_courier_staff',
  'Local courier': 'sv_courier_local',
};

const btnPrimary = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60';
const btnSecondary = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-900 hover:bg-slate-50';
const fieldClass = 'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 focus:border-teal-700';

const STATUS_KEYS: Record<string, string> = {
  awaiting_pharmacist: 'sv_status_awaiting',
  approved: 'sv_status_approved',
  packed: 'sv_packed',
  dispatched: 'sv_handed_over',
};

function Modal({ title, children, onClose, lang }: { title: string; children: React.ReactNode; onClose: () => void; lang: Language }) {
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
          <button type="button" onClick={onClose} aria-label={translate('sv_close', lang)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StoreView({ user, lang, onToast }: StoreViewProps) {
  const t = (k: string, vars?: Record<string, string | number>) => translate(k, lang, vars);
  const courierLabel = (name: string) => (COURIER_KEYS[name] ? t(COURIER_KEYS[name]) : name);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [packModal, setPackModal] = useState<{ code: string } | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [dispatchModal, setDispatchModal] = useState<{ code: string } | null>(null);
  const [courier, setCourier] = useState(COURIERS[0]);
  const [tab, setTab] = useState<'orders' | 'transfers'>('orders');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [reqMedId, setReqMedId] = useState(1);
  const [reqQty, setReqQty] = useState(10);
  const otherStores = STORES.filter((s) => s.id !== user?.store_id);
  const [fromStoreId, setFromStoreId] = useState(otherStores[0]?.id || 1);

  const loadTransfers = async () => {
    try {
      setTransfers((await fetchApi('transfers')) || []);
    } catch {
      setTransfers([]);
    }
  };

  const loadOrders = async () => {
    try {
      setOrders(await fetchApi('orders'));
    } catch (err: any) {
      onToast(err.message || t('sv_t_load_fail'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadTransfers();
    const timer = setInterval(loadOrders, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await postApi('transfers/request', {
        to_store_id: user?.store_id,
        from_store_id: Number(fromStoreId),
        med_id: Number(reqMedId),
        qty: Number(reqQty),
      });
      onToast(t('sv_t_transfer_ok'));
      setShowTransfer(false);
      loadTransfers();
    } catch (err: any) {
      onToast(err.message || t('sv_t_transfer_fail'));
    }
  };

  const fulfilTransfer = async (id: number) => {
    try {
      await postApi(`transfers/${id}/fulfill`);
      onToast(t('sv_t_sent'));
      loadTransfers();
    } catch (err: any) {
      onToast(err.message || t('sv_t_send_fail'));
    }
  };

  const submitPack = async () => {
    if (!packModal) return;
    if (!invoiceNo.trim()) {
      onToast(t('sv_t_need_invoice'));
      return;
    }
    try {
      await postApi(`orders/${packModal.code}/pack`, { invoice: invoiceNo.trim() });
      onToast(t('sv_t_packed', { code: packModal.code }));
      setPackModal(null);
      await loadOrders();
    } catch (err: any) {
      onToast(err.message || t('sv_t_pack_fail'));
    }
  };

  const submitDispatch = async () => {
    if (!dispatchModal) return;
    try {
      await postApi(`orders/${dispatchModal.code}/dispatch`, { partner: courier.trim() });
      onToast(t('sv_t_handed', { code: dispatchModal.code, name: courierLabel(courier.trim()) }));
      setDispatchModal(null);
      await loadOrders();
    } catch (err: any) {
      onToast(err.message || t('sv_t_handover_fail'));
    }
  };

  const pendingTransfers = transfers.filter((t) => t.status === 'requested').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('sv_title')}</h1>
          <p className="text-base text-slate-600">{user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
            {(
              [
                ['orders', t('sv_tab_orders', { n: orders.length })],
                ['transfers', pendingTransfers ? t('sv_tab_transfers_n', { n: pendingTransfers }) : t('sv_tab_transfers')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => {
                  setTab(key);
                  if (key === 'transfers') loadTransfers();
                }}
                className={`h-11 rounded-lg px-3 text-base font-semibold ${tab === key ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              loadOrders();
              loadTransfers();
            }}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            aria-label={t('sv_refresh')}
          >
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {tab === 'orders' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [t('sv_stat_waiting'), 'awaiting_pharmacist'],
            [t('sv_stat_to_pack'), 'approved'],
            [t('sv_packed'), 'packed'],
            [t('sv_handed_over'), 'dispatched'],
          ].map(([label, st]) => (
            <div key={st} className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-sm text-slate-600">{label}</p>
              <p className="mt-1 text-3xl text-slate-900">{orders.filter((o) => o.status === st).length}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'transfers' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base text-slate-600">{t('sv_transfer_intro')}</p>
            <button onClick={() => setShowTransfer(true)} className={`${btnSecondary} shrink-0`}>
              <Plus className="h-5 w-5" aria-hidden="true" />
              {t('sv_request_stock')}
            </button>
          </div>

          {transfers.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-lg text-slate-600">{t('sv_no_transfers')}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {transfers.map((tr) => (
                <div key={tr.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{(tr.med_name || '').split(',')[0]}</h3>
                      <p className="text-base text-slate-600">{t('sv_packs', { n: tr.qty })}</p>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${tr.status === 'fulfilled' ? 'bg-slate-200 text-slate-800' : 'bg-amber-100 text-amber-900'}`}>
                      {tr.status === 'fulfilled' ? t('sv_sent') : t('sv_requested')}
                    </span>
                  </div>
                  <p className="text-base text-slate-700">
                    {tr.from_store} <ArrowRightLeft className="mx-1 inline h-4 w-4" aria-hidden="true" /> {tr.to_store}
                  </p>
                  {tr.status === 'requested' && tr.from_store_id === user?.store_id && (
                    <button onClick={() => fulfilTransfer(tr.id)} className={btnPrimary}>
                      {t('sv_send_stock')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading && orders.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-lg text-slate-600" role="status">
          {t('sv_loading')}
        </p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-teal-700" aria-hidden="true" />
          <p className="text-lg font-semibold text-slate-900">{t('sv_empty_title')}</p>
          <p className="text-base text-slate-600">{t('sv_empty_body')}</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const approved = o.status === 'approved';
            const packed = o.status === 'packed';
            const dispatched = o.status === 'dispatched';
            const awaiting = o.status === 'awaiting_pharmacist';
            const items = (o.items || []).filter((i: any) => i.status !== 'rejected');

            return (
              <article key={o.code} className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="whitespace-nowrap text-xl font-bold text-slate-900">{o.code}</h2>
                      <p className="text-base text-slate-600">{t('sv_for', { name: o.for_name })}</p>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
                        awaiting ? 'bg-amber-100 text-amber-900' : approved ? 'bg-teal-100 text-teal-900' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {STATUS_KEYS[o.status] ? t(STATUS_KEYS[o.status]) : o.status}
                    </span>
                  </div>

                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {items.length === 0 ? (
                      <li className="p-3 text-base text-slate-500">{t('sv_no_items')}</li>
                    ) : (
                      items.map((item: any) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 p-3 text-base">
                          <span className="text-slate-900">{item.name}</span>
                          <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-900">× {item.qty}</span>
                        </li>
                      ))
                    )}
                  </ul>

                  <p className="text-base text-slate-600">
                    {o.payment === 'upi_test' || o.paid === 1 ? t('sv_paid_online') : t('sv_cod')}
                  </p>

                  {awaiting && (
                    <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-base text-amber-950">
                      {t('sv_locked')}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 bg-stone-50 p-4">
                  {awaiting && (
                    <button disabled className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 text-base font-semibold text-slate-500">
                      {t('sv_status_awaiting')}
                    </button>
                  )}
                  {approved && (
                    <button
                      onClick={() => {
                        setPackModal({ code: o.code });
                        setInvoiceNo('');
                      }}
                      className={btnPrimary}
                    >
                      <Package className="h-5 w-5" aria-hidden="true" />
                      {t('sv_btn_pack')}
                    </button>
                  )}
                  {packed && (
                    <button
                      onClick={() => {
                        setDispatchModal({ code: o.code });
                        setCourier(COURIERS[0]);
                      }}
                      className={btnPrimary}
                    >
                      <Truck className="h-5 w-5" aria-hidden="true" />
                      {t('sv_btn_handover')}
                    </button>
                  )}
                  {dispatched && (
                    <p className="flex items-start gap-2 text-base text-slate-800">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                      <span>
                        {t('sv_handed_to', { name: o.delivery_partner ? courierLabel(o.delivery_partner) : t('sv_delivery_default') })}
                        <span className="block text-slate-600">{t('sv_invoice', { no: o.invoice_no || t('sv_invoice_default') })}</span>
                      </span>
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showTransfer && (
        <Modal title={t('sv_request_stock')} lang={lang} onClose={() => setShowTransfer(false)}>
          <form onSubmit={requestTransfer} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="t-from" className="block text-base font-semibold text-slate-800">
                {t('sv_ask_store')}
              </label>
              <select id="t-from" value={fromStoreId} onChange={(e) => setFromStoreId(Number(e.target.value))} className={fieldClass}>
                {otherStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="t-med" className="block text-base font-semibold text-slate-800">
                {t('sv_medicine')}
              </label>
              <select id="t-med" value={reqMedId} onChange={(e) => setReqMedId(Number(e.target.value))} className={fieldClass}>
                {MEDICINES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="t-qty" className="block text-base font-semibold text-slate-800">
                {t('sv_packs_needed')}
              </label>
              <input
                id="t-qty"
                type="number"
                min={1}
                max={500}
                value={reqQty}
                onChange={(e) => setReqQty(Math.max(1, parseInt(e.target.value) || 1))}
                className={fieldClass}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setShowTransfer(false)} className={btnSecondary}>
                {t('sv_cancel')}
              </button>
              <button type="submit" className={btnPrimary}>
                {t('sv_send_request')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {packModal && (
        <Modal title={t('sv_pack_title', { code: packModal.code })} lang={lang} onClose={() => setPackModal(null)}>
          <p className="text-base text-slate-700">{t('sv_pack_hint')}</p>
          <div className="space-y-2">
            <label htmlFor="inv" className="block text-base font-semibold text-slate-800">
              {t('sv_invoice_label')}
            </label>
            <input id="inv" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder={t('sv_invoice_ph')} autoFocus className={fieldClass} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setPackModal(null)} className={btnSecondary}>
              {t('sv_cancel')}
            </button>
            <button onClick={submitPack} className={btnPrimary}>
              {t('sv_confirm_packed')}
            </button>
          </div>
        </Modal>
      )}

      {dispatchModal && (
        <Modal title={t('sv_btn_handover')} lang={lang} onClose={() => setDispatchModal(null)}>
          <p className="text-base text-slate-700">{t('sv_who', { code: dispatchModal.code })}</p>
          <div className="space-y-2">
            <label htmlFor="courier" className="block text-base font-semibold text-slate-800">
              {t('sv_partner')}
            </label>
            <input id="courier" value={courier} onChange={(e) => setCourier(e.target.value)} className={fieldClass} />
            <div className="flex flex-wrap gap-2 pt-1">
              {COURIERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCourier(p)}
                  aria-pressed={courier === p}
                  className={`min-h-[2.75rem] rounded-lg border px-3 text-base font-medium ${
                    courier === p ? 'border-teal-700 bg-teal-50 text-teal-900 ring-2 ring-teal-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {courierLabel(p)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setDispatchModal(null)} className={btnSecondary}>
              {t('sv_cancel')}
            </button>
            <button onClick={submitDispatch} className={btnPrimary}>
              {t('sv_confirm_handover')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
