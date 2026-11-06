'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, CheckCircle2, Package, Plus, RefreshCw, Truck, X } from 'lucide-react';
import { fetchApi, postApi } from '../lib/api';

interface StoreViewProps {
  user: any;
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
];
const COURIERS = ['Store delivery staff', 'Local courier'];

const btnPrimary = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60';
const btnSecondary = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-900 hover:bg-slate-50';
const fieldClass = 'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 focus:border-teal-700';

const STATUS_TEXT: Record<string, string> = {
  awaiting_pharmacist: 'Waiting for the pharmacist',
  approved: 'Ready to pack',
  packed: 'Packed',
  dispatched: 'Handed over',
};

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
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
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StoreView({ user, onToast }: StoreViewProps) {
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
      onToast(err.message || 'Could not load orders.');
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
      onToast('Transfer requested.');
      setShowTransfer(false);
      loadTransfers();
    } catch (err: any) {
      onToast(err.message || 'Could not request the transfer.');
    }
  };

  const fulfilTransfer = async (id: number) => {
    try {
      await postApi(`transfers/${id}/fulfill`);
      onToast('Sent. Stock counts are updated.');
      loadTransfers();
    } catch (err: any) {
      onToast(err.message || 'Could not send the transfer.');
    }
  };

  const submitPack = async () => {
    if (!packModal) return;
    if (!invoiceNo.trim()) {
      onToast('Enter the invoice number from your billing software.');
      return;
    }
    try {
      await postApi(`orders/${packModal.code}/pack`, { invoice: invoiceNo.trim() });
      onToast(`${packModal.code} packed.`);
      setPackModal(null);
      await loadOrders();
    } catch (err: any) {
      onToast(err.message || 'Could not pack this order.');
    }
  };

  const submitDispatch = async () => {
    if (!dispatchModal) return;
    try {
      await postApi(`orders/${dispatchModal.code}/dispatch`, { partner: courier.trim() });
      onToast(`${dispatchModal.code} handed to ${courier.trim()}.`);
      setDispatchModal(null);
      await loadOrders();
    } catch (err: any) {
      onToast(err.message || 'Could not hand over this order.');
    }
  };

  const pendingTransfers = transfers.filter((t) => t.status === 'requested').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Store orders</h1>
          <p className="text-base text-slate-600">{user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
            {(
              [
                ['orders', `Orders (${orders.length})`],
                ['transfers', `Stock transfers${pendingTransfers ? ` (${pendingTransfers})` : ''}`],
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
            aria-label="Refresh"
          >
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {tab === 'orders' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Waiting', 'awaiting_pharmacist'],
            ['To pack', 'approved'],
            ['Packed', 'packed'],
            ['Handed over', 'dispatched'],
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
            <p className="text-base text-slate-600">Move stock between stores when one runs short.</p>
            <button onClick={() => setShowTransfer(true)} className={`${btnSecondary} shrink-0`}>
              <Plus className="h-5 w-5" aria-hidden="true" />
              Request stock
            </button>
          </div>

          {transfers.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-lg text-slate-600">No transfers yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {transfers.map((tr) => (
                <div key={tr.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{(tr.med_name || '').split(',')[0]}</h3>
                      <p className="text-base text-slate-600">{tr.qty} packs</p>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${tr.status === 'fulfilled' ? 'bg-slate-200 text-slate-800' : 'bg-amber-100 text-amber-900'}`}>
                      {tr.status === 'fulfilled' ? 'Sent' : 'Requested'}
                    </span>
                  </div>
                  <p className="text-base text-slate-700">
                    {tr.from_store} <ArrowRightLeft className="mx-1 inline h-4 w-4" aria-hidden="true" /> {tr.to_store}
                  </p>
                  {tr.status === 'requested' && tr.from_store_id === user?.store_id && (
                    <button onClick={() => fulfilTransfer(tr.id)} className={btnPrimary}>
                      Send this stock
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading && orders.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-lg text-slate-600" role="status">
          Loading orders…
        </p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-teal-700" aria-hidden="true" />
          <p className="text-lg font-semibold text-slate-900">Nothing to pack right now.</p>
          <p className="text-base text-slate-600">New orders appear here once a pharmacist has approved them.</p>
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
                      <p className="text-base text-slate-600">For {o.for_name}</p>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
                        awaiting ? 'bg-amber-100 text-amber-900' : approved ? 'bg-teal-100 text-teal-900' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {STATUS_TEXT[o.status] || o.status}
                    </span>
                  </div>

                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {items.length === 0 ? (
                      <li className="p-3 text-base text-slate-500">No approved items</li>
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
                    {o.payment === 'upi_test' || o.paid === 1 ? 'Paid online' : 'Collect cash on delivery'}
                  </p>

                  {awaiting && (
                    <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-base text-amber-950">
                      Locked. Prescription medicines cannot be packed until a pharmacist approves them.
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 bg-stone-50 p-4">
                  {awaiting && (
                    <button disabled className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 text-base font-semibold text-slate-500">
                      Waiting for the pharmacist
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
                      Pack and enter invoice
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
                      Hand over to delivery
                    </button>
                  )}
                  {dispatched && (
                    <p className="flex items-start gap-2 text-base text-slate-800">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                      <span>
                        Handed to {o.delivery_partner || 'delivery'}
                        <span className="block text-slate-600">Invoice {o.invoice_no || 'recorded'}</span>
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
        <Modal title="Request stock" onClose={() => setShowTransfer(false)}>
          <form onSubmit={requestTransfer} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="t-from" className="block text-base font-semibold text-slate-800">
                Ask this store
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
                Medicine
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
                Packs needed
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
                Cancel
              </button>
              <button type="submit" className={btnPrimary}>
                Send request
              </button>
            </div>
          </form>
        </Modal>
      )}

      {packModal && (
        <Modal title={`Pack ${packModal.code}`} onClose={() => setPackModal(null)}>
          <p className="text-base text-slate-700">Type the invoice number from your billing software.</p>
          <div className="space-y-2">
            <label htmlFor="inv" className="block text-base font-semibold text-slate-800">
              Store invoice number
            </label>
            <input id="inv" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV-84920" autoFocus className={fieldClass} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setPackModal(null)} className={btnSecondary}>
              Cancel
            </button>
            <button onClick={submitPack} className={btnPrimary}>
              Confirm packed
            </button>
          </div>
        </Modal>
      )}

      {dispatchModal && (
        <Modal title="Hand over to delivery" onClose={() => setDispatchModal(null)}>
          <p className="text-base text-slate-700">Who is taking {dispatchModal.code}?</p>
          <div className="space-y-2">
            <label htmlFor="courier" className="block text-base font-semibold text-slate-800">
              Delivery partner
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
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setDispatchModal(null)} className={btnSecondary}>
              Cancel
            </button>
            <button onClick={submitDispatch} className={btnPrimary}>
              Confirm handover
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
