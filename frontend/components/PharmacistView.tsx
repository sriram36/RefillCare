'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Check, ChevronDown, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { fetchApi, postApi, getToken, buildApiUrl } from '../lib/api';

interface PharmacistViewProps {
  onToast: (msg: string) => void;
}

const STATUS_TEXT: Record<string, string> = {
  awaiting_pharmacist: 'Needs checking',
  on_hold: 'Photo requested',
  approved: 'Approved',
  packed: 'Packed',
  dispatched: 'Dispatched',
  rejected: 'Rejected',
};

const STATUS_STYLE: Record<string, string> = {
  awaiting_pharmacist: 'bg-amber-100 text-amber-900',
  on_hold: 'bg-orange-100 text-orange-900',
  approved: 'bg-teal-100 text-teal-900',
  packed: 'bg-slate-200 text-slate-800',
  dispatched: 'bg-slate-200 text-slate-800',
  rejected: 'bg-rose-100 text-rose-900',
};

const btnPrimary = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60';
const btnSecondary = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-900 hover:bg-slate-50';
const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-teal-700';

function waited(created: number) {
  const min = Math.max(0, Math.round((Date.now() / 1000 - created) / 60));
  return min < 1 ? 'just now' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-sm font-semibold ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-800'}`}>
      {STATUS_TEXT[status] || status}
    </span>
  );
}

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

