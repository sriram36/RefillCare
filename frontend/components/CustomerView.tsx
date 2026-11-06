'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, FileText, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { Language, translate } from '../lib/i18n';
import { fetchApi, postApi, setUser } from '../lib/api';
import AddPersonModal from './customer/AddPersonModal';
import MedicineSearch from './customer/MedicineSearch';
import OrderCard from './customer/OrderCard';
import PrescriptionForm from './customer/PrescriptionForm';
import { btnPrimary, btnQuiet, btnSecondary, card, medName } from './customer/ui';

interface CustomerViewProps {
  user: any;
  lang: Language;
  onToast: (msg: string) => void;
  /** Called after the account has been erased, so the app can return to the sign-in screen. */
  onErased?: () => void;
}

const OPEN = ['awaiting_pharmacist', 'on_hold', 'approved'];

export default function CustomerView({ user, lang, onToast, onErased }: CustomerViewProps) {
  const [refills, setRefills] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<'rx' | 'search' | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [busyRefill, setBusyRefill] = useState<number | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);

  // shared by the prescription form and the cart
  const [forName, setForName] = useState('');
  const [area, setArea] = useState('Park Street');
  const [payment, setPayment] = useState('cod');

  const t = (k: string, vars?: Record<string, string | number>) => translate(k, lang, vars);

  const load = useCallback(async () => {
    try {
      const [rf, os, pr, sb, nt] = await Promise.all([
        fetchApi('refills'),
        fetchApi('orders'),
        fetchApi('profiles'),
        fetchApi('subscriptions').catch(() => []),
        fetchApi('notes').catch(() => []),
      ]);
      setNotes(nt || []);
      setRefills(rf);
      setOrders(os);
      setProfiles(pr);
      setSubs((sb || []).filter((s: any) => s.active === 1));
      setForName((cur) => cur || (pr[0] ? pr[0].name : ''));
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // keep order status fresh without the customer having to refresh
    const timer = setInterval(() => {
      fetchApi('orders').then(setOrders).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const dueRefills = refills.filter((r) => r.due);

  // an open order for the same medicine and person means a second tap would only duplicate it
  const openOrderFor = (r: any) =>
    orders.find(
      (o) => OPEN.includes(o.status) && o.for_name === r.for_name && (o.items || []).some((i: any) => i.med_id === r.med_id)
    );
  const subFor = (r: any) => subs.find((s) => s.med_id === r.med_id && s.for_name === r.for_name);

  const reorder = async (r: any) => {
    setBusyRefill(r.id);
    try {
      const res = await postApi(`refills/${r.id}/reorder`);
      if (res.status === 'on_hold') {
        onToast(t('reorder_on_hold'));
        setForName(r.for_name);
        setPanel('rx');
      } else {
        onToast(t('reorder_sent'));
      }
      await load();
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    } finally {
      setBusyRefill(null);
    }
  };

  const turnOnAutoRefill = async (r: any) => {
    try {
      // the dose and pack come from the customer's own refill, so the schedule always matches the supply
      await postApi('subscriptions', {
        for_name: r.for_name,
        med_id: r.med_id,
        qty: r.qty,
        per_day: r.per_day,
        frequency_days: Math.min(90, Math.max(7, Math.round(r.qty / r.per_day))),
      });
      onToast(t('autorefill_done'));
      load();
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    }
  };

  const turnOffAutoRefill = async (id: number) => {
    try {
      await fetchApi(`subscriptions/${id}`, { method: 'DELETE' });
      onToast(t('autorefill_cancelled'));
      load();
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    }
  };

  const grantConsent = async () => {
    try {
      const res = await postApi('consent');
      user.consent_at = res.consent_at;
      setUser(user);
      load();
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    }
  };

  const eraseMyData = async () => {
    try {
      await postApi('me/forget');
      onToast(t('forget_done'));
      onErased?.();
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    }
  };

  const exportData = async () => {
    try {
      const data = await fetchApi('me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-health-data-${user.phone}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
        <p className="text-lg text-slate-700">{t('loading')}</p>
        <p className="max-w-xs text-base text-slate-500">{t('cold_start')}</p>
      </div>
    );
  }

  const optionProps = {
    lang,
    profiles,
    forName,
    area,
    payment,
    onForName: setForName,
    onArea: setArea,
    onPayment: setPayment,
    onAddPerson: () => setShowAddPerson(true),
  };

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold text-slate-900">{t('hello', { name: user.name.split(' ')[0] })}</h1>

      {!user.consent_at && (
        <section className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6" aria-labelledby="consent-h">
          <h2 id="consent-h" className="flex items-center gap-2 text-xl font-bold text-amber-950">
            <ShieldCheck className="h-6 w-6 shrink-0" aria-hidden="true" />
            {t('consent_title')}
          </h2>
          <p className="whitespace-pre-line text-lg text-amber-950">{t('consent_body')}</p>
          <button type="button" onClick={grantConsent} className={btnPrimary}>
            {t('consent_btn')}
          </button>
        </section>
      )}

      {notes.length > 0 && (
        <section className="space-y-3" aria-labelledby="msg-h">
          <h2 id="msg-h" className="text-xl font-bold text-slate-900">
            {t('messages')}
          </h2>
          <ul className="space-y-2">
            {notes.slice(0, 3).map((n, i) => (
              <li key={`${n.ts}-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-lg text-slate-900">{n.text}</p>
                <p className="mt-1 text-base text-slate-500">{new Date(n.ts * 1000).toLocaleDateString(lang === 'en' ? 'en-IN' : lang === 'bn' ? 'bn-IN' : 'hi-IN', { day: 'numeric', month: 'short' })}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The one thing most people come here to do */}
      <section className="space-y-4" aria-labelledby="low-h">
        <h2 id="low-h" className="text-xl font-bold text-slate-900">
          {t('low')}
        </h2>

        {dueRefills.length === 0 ? (
          <div className={`${card} flex items-start gap-3`}>
            <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-teal-700" aria-hidden="true" />
            <p className="text-lg text-slate-800">{t('no_low')}</p>
          </div>
        ) : (
          dueRefills.map((r) => {
            const open = openOrderFor(r);
            const sub = subFor(r);
            return (
              <div key={r.id} className={`${card} space-y-5`}>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{medName(r.name)}</p>
                  <p className="text-lg text-slate-600">{t('refill_for', { name: r.for_name, n: r.per_day })}</p>
                  <p className={`mt-1 text-lg font-semibold ${r.days_left <= 3 ? 'text-rose-700' : 'text-amber-800'}`}>
                    {r.days_left <= 0 ? t('runs_out_today') : t('runs_out_days', { n: r.days_left })}
                  </p>
                </div>

                {open ? (
                  <p className="rounded-xl bg-stone-100 px-4 py-4 text-lg font-medium text-slate-800" role="status">
                    {t('reorder_in_progress', { code: open.code })}
                  </p>
                ) : (
                  <button type="button" onClick={() => reorder(r)} disabled={busyRefill === r.id} className={btnPrimary}>
                    {t('reorder_btn')}
                  </button>
                )}

                {sub ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-base text-slate-700">
                    <span>{t('autorefill_on', { date: sub.next_refill })}</span>
                    <button type="button" onClick={() => turnOffAutoRefill(sub.id)} className={btnQuiet}>
                      {t('autorefill_off_btn')}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => turnOnAutoRefill(r)} className={btnQuiet}>
                    {t('autorefill_set')}
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Everything else is one tap away, not on the page by default */}
      <section className="space-y-4" aria-label={`${t('send_rx')} / ${t('find_med')}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            aria-expanded={panel === 'rx'}
            onClick={() => setPanel(panel === 'rx' ? null : 'rx')}
            className={btnSecondary}
          >
            <FileText className="h-6 w-6" aria-hidden="true" />
            {t('send_rx')}
          </button>
          <button
            type="button"
            aria-expanded={panel === 'search'}
            onClick={() => setPanel(panel === 'search' ? null : 'search')}
            className={btnSecondary}
          >
            <Search className="h-6 w-6" aria-hidden="true" />
            {t('find_med')}
          </button>
        </div>

        {panel === 'rx' && (
          <PrescriptionForm
            {...optionProps}
            user={user}
            onToast={onToast}
            onSent={() => {
              setPanel(null);
              load();
            }}
          />
        )}
        {panel === 'search' && (
          <MedicineSearch
            {...optionProps}
            onToast={onToast}
            onOrdered={() => {
              setPanel(null);
              load();
            }}
          />
        )}
      </section>

      <section className="space-y-4" aria-labelledby="orders-h">
        <h2 id="orders-h" className="text-xl font-bold text-slate-900">
          {t('orders')}
        </h2>
        {orders.length === 0 ? (
          <p className="text-lg text-slate-600">{t('no_orders')}</p>
        ) : (
          orders.map((o) => <OrderCard key={o.code} order={o} lang={lang} onToast={onToast} onChanged={load} />)
        )}
      </section>

      {subs.filter((s) => !refills.some((r) => r.due && r.med_id === s.med_id && r.for_name === s.for_name)).length > 0 && (
        <section className="space-y-3" aria-labelledby="auto-h">
          <h2 id="auto-h" className="text-xl font-bold text-slate-900">
            {t('autorefill_set')}
          </h2>
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {subs
              .filter((s) => !refills.some((r) => r.due && r.med_id === s.med_id && r.for_name === s.for_name))
              .map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <span className="text-lg">
                    <strong>{medName(s.med_name)}</strong> · {s.for_name}
                    <span className="block text-base text-slate-500">{t('autorefill_on', { date: s.next_refill })}</span>
                  </span>
                  <button type="button" onClick={() => turnOffAutoRefill(s.id)} className={btnQuiet}>
                    {t('autorefill_off_btn')}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      <footer className="space-y-4 border-t border-slate-200 pt-6">
        <p className="flex items-start gap-2 text-base text-slate-600">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
          {t('privacy_note')}
        </p>
        <button type="button" onClick={exportData} className={btnQuiet}>
          <Download className="h-5 w-5" aria-hidden="true" />
          {t('export_data')}
        </button>
        {!confirmErase ? (
          <button type="button" onClick={() => setConfirmErase(true)} className={btnQuiet}>
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            {t('forget_btn')}
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="erase-h" className="space-y-4 rounded-2xl border border-rose-300 bg-rose-50 p-5">
            <h2 id="erase-h" className="text-xl font-bold text-rose-950">
              {t('forget_title')}
            </h2>
            <p className="text-base text-rose-950">{t('forget_body')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setConfirmErase(false)} className={btnSecondary}>
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={eraseMyData}
                className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-rose-700 px-5 text-lg font-semibold text-white hover:bg-rose-800"
              >
                {t('forget_yes')}
              </button>
            </div>
          </div>
        )}
      </footer>

      {showAddPerson && (
        <AddPersonModal
          lang={lang}
          onClose={() => setShowAddPerson(false)}
          onToast={onToast}
          onAdded={(name) => {
            setForName(name);
            setShowAddPerson(false);
            load();
          }}
        />
      )}
    </div>
  );
}
