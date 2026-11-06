'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowLeft, Bell, RefreshCw, Upload } from 'lucide-react';
import { fetchApi, postApi, buildApiUrl, getToken } from '../lib/api';
import { translate, type Language } from '../lib/i18n';

interface DashboardViewProps {
  lang: Language;
  onToast: (msg: string) => void;
  onBackToQueue?: () => void;
}

const LOCALE: Record<Language, string> = { en: 'en-IN', bn: 'bn-IN', hi: 'hi-IN' };

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

interface DayCount {
  day: string;
  orders: number;
}

/** 'YYYY-MM-DD' to a short date such as "14 Oct", in the chosen language. */
function shortDay(day: string, locale: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function OrdersPerDayChart({ days, locale, t }: { days: DayCount[]; locale: string; t: (k: string, vars?: Record<string, string | number>) => string }) {
  const max = Math.max(0, ...days.map((d) => d.orders));
  const total = days.reduce((s, d) => s + d.orders, 0);
  const busiest = max > 0 ? days.findIndex((d) => d.orders === max) : days.length - 1;
  const todayIdx = days.length - 1;
  const aria = t('db_chart_aria', { total, day: shortDay(days[busiest].day, locale), n: max });

  return (
    <section className={`${card} space-y-4`} aria-labelledby="perday-h">
      <div>
        <h2 id="perday-h" className="text-xl font-bold text-slate-900">
          {t('db_chart_title')}
        </h2>
        <p className="text-base text-slate-600">{t('db_chart_sub')}</p>
      </div>
      <div role="img" aria-label={aria}>
        <div className="flex h-36 items-end gap-1 border-b border-slate-200 pt-6" aria-hidden="true">
          {days.map((d, i) => {
            const showValue = max > 0 && (i === busiest || i === todayIdx);
            return (
              <div key={d.day} className="relative flex h-full min-w-0 flex-1 items-end">
                <div
                  className={`relative w-full rounded-t ${i === todayIdx ? 'bg-teal-900' : 'bg-teal-700'}`}
                  style={{ height: `${max > 0 ? (d.orders / max) * 100 : 0}%`, minHeight: 3 }}
                >
                  {showValue && (
                    <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-sm font-semibold leading-none text-slate-800">{d.orders}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex h-5 gap-1 text-sm text-slate-600" aria-hidden="true">
          {days.map((d, i) => (
            <div key={d.day} className="relative min-w-0 flex-1">
              {i % 7 === 0 && <span className="absolute left-0 top-0 whitespace-nowrap">{shortDay(d.day, locale)}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function DashboardView({ lang, onToast, onBackToQueue }: DashboardViewProps) {
  const t = (k: string, vars?: Record<string, string | number>) => translate(k, lang, vars);
  const locale = LOCALE[lang] || LOCALE.en;

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockFile, setStockFile] = useState<File | null>(null);
  const [uploadingStock, setUploadingStock] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);

  const loadDashboard = async () => {
    try {
      setData(await fetchApi('dashboard'));
    } catch (err: any) {
      onToast(err.message || t('db_err_load'));
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
      onToast(t('db_err_choose_csv'));
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
      if (!res.ok) throw new Error(body.detail || t('db_err_stock'));
      onToast(t('db_toast_stock', { n: body.rows }));
      setStockFile(null);
      await loadDashboard();
    } catch (err: any) {
      onToast(err.message || t('db_err_stock'));
    } finally {
      setUploadingStock(false);
    }
  };

  const handleRunReminders = async () => {
    try {
      setRunningReminders(true);
      const res = await postApi('reminders/run');
      onToast(res.sent === 0 ? t('db_toast_no_reminders') : res.sent === 1 ? t('db_toast_reminders_one', { n: res.sent }) : t('db_toast_reminders_many', { n: res.sent }));
      await loadDashboard();
    } catch (err: any) {
      onToast(err.message || t('db_err_reminders'));
    } finally {
      setRunningReminders(false);
    }
  };

  if (loading && !data) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-lg text-slate-600" role="status">
        {t('db_loading')}
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
  const ordersPerDay: DayCount[] = data?.orders_per_day || [];
  const outbox: any[] = data?.outbox || [];
  const schedule: { automatic: boolean; hour: number; last_run: number | null } | null = data?.reminder_schedule || null;
  const stampFormat: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
  const stockNote = t('db_stockfile_note').split('{cols}');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {onBackToQueue && (
            <button onClick={onBackToQueue} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label={t('db_back_queue')}>
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('db_tab_all')}</h1>
            <p className="text-base text-slate-600">{t('db_subtitle')}</p>
          </div>
        </div>
        <button onClick={loadDashboard} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label={t('db_refresh')}>
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t('db_stat_median')}
          value={median === null ? '—' : median}
          unit={median === null ? undefined : t('db_unit_min')}
          note={median === null ? t('db_stat_median_none') : median < target ? t('db_stat_median_under', { n: target }) : t('db_stat_median_over', { n: target })}
          tone={median === null ? undefined : median < target ? 'ok' : 'warn'}
        />
        <Stat label={t('db_stat_waiting')} value={data?.awaiting_now ?? 0} unit={t('db_unit_orders')} />
        <Stat label={t('db_stat_progress')} value={overview.active_orders} unit={t('db_unit_of', { n: overview.total_orders })} />
        <Stat
          label={t('db_stat_breach')}
          value={breaches}
          note={breaches === 0 ? t('db_stat_breach_none') : t('db_stat_breach_some')}
          tone={breaches === 0 ? 'ok' : 'warn'}
        />
      </div>

      {ordersPerDay.length > 0 && <OrdersPerDayChart days={ordersPerDay} locale={locale} t={t} />}

      <section className={`${card} space-y-4`} aria-labelledby="stores-h">
        <h2 id="stores-h" className="text-xl font-bold text-slate-900">
          {t('db_stores_title')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-base">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-3 pr-4 font-semibold">{t('db_col_store')}</th>
                <th className="px-3 py-3 text-center font-semibold">{t('db_col_orders')}</th>
                <th className="px-3 py-3 text-center font-semibold">{t('db_col_checking')}</th>
                <th className="px-3 py-3 text-center font-semibold">{t('db_col_approved')}</th>
                <th className="px-3 py-3 text-center font-semibold">{t('db_col_packed')}</th>
                <th className="px-3 py-3 text-center font-semibold">{t('db_col_handed')}</th>
                <th className="py-3 pl-3 text-right font-semibold">{t('db_col_stock')}</th>
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
                        {t('db_low_n', { n: s.low_stock_count })}
                      </span>
                    ) : (
                      <span className="text-slate-600">{t('db_stock_ok')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {notRouted > 0 && (
                <tr>
                  <th scope="row" className="py-3 pr-4 font-semibold text-slate-700">
                    {t('db_not_routed')}
                  </th>
                  <td className="px-3 py-3 text-center">{notRouted}</td>
                  <td colSpan={5} className="py-3 pl-3 text-slate-600">
                    {t('db_not_routed_note')}
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
            {t('db_rej_title')} {totalRejected > 0 && <span className="text-slate-500">({totalRejected})</span>}
          </h2>
          {rejections.length === 0 ? (
            <p className="text-base text-slate-600">{t('db_rej_none')}</p>
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
            {t('db_low_title')}
          </h2>
          {lowStock.length === 0 ? (
            <p className="text-base text-slate-600">{t('db_low_none')}</p>
          ) : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {lowStock.map((item: any, idx: number) => (
                <li key={idx} className="flex items-baseline justify-between gap-3 py-3 text-base">
                  <span>
                    <strong className="text-slate-900">{(item.med_name || '').split(',')[0]}</strong>
                    <span className="block text-slate-600">{item.store_name}</span>
                  </span>
                  <span className="shrink-0 font-bold text-rose-700">{t('db_left_n', { n: item.qty })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`${card} space-y-4`} aria-labelledby="h1-h">
        <h2 id="h1-h" className="text-xl font-bold text-slate-900">
          {t('db_h1_title')}
        </h2>
        {register.length === 0 ? (
          <p className="text-base text-slate-600">{t('db_h1_none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-base">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-3 pr-4 font-semibold">{t('db_col_order')}</th>
                  <th className="px-3 py-3 font-semibold">{t('db_col_prescriber')}</th>
                  <th className="px-3 py-3 font-semibold">{t('db_col_patient')}</th>
                  <th className="py-3 pl-3 text-right font-semibold">{t('db_col_packs')}</th>
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
            {t('db_stockfile_title')}
          </h2>
          <p className="text-base text-slate-600">
            {stockNote[0]}
            <code className="rounded bg-stone-100 px-1.5 py-0.5">store_id,med_id,qty</code>
            {stockNote[1]}
          </p>
          <input
            type="file"
            accept=".csv"
            aria-label={t('db_stockfile_aria')}
            onChange={(e) => setStockFile(e.target.files?.[0] || null)}
            className="block w-full text-base text-slate-700 file:mr-3 file:h-11 file:rounded-xl file:border file:border-slate-300 file:bg-white file:px-4 file:text-base file:font-semibold file:text-slate-900"
          />
          <button type="submit" disabled={uploadingStock || !stockFile} className={btnPrimary}>
            <Upload className="h-5 w-5" aria-hidden="true" />
            {uploadingStock ? t('db_uploading') : t('db_upload')}
          </button>
        </form>

        <div className={`${card} flex flex-col justify-between gap-4`}>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">{t('db_rem_title')}</h2>
            {schedule?.automatic ? (
              <>
                <p className="text-base text-slate-600">{t('db_rem_auto', { hour: schedule.hour })}</p>
                <p className="text-base text-slate-600">
                  {schedule.last_run ? t('db_rem_last', { time: new Date(schedule.last_run * 1000).toLocaleString(locale, stampFormat) }) : t('db_rem_never')}
                </p>
              </>
            ) : (
              <>
                <p className="text-base text-slate-600">{t('db_rem_manual')}</p>
                <p className="text-base text-slate-600">{t('db_rem_manual_press')}</p>
              </>
            )}
          </div>
          <button onClick={handleRunReminders} disabled={runningReminders} className={btnSecondary}>
            <Bell className="h-5 w-5" aria-hidden="true" />
            {runningReminders ? t('db_rem_sending') : t('db_rem_send')}
          </button>
        </div>
      </div>

      <section className={`${card} space-y-3`} aria-labelledby="msg-h">
        <div>
          <h2 id="msg-h" className="text-xl font-bold text-slate-900">
            {t('db_msg_title')}
          </h2>
          <p className="text-base text-slate-600">{t('db_msg_note')}</p>
        </div>
        {outbox.length === 0 ? (
          <p className="text-base text-slate-600">{t('db_msg_none')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {outbox.map((m: any, idx: number) => (
              <li key={idx} className="py-3 text-base">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-slate-500">{new Date(m.ts * 1000).toLocaleString(locale, stampFormat)}</span>
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-sm font-semibold text-slate-700">{m.channel}</span>
                  <span className="font-semibold text-slate-900">{m.to}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-slate-700">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} space-y-3`} aria-labelledby="audit-h">
        <h2 id="audit-h" className="text-xl font-bold text-slate-900">
          {t('db_audit_title')}
        </h2>
        {audit.length === 0 ? (
          <p className="text-base text-slate-600">{t('db_audit_none')}</p>
        ) : (
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {audit.map((entry: any, idx: number) => (
              <li key={idx} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5 text-base">
                <span>
                  <span className="text-slate-500">{new Date(entry.ts * 1000).toLocaleTimeString(locale)}</span>{' '}
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