export default function PharmacistView({ onToast }: PharmacistViewProps) {
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
  const [holdReason, setHoldReason] = useState('Please upload a clearer photo of the prescription.');
  const [qtys, setQtys] = useState<Record<number, number>>({});

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
      onToast(err.message || 'Could not load the queue.');
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
      onToast(`Approved ${item.name.split(',')[0]}`);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Could not approve.');
    }
  };

  const submitH1Approval = async () => {
    if (!h1Modal) return;
    if (!h1Doctor.trim() || !h1Patient.trim()) {
      onToast('The H1 register needs both the prescriber and the patient.');
      return;
    }
    try {
      await postApi(`items/${h1Modal.itemId}/decide`, {
        action: 'approve',
        qty: h1Modal.qty,
        prescriber: h1Doctor.trim(),
        patient: h1Patient.trim(),
      });
      onToast('Approved and written to the H1 register.');
      setH1Modal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Could not approve.');
    }
  };

  const submitReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      onToast('Please give a reason.');
      return;
    }
    try {
      await postApi(`items/${rejectModal.itemId}/decide`, { action: 'reject', reason: rejectReason.trim() });
      onToast('Rejected. The customer will see the reason.');
      setRejectModal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Could not reject.');
    }
  };

  const submitHold = async () => {
    if (!holdModal) return;
    if (!holdReason.trim()) {
      onToast('Please tell the customer what to fix.');
      return;
    }
    try {
      await postApi(`orders/${holdModal.code}/hold`, { reason: holdReason.trim() });
      onToast('Asked the customer for a new photo.');
      setHoldModal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Could not send the request.');
    }
  };

  const handleOfferGeneric = async (item: any) => {
    try {
      await postApi(`items/${item.id}/offer-generic`);
      onToast(`Offered ${item.generic.name.split(',')[0]} (generic). Waiting for the customer.`);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Could not offer the generic.');
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
            <Badge status={o.status} />
          </div>
          <div className="mt-1 text-base text-slate-700">{o.for_name}</div>
          <div className="mt-1 truncate text-base text-slate-500">
            {(o.items || []).map((i: any) => i.name.split(',')[0]).join(', ') || 'No lines read'}
          </div>
          {o.status === 'awaiting_pharmacist' && (
            <div className="mt-1 text-base font-medium text-amber-800">Waiting {waited(o.created)}</div>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Verification queue</h1>
          <p className="text-base text-slate-600">
            {needsCheck.length === 0 ? 'Nothing is waiting.' : `${needsCheck.length} waiting for a pharmacist.`}
          </p>
        </div>
        <button
          onClick={() => loadOrders(selectedOrder?.code)}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          aria-label="Refresh the queue"
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-lg text-slate-600" role="status">
          Loading the queue…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-lg text-slate-600">
          No orders yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-4">
            {needsCheck.length > 0 && (
              <section aria-label="Needs checking" className="space-y-2">
                <h2 className="text-base font-semibold text-slate-600">Needs checking ({needsCheck.length})</h2>
                <ul className="space-y-2">{needsCheck.map(queueRow)}</ul>
              </section>
            )}
            {others.length > 0 && (
              <section aria-label="Other orders" className="space-y-2">
                <h2 className="text-base font-semibold text-slate-600">Other orders ({others.length})</h2>
                <ul className="space-y-2">{others.map(queueRow)}</ul>
              </section>
            )}
          </div>

          {selectedOrder && (
            <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-8">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">{selectedOrder.code}</h2>
                    <Badge status={selectedOrder.status} />
                  </div>
                  <p className="text-base text-slate-600">
                    Patient <strong className="text-slate-900">{selectedOrder.for_name}</strong>
                    {' · '}
                    {selectedOrder.store ? `Store: ${selectedOrder.store}` : 'No store yet'}
                  </p>
                </div>
                {selectedOrder.status === 'awaiting_pharmacist' && (
                  <button onClick={() => setHoldModal({ code: selectedOrder.code })} className={btnSecondary}>
                    Ask for a new photo
                  </button>
                )}
              </div>

              {selectedOrder.note && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
                  <strong>Note:</strong> {selectedOrder.note}
                </p>
              )}

              {/* The point of this screen: the prescription and what was read from it, side by side */}
              <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
                <section aria-label="Prescription" className="space-y-3 md:sticky md:top-24">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">Prescription</h3>
                    {rxImageUrl && (
                      <div className="flex items-center gap-1 rounded-xl border border-slate-300 p-1">
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.max(0.7, +(z - 0.2).toFixed(1)))}
                          className="h-10 w-10 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-100"
                          aria-label="Zoom out"
                        >
                          −
                        </button>
                        <span className="w-12 text-center text-base font-medium text-slate-700">{Math.round(zoomLevel * 100)}%</span>
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.2).toFixed(1)))}
                          className="h-10 w-10 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-100"
                          aria-label="Zoom in"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex max-h-[34rem] min-h-[10rem] items-start justify-center overflow-auto rounded-xl border border-slate-200 bg-stone-100 p-3">
                    {rxLoading ? (
                      <p className="self-center text-base text-slate-600" role="status">
                        Opening the prescription…
                      </p>
                    ) : rxImageUrl ? (
                      <img
                        src={rxImageUrl}
                        alt={`Prescription for ${selectedOrder.for_name}`}
                        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                        className="h-auto max-w-full rounded-lg border border-slate-200 bg-white"
                      />
                    ) : (
                      <p className="self-center text-center text-base text-slate-600">No prescription file for this order.</p>
                    )}
                  </div>
                  <p className="text-base text-slate-500">Opening it is recorded in the access log below.</p>
                </section>

                <section aria-label="Matched items" className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">Matched items</h3>
                    <span className="text-base text-slate-500">AI draft. You decide.</span>
                  </div>

                  {(selectedOrder.items || []).length === 0 ? (
                    <p className="rounded-xl border border-slate-200 bg-stone-50 p-4 text-base text-slate-700">
                      Nothing could be read. Ask for a clearer photo.
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
                              {item.name.includes(',') ? ' · ' : ''}₹{item.price} each
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
                                  item.schedule === 'H1' ? 'bg-amber-200 text-amber-950' : 'bg-slate-200 text-slate-800'
                                }`}
                              >
                                Schedule {item.schedule}
                                {item.schedule === 'H1' ? ' · register' : ''}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-base font-medium ${lowConf ? 'text-amber-800' : 'text-slate-600'}`}
                              >
                                {lowConf && <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                                {lowConf ? 'Check the image' : 'Read'} · {Math.round(item.conf * 100)}%
                              </span>
                            </div>
                          </div>

                          {isDraft && !locked && (
                            <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                              <label className="text-base font-medium text-slate-700">
                                Quantity
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
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectModal({ itemId: item.id });
                                  setRejectReason('');
                                }}
                                className={`${btnSecondary} text-rose-800`}
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {isApproved && (
                            <div className="space-y-2 border-t border-teal-200 pt-3 text-base">
                              <p className="flex items-center gap-2 font-semibold text-teal-900">
                                <Check className="h-5 w-5" aria-hidden="true" />
                                Approved · {item.qty} {item.qty === 1 ? 'pack' : 'packs'}
                              </p>
                              {item.generic && !item.offer && !locked && (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
                                  <span className="text-slate-800">
                                    Cheaper generic: <strong>{item.generic.name.split(',')[0]}</strong> ₹{item.generic.price}
                                  </span>
                                  <button onClick={() => handleOfferGeneric(item)} className="h-11 rounded-lg border border-teal-700 px-4 font-semibold text-teal-800 hover:bg-teal-50">
                                    Offer to customer
                                  </button>
                                </div>
                              )}
                              {item.offer && (
                                <p className="text-slate-700">
                                  {item.consent == null
                                    ? 'Generic offered. Waiting for the customer to answer.'
                                    : item.consent
                                    ? 'Customer accepted the generic.'
                                    : 'Customer kept the prescribed brand.'}
                                </p>
                              )}
                            </div>
                          )}

                          {isRejected && (
                            <p className="border-t border-slate-200 pt-3 text-base font-medium text-slate-700">Rejected: {item.reason}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </section>
              </div>

              <details className="group border-t border-slate-200 pt-4">
                <summary className="flex min-h-[2.75rem] cursor-pointer select-none items-center gap-2 text-base font-semibold text-slate-700">
                  <ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden="true" />
                  Who opened this prescription
                  <ChevronDown className="ml-auto h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl bg-stone-50 p-4 text-base text-slate-700">
                  {loadingAudit ? (
                    <p>Loading…</p>
                  ) : auditLogs.length === 0 ? (
                    <p>Nobody has opened it yet.</p>
                  ) : (
                    auditLogs.map((log: any, idx: number) => (
                      <p key={idx}>
                        {new Date(log.ts * 1000).toLocaleTimeString()} · <strong>{log.actor}</strong> · {log.action}
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
        <Modal title="Schedule H1 register" onClose={() => setH1Modal(null)}>
          <p className="text-base text-slate-700">
            Schedule H1 medicines need the prescriber and patient written in the H1 register before they are sold.
          </p>
          <div className="space-y-2">
            <label htmlFor="h1-doc" className="block text-base font-semibold text-slate-800">
              Prescriber name and registration number
            </label>
            <input id="h1-doc" value={h1Doctor} onChange={(e) => setH1Doctor(e.target.value)} placeholder="Dr A. Banerjee, WBMC-12345" className={fieldClass} />
            <button type="button" onClick={() => setH1Doctor('Dr. Sample Doctor, WBMC-00000')} className="min-h-[2.75rem] text-base font-semibold text-teal-700 underline underline-offset-4">
              Fill a sample (demo)
            </button>
          </div>
          <div className="space-y-2">
            <label htmlFor="h1-pat" className="block text-base font-semibold text-slate-800">
              Patient name
            </label>
            <input id="h1-pat" value={h1Patient} onChange={(e) => setH1Patient(e.target.value)} className={fieldClass} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setH1Modal(null)} className={btnSecondary}>
              Cancel
            </button>
            <button onClick={submitH1Approval} className={btnPrimary}>
              Write to register and approve
            </button>
          </div>
        </Modal>
      )}

      {rejectModal && (
        <Modal title="Reject this medicine" onClose={() => setRejectModal(null)}>
          <p className="text-base text-slate-700">The customer will see your reason. For example: dose unclear, prescription expired.</p>
          <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} aria-label="Reason" className={fieldClass} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setRejectModal(null)} className={btnSecondary}>
              Cancel
            </button>
            <button onClick={submitReject} className="inline-flex h-12 items-center justify-center rounded-xl bg-rose-700 px-5 text-base font-semibold text-white hover:bg-rose-800">
              Reject
            </button>
          </div>
        </Modal>
      )}

      {holdModal && (
        <Modal title="Ask for a new photo" onClose={() => setHoldModal(null)}>
          <p className="text-base text-slate-700">The order is put on hold and the customer is asked to send a clearer photo.</p>
          <input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} aria-label="Message to the customer" className={fieldClass} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setHoldModal(null)} className={btnSecondary}>
              Cancel
            </button>
            <button onClick={submitHold} className={btnPrimary}>
              Send request
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
