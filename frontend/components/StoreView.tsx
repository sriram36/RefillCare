'use client';

import React, { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle2, Clock, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { fetchApi, postApi } from '../lib/api';

interface StoreViewProps {
  user: any;
  lang: Language;
  onToast: (msg: string) => void;
}

export default function StoreView({ user, lang, onToast }: StoreViewProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [packModal, setPackModal] = useState<{ code: string } | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');

  const [dispatchModal, setDispatchModal] = useState<{ code: string } | null>(null);
  const [courier, setCourier] = useState('Local Express Delivery');

  const t = (k: string) => translate(k, lang);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('orders');
      setOrders(data);
    } catch (err: any) {
      onToast(err.message || 'Failed to load store orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handlePack = (code: string) => {
    setPackModal({ code });
    setInvoiceNo(`INV-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const submitPack = async () => {
    if (!packModal) return;
    if (!invoiceNo.trim()) {
      onToast('Store invoice number is required to pack');
      return;
    }

    try {
      await postApi(`orders/${packModal.code}/pack`, { invoice: invoiceNo.trim() });
      onToast(`Order ${packModal.code} packed with invoice ${invoiceNo.trim()}`);
      setPackModal(null);
      await loadOrders();
    } catch (err: any) {
      onToast(err.message || 'Failed to pack order');
    }
  };

  const handleDispatch = (code: string) => {
    setDispatchModal({ code });
    setCourier('Local Express Delivery (Store Staff)');
  };

  const submitDispatch = async () => {
    if (!dispatchModal) return;
    try {
      await postApi(`orders/${dispatchModal.code}/dispatch`, { partner: courier.trim() });
      onToast(`Order ${dispatchModal.code} handed over to ${courier.trim()}`);
      setDispatchModal(null);
      await loadOrders();
    } catch (err: any) {
      onToast(err.message || 'Failed to dispatch order');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-teal-700" />
            Store Order Fulfillment & Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Store: <strong className="text-slate-800">{user?.store_name || user?.name || 'Local Store'}</strong> • Picking, Packing & Courier Handover
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors self-start sm:self-auto"
          title="Refresh Orders"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Loading store orders...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
          No orders routed to your store at the moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {orders.map((o) => {
            const isAwaiting = o.status === 'awaiting_pharmacist';
            const isApproved = o.status === 'approved';
            const isPacked = o.status === 'packed';
            const isDispatched = o.status === 'dispatched';
            const isOnHold = o.status === 'on_hold';

            const activeItems = (o.items || []).filter((i: any) => i.status !== 'rejected');

            return (
              <div
                key={o.code}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-base">{o.code}</span>
                      <div className="text-xs text-slate-500 mt-0.5">
                        For: <strong className="text-slate-700">{o.for_name}</strong>
                      </div>
                    </div>

                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      isAwaiting
                        ? 'bg-amber-100 text-amber-800'
                        : isApproved
                        ? 'bg-teal-100 text-teal-800'
                        : isPacked
                        ? 'bg-blue-100 text-blue-800'
                        : isDispatched
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {o.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Payment Info */}
                  <div className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-between">
                    <span>Payment Mode:</span>
                    <strong className={o.payment === 'upi_test' ? 'text-emerald-700' : 'text-slate-800'}>
                      {o.payment === 'upi_test' ? 'UPI (Paid Online)' : 'Cash on Delivery'}
                    </strong>
                  </div>

                  {/* Order Items to Pick */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Items to Pick & Pack:
                    </div>
                    <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                      {activeItems.length === 0 ? (
                        <div className="text-xs text-slate-400">No approved items</div>
                      ) : (
                        activeItems.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-slate-800 font-medium">
                              {item.name}
                            </span>
                            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                              × {item.qty}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Regulatory Hard Gate Warning */}
                  {isAwaiting && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <strong>Regulatory Gate Active:</strong> Schedule H/H1 item requires verification. Pharmacist approval is required before invoice or packing.
                      </div>
                    </div>
                  )}

                  {isOnHold && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-900">
                      <strong>On Hold:</strong> Customer requested to upload a clearer prescription.
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="p-4 bg-slate-50/80 border-t border-slate-100">
                  {isAwaiting && (
                    <button
                      disabled
                      className="w-full py-2 bg-slate-200 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed text-center"
                    >
                      Awaiting Pharmacist Check
                    </button>
                  )}

                  {isApproved && (
                    <button
                      onClick={() => handlePack(o.code)}
                      className="w-full py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Package className="w-4 h-4" />
                      Pack & Enter Store Invoice
                    </button>
                  )}

                  {isPacked && (
                    <button
                      onClick={() => handleDispatch(o.code)}
                      className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Truck className="w-4 h-4" />
                      Hand Over to Delivery Partner
                    </button>
                  )}

                  {isDispatched && (
                    <div className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <strong>Dispatched:</strong> {o.delivery_partner || 'Local Courier'}
                        <div className="text-[11px] text-emerald-700">Invoice: {o.invoice_no || 'Recorded'}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pack Modal */}
      {packModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-700" />
              Pack Order {packModal.code}
            </h3>
            <p className="text-xs text-slate-600">
              Enter the billing software invoice number for this packed order.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store Invoice Number *</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-84920"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPackModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitPack}
                className="px-4 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg shadow-sm transition-colors"
              >
                Confirm Packed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-700" />
              Hand Over to Delivery Partner
            </h3>
            <p className="text-xs text-slate-600">
              Confirm courier or store delivery executive dispatching order {dispatchModal.code}.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Courier / Delivery Partner</label>
              <input
                type="text"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="Courier name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDispatchModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDispatch}
                className="px-4 py-2 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-lg shadow-sm transition-colors"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
