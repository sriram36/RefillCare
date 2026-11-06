'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowLeft, Bell, RefreshCw, Upload } from 'lucide-react';
import { fetchApi, postApi, buildApiUrl, getToken } from '../lib/api';

interface DashboardViewProps {
  onToast: (msg: string) => void;
  onBackToQueue?: () => void;
}

const card = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6';
const btnPrimary = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60';
const btnSecondary = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60';

function Stat({ label, value, unit, note, tone }: { label: string; value: React.ReactNode; unit?: string; note?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={card}>
      <p className="text-base font-semibold text-slate-600">{label}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-slate-900">{value}</span>
        {unit && <span className="text-base text-slate-600">{unit}</span>}
      </p>
      {note && (
        <p className={`mt-2 text-base font-medium ${tone === 'warn' ? 'text-rose-700' : tone === 'ok' ? 'text-teal-800' : 'text-slate-600'}`}>{note}</p>
      )}
    </div>
  );
}

export default function DashboardView({ onToast, onBackToQueue }: DashboardViewProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockFile, setStockFile] = useState<File | null>(null);
  const [uploadingStock, setUploadingStock] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);

  const loadDashboard = async () => {
    try {
      setData(await fetchApi('dashboard'));
    } catch (err: any) {
      onToast(err.message || 'Could not load the dashboard.');
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
      onToast('Choose a stock CSV first.');
      return;
    }
    try {
      setUploadingStock(true);
      const formData = new FormData();
      formData.append('file', stockFile);
      const token = getToken();
      const res = await fetch(buildApiUrl('stock'), {
        method: 'POST',
        headers: token ? { Authorization: token } : {},
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'The stock file was not accepted.');
      onToast(`Stock updated: ${body.rows} rows.`);
      setStockFile(null);
      await loadDashboard();
    } catch (err: any) {
      onToast(err.message || 'The stock file was not accepted.');
    } finally {
      setUploadingStock(false);
    }
  };

  const handleRunReminders = async () => {
    try {
      setRunningReminders(true);
      const res = await postApi('reminders/run');
      onToast(res.sent === 0 ? 'No new reminders today.' : `${res.sent} reminder${res.sent === 1 ? '' : 's'} sent.`);
      await loadDashboard();
    } catch (err: any) {
      onToast(err.message || 'Could not send reminders.');
    } finally {
      setRunningReminders(false);
    }
  };

  if (loading && !data) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-lg text-slate-600" role="status">
        Loading the dashboard…
      </p>
    );
  }

  const overview = data?.network_overview || { total_stores: 0, active_orders: 0, total_orders: 0 };
  const target = data?.verify_target_min ?? 10;
  const median: number | null = data?.median_verify_min ?? null;
  const storesSummary: any[] = data?.stores_summary || [];
  const lowStock: any[] = data?.low_stock_alerts || [];
  const register: any[] = data?.register || [];
  const audit: any[] = data?.audit || [];
  const rejections: [string, number][] = Object.entries(data?.rejections || {}).sort((a: any, b: any) => b[1] - a[1]) as any;
  const totalRejected = rejections.reduce((s, [, n]) => s + n, 0);
  const notRouted = data?.by_store?.['Not routed'] || 0;
  const breaches = data?.unapproved_dispatches ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {onBackToQueue && (
            <button onClick={onBackToQueue} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label="Back to the queue">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">All stores</h1>
            <p className="text-base text-slate-600">Orders, verification time and rejections across the network.</p>
          </div>
        </div>
        <button onClick={loadDashboard} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label="Refresh">
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Median verification"
          value={median === null ? '—' : median}
          unit={median === null ? undefined : 'min'}
          note={median === null ? 'No verified orders yet' : median < target ? `Under the ${target}-minute target` : `Over the ${target}-minute target`}
          tone={median === null ? undefined : median < target ? 'ok' : 'warn'}
        />
        <Stat label="Waiting for a pharmacist" value={data?.awaiting_now ?? 0} unit="orders" />
        <Stat label="Orders in progress" value={overview.active_orders} unit={`of ${overview.total_orders}`} />
        <Stat
          label="Sent without approval"
          value={breaches}
          note={breaches === 0 ? 'None. Every packed item was approved.' : 'Investigate now.'}
          tone={breaches === 0 ? 'ok' : 'warn'}
        />
      </div>

      <section className={`${card} space-y-4`} aria-labelledby="stores-h">
        <h2 id="stores-h" className="text-xl font-bold text-slate-900">
          Orders by store
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-base">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-3 pr-4 font-semibold">Store</th>
                <th className="px-3 py-3 text-center font-semibold">Orders</th>
                <th className="px-3 py-3 text-center font-semibold">Checking</th>
                <th className="px-3 py-3 text-center font-semibold">Approved</th>
                <th className="px-3 py-3 text-center font-semibold">Packed</th>
                <th className="px-3 py-3 text-center font-semibold">Handed over</th>
                <th className="py-3 pl-3 text-right font-semibold">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {storesSummary.map((s: any) => (
                <tr key={s.id}>
                  <th scope="row" className="py-3 pr-4 font-semibold text-slate-900">
                    {s.name}
                  </th>
                  <td className="px-3 py-3 text-center">{s.total_orders}</td>
                  <td className="px-3 py-3 text-center">{s.awaiting}</td>
                  <td className="px-3 py-3 text-center">{s.approved}</td>
                  <td className="px-3 py-3 text-center">{s.packed}</td>
                  <td className="px-3 py-3 text-center">{s.dispatched}</td>
                  <td className="py-3 pl-3 text-right">
                    {s.low_stock_count > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        {s.low_stock_count} low
                      </span>
                    ) : (
                      <span className="text-slate-600">OK</span>
                    )}
                  </td>
                </tr>
              ))}
              {notRouted > 0 && (
                <tr>
                  <th scope="row" className="py-3 pr-4 font-semibold text-slate-700">
                    Not routed yet
                  </th>
                  <td className="px-3 py-3 text-center">{notRouted}</td>
                  <td colSpan={5} className="py-3 pl-3 text-slate-600">
                    Still being checked, or no single store has every item.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} space-y-4`} aria-labelledby="rej-h">
          <h2 id="rej-h" className="text-xl font-bold text-slate-900">
            Rejections {totalRejected > 0 && <span className="text-slate-500">({totalRejected})</span>}
          </h2>
          {rejections.length === 0 ? (
            <p className="text-base text-slate-600">No medicines rejected yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rejections.map(([reason, n]) => (
                <li key={reason} className="flex items-baseline justify-between gap-3 py-3 text-base">
                  <span className="text-slate-900">{reason}</span>
                  <span className="shrink-0 font-bold text-slate-900">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} space-y-4`} aria-labelledby="low-h">
          <h2 id="low-h" className="text-xl font-bold text-slate-900">
            Low stock (5 or fewer)
          </h2>
          {lowStock.length === 0 ? (
            <p className="text-base text-slate-600">Every store is above the limit.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {lowStock.map((item: any, idx: number) => (
                <li key={idx} className="flex items-baseline justify-between gap-3 py-3 text-base">
                  <span>
                    <strong className="text-slate-900">{(item.med_name || '').split(',')[0]}</strong>
                    <span className="block text-slate-600">{item.store_name}</span>
                  </span>
                  <span className="shrink-0 font-bold text-rose-700">{item.qty} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`${card} space-y-4`} aria-labelledby="h1-h">
        <h2 id="h1-h" className="text-xl font-bold text-slate-900">
          Schedule H1 register
        </h2>
        {register.length === 0 ? (
          <p className="text-base text-slate-600">No Schedule H1 medicines sold yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-base">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-3 pr-4 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Prescriber</th>
                  <th className="px-3 py-3 font-semibold">Patient</th>
                  <th className="py-3 pl-3 text-right font-semibold">Packs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {register.map((reg: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{reg.order_code}</td>
                    <td className="px-3 py-3">{reg.prescriber}</td>
                    <td className="px-3 py-3">{reg.patient}</td>
                    <td className="py-3 pl-3 text-right">{reg.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={handleStockUpload} className={`${card} space-y-4`} aria-labelledby="stock-h">
          <h2 id="stock-h" className="text-xl font-bold text-slate-900">
            Daily stock file
          </h2>
          <p className="text-base text-slate-600">
            A CSV with the columns <code className="rounded bg-stone-100 px-1.5 py-0.5">store_id,med_id,qty</code>. Orders are routed from these counts.
          </p>
          <input
            type="file"
            accept=".csv"
            aria-label="Stock CSV file"
            onChange={(e) => setStockFile(e.target.files?.[0] || null)}
            className="block w-full text-base text-slate-700 file:mr-3 file:h-11 file:rounded-xl file:border file:border-slate-300 file:bg-white file:px-4 file:text-base file:font-semibold file:text-slate-900"
          />
          <button type="submit" disabled={uploadingStock || !stockFile} className={btnPrimary}>
            <Upload className="h-5 w-5" aria-hidden="true" />
            {uploadingStock ? 'Uploading…' : 'Upload stock'}
          </button>
        </form>

        <div className={`${card} flex flex-col justify-between gap-4`}>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Refill reminders</h2>
            <p className="text-base text-slate-600">
              Messages customers whose medicine runs out within 5 days, in their own language. Each person gets one a day.
            </p>
          </div>
          <button onClick={handleRunReminders} disabled={runningReminders} className={btnSecondary}>
            <Bell className="h-5 w-5" aria-hidden="true" />
            {runningReminders ? 'Sending…' : 'Send today’s reminders'}
          </button>
        </div>
      </div>

      <section className={`${card} space-y-3`} aria-labelledby="audit-h">
        <h2 id="audit-h" className="text-xl font-bold text-slate-900">
          Recent activity
        </h2>
        {audit.length === 0 ? (
          <p className="text-base text-slate-600">Nothing recorded yet.</p>
        ) : (
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {audit.map((entry: any, idx: number) => (
              <li key={idx} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5 text-base">
                <span>
                  <span className="text-slate-500">{new Date(entry.ts * 1000).toLocaleTimeString()}</span>{' '}
                  <strong className="text-slate-900">{entry.actor}</strong> <span className="text-slate-700">{entry.action}</span>
                </span>
                <span className="text-slate-600">{entry.entity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
