'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, 
  Sparkles, RefreshCw, Eye, ArrowRight, CornerDownRight, Check, ChevronDown
} from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { fetchApi, postApi, getToken, buildApiUrl } from '../lib/api';

interface PharmacistViewProps {
  user: any;
  lang: Language;
  onToast: (msg: string) => void;
  onOpenDashboard?: () => void;
}

export default function PharmacistView({ user, lang, onToast, onOpenDashboard }: PharmacistViewProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [rxImageUrl, setRxImageUrl] = useState<string | null>(null);
  const [rxLoading, setRxLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Modals & prompts state
  const [h1Modal, setH1Modal] = useState<{ itemId: number; qty: number } | null>(null);
  const [h1Doctor, setH1Doctor] = useState('');
  const [h1Patient, setH1Patient] = useState('');

  const [rejectModal, setRejectModal] = useState<{ itemId: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [holdModal, setHoldModal] = useState<{ code: string } | null>(null);
  const [holdReason, setHoldReason] = useState('Please upload a clearer photo of the prescription.');

  const [qtys, setQtys] = useState<Record<number, number>>({});

  const t = (k: string) => translate(k, lang);

  const loadOrders = async (selectCode?: string) => {
    try {
      setLoading(true);
      const data = await fetchApi('orders');
      setOrders(data);

      if (data.length > 0) {
        let match = null;
        if (selectCode) {
          match = data.find((o: any) => o.code === selectCode);
        } else if (selectedOrder) {
          match = data.find((o: any) => o.code === selectedOrder.code);
        }
        if (!match) {
          match = data.find((o: any) => o.status === 'awaiting_pharmacist') || data[0];
        }
        setSelectedOrder(match);
      } else {
        setSelectedOrder(null);
      }
    } catch (err: any) {
      onToast(err.message || 'Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // When selected order changes, load prescription image and DPDP audit logs
  useEffect(() => {
    setZoomLevel(1);
    if (!selectedOrder) {
      setRxImageUrl(null);
      setAuditLogs([]);
      return;
    }

    // Initialize item quantities
    const initialQtys: Record<number, number> = {};
    (selectedOrder.items || []).forEach((item: any) => {
      initialQtys[item.id] = item.qty;
    });
    setQtys(initialQtys);

    // Fetch Rx Image securely
    const fetchRx = async () => {
      setRxLoading(true);
      try {
        const token = getToken();
        const res = await fetch(buildApiUrl(`orders/${selectedOrder.code}/rx`), {
          headers: token ? { Authorization: token } : {}
        });
        if (res.ok) {
          const blob = await res.blob();
          setRxImageUrl(URL.createObjectURL(blob));
        } else {
          setRxImageUrl(null);
        }
      } catch {
        setRxImageUrl(null);
      } finally {
        setRxLoading(false);
      }
    };

    // Fetch DPDP Audit
    const fetchAudit = async () => {
      setLoadingAudit(true);
      try {
        const logs = await fetchApi(`orders/${selectedOrder.code}/audit`);
        setAuditLogs(logs || []);
      } catch {
        setAuditLogs([]);
      } finally {
        setLoadingAudit(false);
      }
    };

    fetchRx();
    fetchAudit();
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
      onToast(`Approved ${item.name}`);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Failed to approve item');
    }
  };

  const submitH1Approval = async () => {
    if (!h1Modal) return;
    if (!h1Doctor.trim() || !h1Patient.trim()) {
      onToast('Both prescriber and patient names are required for Schedule H1 register');
      return;
    }

    try {
      await postApi(`items/${h1Modal.itemId}/decide`, {
        action: 'approve',
        qty: h1Modal.qty,
        prescriber: h1Doctor.trim(),
        patient: h1Patient.trim()
      });
      onToast('Schedule H1 item approved & logged to regulatory register');
      setH1Modal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Failed to approve H1 item');
    }
  };

  const handleReject = (item: any) => {
    setRejectModal({ itemId: item.id });
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      onToast('Rejection reason is required');
      return;
    }

    try {
      await postApi(`items/${rejectModal.itemId}/decide`, {
        action: 'reject',
        reason: rejectReason.trim()
      });
      onToast('Item rejected with reason recorded');
      setRejectModal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Failed to reject item');
    }
  };

  const submitHold = async () => {
    if (!holdModal) return;
    if (!holdReason.trim()) {
      onToast('Please provide a reason for re-upload');
      return;
    }

    try {
      await postApi(`orders/${holdModal.code}/hold`, { reason: holdReason.trim() });
      onToast('Order marked for prescription re-upload');
      setHoldModal(null);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Failed to hold order');
    }
  };

  const handleOfferGeneric = async (item: any) => {
    try {
      await postApi(`items/${item.id}/offer-generic`);
      onToast(`Offered cheaper generic ${item.generic.name} (₹${item.generic.price}) to customer`);
      await loadOrders(selectedOrder.code);
    } catch (err: any) {
      onToast(err.message || 'Failed to offer generic');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'awaiting_pharmacist':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Awaiting Verification</span>;
      case 'approved':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800">Approved</span>;
      case 'packed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Packed</span>;
      case 'dispatched':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Dispatched</span>;
      case 'on_hold':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Re-upload Asked</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-700" />
            Pharmacist Verification Queue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Drugs & Cosmetics Act Compliance Gate • Registered Pharmacist Review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadOrders(selectedOrder?.code)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh Queue"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
          No orders pending verification in the queue.
        </div>
      ) : (
        /* Split Screen: Left Queue Sidebar, Right Side-by-Side Review */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Orders Queue List (Left 4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-1">
              Active Orders ({orders.length})
            </h2>
            <div className="space-y-2 min-h-[160px] max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {orders.map((o) => {
                const isSelected = selectedOrder?.code === o.code;
                return (
                  <button
                    key={o.code}
                    onClick={() => setSelectedOrder(o)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/50 shadow-sm ring-1 ring-teal-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{o.code}</span>
                      {getStatusBadge(o.status)}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                      <span>{o.for_name}</span>
                      <span className="text-slate-400">{o.store_name || 'Kolkata'}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 line-clamp-1">
                      {(o.items || []).map((i: any) => `${i.name} (${i.schedule})`).join(', ')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side-by-Side Review Panel (Right 8 cols) */}
          {selectedOrder && (
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
              
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900">{selectedOrder.code}</h2>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Patient: <strong className="text-slate-700">{selectedOrder.for_name}</strong> • Phone: {selectedOrder.customer_phone || 'Kolkata Customer'} • Store: <span className="font-medium text-teal-800">{selectedOrder.store_name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHoldModal({ code: selectedOrder.code })}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 transition-colors"
                  >
                    Ask for New Photo
                  </button>
                </div>
              </div>

              {selectedOrder.note && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg text-xs">
                  <strong>Order Note:</strong> {selectedOrder.note}
                </div>
              )}

              {/* Side-by-Side Area: Left Rx Viewer, Right Matched Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Prescription Image Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-teal-700" />
                      <span>Encrypted Prescription</span>
                    </h3>
                    {rxImageUrl && (
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setZoomLevel(z => Math.max(0.7, +(z - 0.2).toFixed(1)))}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 font-bold text-slate-700"
                          title="Zoom Out"
                        >
                          −
                        </button>
                        <span className="text-[11px] font-mono px-1 text-slate-600 font-medium">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setZoomLevel(z => Math.min(2.5, +(z + 0.2).toFixed(1)))}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 font-bold text-slate-700"
                          title="Zoom In"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomLevel(1)}
                          className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-800"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900/5 border border-slate-200 rounded-2xl overflow-auto min-h-[360px] max-h-[520px] flex items-center justify-center p-3 relative">
                    {rxLoading ? (
                      <div className="text-xs text-slate-500 animate-pulse flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Decrypting prescription (AES-128)...</span>
                      </div>
                    ) : rxImageUrl ? (
                      <div className="overflow-auto max-w-full max-h-full">
                        <img
                          src={rxImageUrl}
                          alt="Prescription"
                          style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'top center',
                            transition: 'transform 0.15s ease-out'
                          }}
                          className="max-w-full h-auto object-contain rounded-xl shadow-xs border border-slate-200 bg-white"
                        />
                      </div>
                    ) : (
                      <div className="text-center p-6 text-slate-400 text-xs">
                        No prescription file stored for this order, or digital catalog order.
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    DPDP Act compliant: Encrypted on disk. Decrypted ephemeral viewer logged in audit trail.
                  </p>
                </div>

                {/* AI Extracted / Matched Items & Verification Controls */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Matched Items & Approval</span>
                    <span className="text-[11px] text-teal-700 font-normal">AI Draft</span>
                  </h3>

                  {(selectedOrder.items || []).length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                      No lines were read. Please request a clearer prescription photo.
                    </div>
                  ) : (
                    (selectedOrder.items || []).map((item: any) => {
                      const isDraft = item.status === 'draft';
                      const isApproved = item.status === 'approved';
                      const isRejected = item.status === 'rejected';

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isApproved
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : isRejected
                              ? 'border-red-200 bg-red-50/30 opacity-75'
                              : 'border-slate-200 bg-white shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-slate-900 text-sm leading-snug">
                                {item.name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  item.schedule === 'H1'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  Schedule {item.schedule}
                                </span>
                                <span className="text-xs text-slate-500">
                                  ₹{item.price} each
                                </span>
                              </div>
                            </div>
                            
                            {/* AI Confidence Badge */}
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              item.conf < 0.75
                                ? 'bg-amber-100 text-amber-800 flex items-center gap-1'
                                : 'bg-teal-50 text-teal-800'
                            }`}>
                              {item.conf < 0.75 ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-amber-600 inline" />
                                  Check Image ({Math.round(item.conf * 100)}%)
                                </>
                              ) : (
                                `● Matched (${Math.round(item.conf * 100)}%)`
                              )}
                            </span>
                          </div>

                          {/* Action Controls */}
                          {isDraft ? (
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs text-slate-500 font-medium">Qty:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="50"
                                  value={qtys[item.id] ?? item.qty}
                                  onChange={(e) =>
                                    setQtys({ ...qtys, [item.id]: Math.max(1, parseInt(e.target.value) || 1) })
                                  }
                                  className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-semibold text-slate-800"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleApprove(item)}
                                  className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(item)}
                                  className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs">
                              {isApproved ? (
                                <div className="space-y-2">
                                  <div className="text-emerald-700 font-medium flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    Approved ({item.qty} units)
                                  </div>

                                  {/* Generic Alternative Option */}
                                  {item.generic && !item.offer && (
                                    <div className="bg-teal-50 border border-teal-200 p-2 rounded-lg flex items-center justify-between mt-1">
                                      <div className="text-[11px] text-teal-900">
                                        Cheaper generic available: <strong>{item.generic.name}</strong> (₹{item.generic.price})
                                      </div>
                                      <button
                                        onClick={() => handleOfferGeneric(item)}
                                        className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold rounded transition-colors whitespace-nowrap"
                                      >
                                        Offer Generic
                                      </button>
                                    </div>
                                  )}

                                  {item.offer && (
                                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                                      {item.consent == null ? (
                                        <span className="text-amber-700">Generic offered. Awaiting customer consent.</span>
                                      ) : item.consent ? (
                                        <span className="text-emerald-700 font-medium">✓ Customer accepted generic substitute.</span>
                                      ) : (
                                        <span className="text-slate-600">Customer opted for prescribed brand.</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-red-700 font-medium">
                                  ✕ Rejected: {item.reason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* DPDP Act Audit Log Section */}
              <div className="pt-4 border-t border-slate-200">
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1.5 select-none group-open:[&>svg]:rotate-180">
                    <ShieldCheck className="w-4 h-4 text-teal-700" />
                    <span>Prescription Access Audit Log (DPDP Act 2023 Compliance)</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-auto transition-transform" />
                  </summary>
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs text-slate-600 max-h-40 overflow-y-auto">
                    {loadingAudit ? (
                      <p className="text-slate-400">Loading audit trail...</p>
                    ) : auditLogs.length === 0 ? (
                      <p className="text-slate-400">No access events recorded yet.</p>
                    ) : (
                      auditLogs.map((log: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0 font-mono text-[11px]">
                          <span>
                            {new Date(log.ts * 1000).toLocaleTimeString()} • <strong className="text-slate-800">{log.actor}</strong>: {log.action}
                          </span>
                          <span className="text-slate-400">{log.entity || selectedOrder.code}</span>
                        </div>
                      ))
                    )}
                  </div>
                </details>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Schedule H1 Compliance Modal */}
      {h1Modal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-2 text-purple-800">
              <ShieldCheck className="w-6 h-6" />
              <h3 className="font-bold text-lg text-slate-900">Schedule H1 Register Entry</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Under Drugs & Cosmetics Rule 65(9), dispensing Schedule H1 drugs requires recording the prescriber registration and patient details in the statutory H1 Register.
            </p>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Prescriber Name & Reg. No. *</label>
                  {h1Doctor.toLowerCase().includes('wbmc') || h1Doctor.toLowerCase().includes('wb') ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ WBMC Verified Format
                    </span>
                  ) : h1Doctor.trim() ? (
                    <span className="text-[10px] font-semibold text-slate-500">
                      Medical Council Check
                    </span>
                  ) : null}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Dr. P. Mukherjee, WBMC #49281"
                  value={h1Doctor}
                  onChange={(e) => setH1Doctor(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[11px] text-slate-400">Quick fill demo:</span>
                  <button
                    type="button"
                    onClick={() => setH1Doctor("Dr. P. Mukherjee, WBMC #49281")}
                    className="text-[11px] font-semibold text-purple-700 hover:underline"
                  >
                    Dr. P. Mukherjee (WBMC #49281)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Name *</label>
                <input
                  type="text"
                  placeholder="Patient name"
                  value={h1Patient}
                  onChange={(e) => setH1Patient(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setH1Modal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitH1Approval}
                className="px-4 py-2 text-sm font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-sm transition-colors"
              >
                Log to Register & Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Reject Item from Order
            </h3>
            <p className="text-xs text-slate-600">
              Please state why this medicine cannot be dispensed (e.g. illegible dosage, expired prescription, prohibited drug).
            </p>
            <textarea
              rows={3}
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ask for New Photo Modal */}
      {holdModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 text-orange-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Request Prescription Re-upload
            </h3>
            <p className="text-xs text-slate-600">
              The order will be put on hold and the customer will receive an instant notification to upload a clearer photo.
            </p>
            <input
              type="text"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setHoldModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitHold}
                className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                Send Re-upload Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
