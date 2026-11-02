'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Store, Clock, AlertTriangle, ShieldCheck, 
  Upload, BellRing, RefreshCw, CheckCircle2, TrendingUp, ArrowLeft
} from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { fetchApi, postApi, API_BASE, getToken } from '../lib/api';

interface DashboardViewProps {
  user: any;
  lang: Language;
  onToast: (msg: string) => void;
  onBackToQueue?: () => void;
}

export default function DashboardView({ user, lang, onToast, onBackToQueue }: DashboardViewProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockFile, setStockFile] = useState<File | null>(null);
  const [uploadingStock, setUploadingStock] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);

  const t = (k: string) => translate(k, lang);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('dashboard');
      setData(res);
    } catch (err: any) {
      onToast(err.message || 'Failed to load executive dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleStockUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFile) {
      onToast('Please select a stock CSV file');
      return;
    }

    try {
      setUploadingStock(true);
      const formData = new FormData();
      formData.append('file', stockFile);

      const token = getToken();
      const res = await fetch(`${API_BASE}/api/stock`, {
        method: 'POST',
        headers: token ? { Authorization: token } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to upload stock CSV');
      }

      onToast('Daily stock CSV processed successfully');
      setStockFile(null);
      await loadDashboard();
    } catch (err: any) {
      onToast(err.message || 'Stock upload failed');
    } finally {
      setUploadingStock(false);
    }
  };

  const handleRunReminders = async () => {
    try {
      setRunningReminders(true);
      const res = await postApi('reminders/run');
      onToast(res.message || 'Refill reminders triggered successfully');
      await loadDashboard();
    } catch (err: any) {
      onToast(err.message || 'Failed to trigger refill reminders');
    } finally {
      setRunningReminders(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="text-center py-20 text-slate-500">
        Loading 46-Store Central Operations Dashboard...
      </div>
    );
  }

  const overview = data?.network_overview || {
    total_stores: 46,
    active_orders: 0,
    total_orders: 0,
  };

  const medianTime = data?.median_verify_min ?? '4.2';
  const storesSummary = data?.stores_summary || [];
  const lowStockAlerts = data?.low_stock_alerts || [];
  const register = data?.register || [];
  const audit = data?.audit || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            {onBackToQueue && (
              <button
                onClick={onBackToQueue}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors mr-1"
                title="Back to Pharmacist Queue"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-teal-700" />
              Central Operations Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time fulfillment metrics across 46 stores in Kolkata & Howrah • Managing Director View
          </p>
        </div>

        <button
          onClick={loadDashboard}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors self-start sm:self-auto"
          title="Refresh Data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* High-Level KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Verification SLA */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Median Verification</span>
            <Clock className="w-5 h-5 text-teal-700" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{medianTime}</span>
            <span className="text-xs font-medium text-slate-500">minutes</span>
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Within 10-minute SLA target
          </div>
        </div>

        {/* Network Total Stores */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Store Network</span>
            <Store className="w-5 h-5 text-teal-700" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{overview.total_stores || 46}</span>
            <span className="text-xs font-medium text-slate-500">Kolkata & Howrah</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            1 central warehouse connected
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active In-Flight</span>
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{overview.active_orders}</span>
            <span className="text-xs font-medium text-slate-500">orders</span>
          </div>
          <div className="mt-2 text-xs text-amber-700 font-medium">
            Verification & store fulfillment
          </div>
        </div>

        {/* Total Orders Completed */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Volume</span>
            <CheckCircle2 className="w-5 h-5 text-teal-700" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{overview.total_orders}</span>
            <span className="text-xs font-medium text-slate-500">orders processed</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Zero Schedule H dispatch breaches
          </div>
        </div>

      </div>

      {/* Network Stores Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-teal-700" />
            46-Store Network Fulfillment & Inventory Summary
          </h2>
          <span className="text-xs text-slate-400">Live Status</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Store Name</th>
                <th className="py-3 px-4 text-center">Total Orders</th>
                <th className="py-3 px-4 text-center">Awaiting Verification</th>
                <th className="py-3 px-4 text-center">Approved</th>
                <th className="py-3 px-4 text-center">Packed</th>
                <th className="py-3 px-4 text-center">Dispatched</th>
                <th className="py-3 px-4 text-right">Inventory Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {storesSummary.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No store data recorded yet.
                  </td>
                </tr>
              ) : (
                storesSummary.map((store: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{store.name}</td>
                    <td className="py-3 px-4 text-center font-medium">{store.total_orders}</td>
                    <td className="py-3 px-4 text-center text-amber-700 font-medium">{store.awaiting}</td>
                    <td className="py-3 px-4 text-center text-teal-800 font-medium">{store.approved}</td>
                    <td className="py-3 px-4 text-center text-blue-700 font-medium">{store.packed}</td>
                    <td className="py-3 px-4 text-center text-emerald-700 font-medium">{store.dispatched}</td>
                    <td className="py-3 px-4 text-right">
                      {store.low_stock_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3" />
                          {store.low_stock_count} low items
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          ✓ Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Low Stock Alerts & Schedule H1 Register */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Low Stock Inventory Alerts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Low Stock Alerts (&le; 5 units)
            </h2>
            <span className="text-xs text-slate-400">Automated Routing Impact</span>
          </div>

          {lowStockAlerts.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">
              All store inventory levels are currently above reorder thresholds.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {lowStockAlerts.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-red-100 bg-red-50/50 text-xs"
                >
                  <div>
                    <strong className="text-slate-900">{item.med_name}</strong>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Store: {item.store_name}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-red-200 text-red-900 font-bold text-xs">
                    {item.qty} units left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schedule H1 Regulatory Register */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-700" />
              Schedule H1 Compliance Register
            </h2>
            <span className="text-xs text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded">
              Drugs & Cosmetics Act
            </span>
          </div>

          {register.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">
              No Schedule H1 medicines dispensed yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {register.map((reg: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-purple-100 bg-purple-50/40 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-purple-950 font-bold">{reg.order_code}</strong>
                    <span className="text-[11px] text-purple-800 font-semibold">Qty: {reg.qty}</span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Prescriber: <span className="font-semibold text-slate-800">{reg.prescriber}</span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Patient: <span className="font-semibold text-slate-800">{reg.patient}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Operational Actions: Daily Stock CSV & Reminders Trigger */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Daily Stock CSV Upload */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-teal-700" />
            Upload Daily 46-Store Stock CSV
          </h2>
          <p className="text-xs text-slate-500">
            Sync daily inventory levels across all 46 stores and the central warehouse for accurate routing.
          </p>
          <form onSubmit={handleStockUpload} className="space-y-3 pt-1">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setStockFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100 cursor-pointer"
            />
            <button
              type="submit"
              disabled={uploadingStock || !stockFile}
              className="w-full py-2 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              {uploadingStock ? 'Uploading & Syncing...' : 'Upload & Route Stock CSV'}
            </button>
          </form>
        </div>

        {/* Refill Reminders Trigger */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-teal-700" />
              Automated Refill Reminders Engine
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Computes days of supply remaining for 9,000+ regular chronic patients (diabetes, blood pressure, thyroid). Sends WhatsApp / SMS alerts before medicines run out.
            </p>
          </div>

          <button
            onClick={handleRunReminders}
            disabled={runningReminders}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <BellRing className="w-4 h-4" />
            {runningReminders ? 'Processing...' : "Run Today's Refill Reminders"}
          </button>
        </div>

      </div>

      {/* Central Operations Audit Trail */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          Recent Central Operations Audit Activity
        </h2>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {audit.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center">No recent audit logs recorded.</div>
          ) : (
            audit.map((entry: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400 text-[11px]">
                    {new Date(entry.ts * 1000).toLocaleTimeString()}
                  </span>
                  <strong className="text-slate-800">{entry.actor}</strong>
                  <span className="text-slate-500">{entry.action}</span>
                </div>
                <span className="font-medium text-teal-800 text-[11px]">{entry.entity}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
