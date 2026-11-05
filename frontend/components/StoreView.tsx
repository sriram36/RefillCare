'use client';

import React, { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle2, Clock, AlertTriangle, RefreshCw, FileText, ArrowRightLeft, Plus } from 'lucide-react';
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
  const [storeTab, setStoreTab] = useState<'orders' | 'transfers'>('orders');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [reqMedId, setReqMedId] = useState(1);
  const [reqQty, setReqQty] = useState(10);
  const [fromStoreId, setFromStoreId] = useState(1);

  const t = (k: string) => translate(k, lang);

  const loadTransfers = async () => {
    try {
      const data = await fetchApi('transfers');
      setTransfers(data || []);
    } catch {
      setTransfers([]);
    }
  };

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
    loadTransfers();
  }, []);

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await postApi('transfers/request', {
        to_store_id: user?.store_id || 1,
        from_store_id: Number(fromStoreId),
        med_id: Number(reqMedId),
        qty: Number(reqQty),
      });
      onToast('Stock transfer requested from Central Warehouse / store');
      setShowTransferModal(false);
      loadTransfers();
    } catch (err: any) {
      onToast(err.message || 'Failed to request transfer');
    }
  };

  const handleFulfillTransfer = async (tid: number) => {
    try {
      await postApi(`transfers/${tid}/fulfill`);
      onToast('Stock transfer dispatched and inventory updated');
      loadTransfers();
      loadOrders();
    } catch (err: any) {
      onToast(err.message || 'Failed to fulfill transfer');
    }
  };

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
        <div className="flex items-center gap-2">
          {/* Sub-tab Pill Navigation */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStoreTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                storeTab === 'orders' ? 'bg-white text-teal-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fulfillment Queue ({orders.length})
            </button>
            <button
              onClick={() => { setStoreTab('transfers'); loadTransfers(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                storeTab === 'transfers' ? 'bg-white text-teal-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Stock Transfers ({transfers.filter(t => t.status === 'requested').length})
            </button>
          </div>

          <button
            onClick={() => { loadOrders(); loadTransfers(); }}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {storeTab === 'transfers' ? (
        /* Inter-Store Stock Transfers View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-teal-700" />
                Inter-Store & Central Warehouse Requisitions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Transfer inventory between neighborhood locations and Central Warehouse to prevent customer drop-off.
              </p>
            </div>
            <button
              onClick={() => setShowTransferModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Request Stock Transfer
            </button>
          </div>

          {transfers.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
              No stock transfers recorded yet. Use the button above to request stock from the Central Warehouse.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transfers.map((tr) => (
                <div key={tr.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{tr.med_name || 'Prescription Medicine'}</h4>
                      <span className="text-xs text-slate-500">Qty: <strong className="text-slate-800">{tr.qty} units</strong></span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      tr.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'
                    }`}>
                      {tr.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">From:</span>
                      <strong className="text-slate-700">{tr.from_store || 'Central Warehouse'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">To:</span>
                      <strong className="text-teal-800">{tr.to_store || 'Local Store'}</strong>
                    </div>
                  </div>

                  {tr.status === 'requested' && (
                    <button
                      onClick={() => handleFulfillTransfer(tr.id)}
                      className="w-full py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-xs transition"
                    >
                      Dispatch & Update Inventory
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading && orders.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-sm font-semibold text-slate-700">Loading store orders…</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            (Render backend cold-start may take up to 45s on first wake-up)
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="p-4 rounded-full bg-emerald-50">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-base">Queue is clear — well done!</p>
            <p className="text-sm text-slate-500 mt-1">
              No orders are currently routed to your store.<br />
              New orders will appear here automatically.
            </p>
          </div>
          <button
            onClick={loadOrders}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
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
                      {o.status.replace(/_/g, ' ')}
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

      {/* Stock Transfer Request Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-teal-700" />
              Request Inter-Store Stock Requisition
            </h3>
            <p className="text-xs text-slate-500">
              When a local store is stock-constrained, request immediate stock transfer from the Central Warehouse or neighboring Kolkata stores.
            </p>

            <form onSubmit={handleRequestTransfer} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Source Store / Hub</label>
                <select
                  value={fromStoreId}
                  onChange={(e) => setFromStoreId(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  <option value={1}>Salt Lake Hub #1 (Central Stock)</option>
                  <option value={2}>Behala Store #2</option>
                  <option value={3}>Howrah Maidan Store #3</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Required Medicine</label>
                <select
                  value={reqMedId}
                  onChange={(e) => setReqMedId(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  <option value={1}>Metformin 500 mg, strip of 15</option>
                  <option value={2}>Telmisartan 40 mg, strip of 10</option>
                  <option value={3}>Levothyroxine 50 mcg, bottle of 100</option>
                  <option value={4}>Atorvastatin 10 mg, strip of 15</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity Needed</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={reqQty}
                  onChange={(e) => setReqQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700 font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white rounded-xl shadow-xs transition"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
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
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Courier / Delivery Partner *</label>
              <input
                type="text"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="Courier name"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Store Staff Express',
                  'Bluedart Healthcare',
                  'Local Courier',
                  'Shadowfax Express'
                ].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCourier(p)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                      courier === p
                        ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
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
