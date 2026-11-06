'use client';

import React, { useRef, useState } from 'react';
import { AlertTriangle, Camera, CreditCard, Tag } from 'lucide-react';
import { Language, translate } from '../../lib/i18n';
import { fetchApi, postApi } from '../../lib/api';
import Timeline from '../Timeline';
import { btnPrimary, btnSecondary, card, DEFAULT_NOTES, medName } from './ui';

interface Props {
  order: any;
  lang: Language;
  onToast: (msg: string) => void;
  onChanged: () => void;
}

export default function OrderCard({ order: o, lang, onToast, onChanged }: Props) {
  const t = (k: string, vars?: Record<string, string | number>) => translate(k, lang, vars);
  const fileRef = useRef<HTMLInputElement>(null);
  const [paying, setPaying] = useState(false);
  const [sending, setSending] = useState(false);

  // One sentence a worried person can read at a glance
  const statusLine = (() => {
    switch (o.status) {
      case 'awaiting_pharmacist':
        return t('st_awaiting');
      case 'on_hold':
        return t('st_on_hold');
      case 'approved':
        return o.store ? t('st_approved', { store: o.store }) : t('st_approved_nostore');
      case 'packed':
        return t('st_packed', { store: o.store || '' });
      case 'dispatched':
        return t('st_dispatched', { partner: o.delivery_partner || '' });
      case 'rejected':
        return t('st_rejected');
      default:
        return o.status;
    }
  })();

  const canPay = o.paid !== 1 && o.payment !== 'upi_test' && !['rejected', 'on_hold'].includes(o.status);
  const showNote = o.status === 'on_hold' && o.note && !DEFAULT_NOTES.includes(o.note);

  const payNow = async () => {
    setPaying(true);
    try {
      // The server confirms the payment itself in test mode. The browser can no longer say "paid".
      await postApi(`orders/${o.code}/pay`);
      const res = await postApi(`orders/${o.code}/pay/confirm`);
      onToast(t('paid_toast', { n: res.amount_rupees }));
      onChanged();
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    } finally {
      setPaying(false);
    }
  };

  const reupload = async (file?: File, sample?: string) => {
    setSending(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      fd.append('demo', sample || '');
      await fetchApi(`orders/${o.code}/reupload`, { method: 'POST', body: fd });
      onToast(t('sent_toast'));
      onChanged();
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    } finally {
      setSending(false);
    }
  };

  const answerGeneric = async (itemId: number, accept: boolean) => {
    try {
      await postApi(`items/${itemId}/consent`, { accept });
      onToast(accept ? t('generic_accepted_toast') : t('generic_kept_toast'));
      onChanged();
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    }
  };

  return (
    <article className={`${card} space-y-5`} aria-label={o.code}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-xl font-bold text-slate-900">{o.code}</h3>
        <span className="text-base text-slate-600">{t('order_for', { name: o.for_name })}</span>
      </header>

      <p className="text-lg text-slate-900">{statusLine}</p>

      <Timeline status={o.status} lang={lang} />

      {o.status === 'on_hold' && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-start gap-2 text-base font-medium text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              {showNote ? (
                <>
                  <strong>{t('note_lbl')}:</strong> {o.note}
                </>
              ) : (
                t('st_on_hold')
              )}
            </span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label={t('rx_photo')}
            onChange={(e) => e.target.files?.[0] && reupload(e.target.files[0])}
          />
          <button type="button" disabled={sending} onClick={() => fileRef.current?.click()} className={btnPrimary}>
            <Camera className="h-6 w-6" aria-hidden="true" />
            {sending ? t('sending') : t('upload_new')}
          </button>
          <details className="text-base text-slate-700">
            <summary className="cursor-pointer font-medium">{t('sample_title')}</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ['clean', 'sample_clean'],
                ['handwritten', 'sample_handwritten'],
              ].map(([id, key]) => (
                <button
                  key={id}
                  type="button"
                  disabled={sending}
                  onClick={() => reupload(undefined, id)}
                  className="min-h-[2.75rem] rounded-lg border border-slate-300 bg-white px-3 font-medium hover:bg-slate-50"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}

      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {(o.items || []).map((item: any) => (
          <li key={item.id} className="space-y-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-lg text-slate-900">
                {medName(item.name)} × {item.qty}
              </span>
              {item.status === 'rejected' && (
                <span className="text-right text-base font-medium text-rose-700">{item.reason}</span>
              )}
            </div>

            {item.offer_med && item.consent == null && (
              <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
                <p className="flex items-center gap-2 text-lg font-semibold text-teal-900">
                  <Tag className="h-5 w-5" aria-hidden="true" />
                  {t('generic_offer_title')}
                </p>
                <p className="text-base text-slate-800">
                  {t('generic_offer_body', {
                    generic: medName(item.offer_med.name),
                    price: item.offer_med.price,
                    orig: medName(item.name),
                    save: (item.price - item.offer_med.price) * item.qty,
                  })}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => answerGeneric(item.id, true)} className={btnPrimary}>
                    {t('accept')}
                  </button>
                  <button type="button" onClick={() => answerGeneric(item.id, false)} className={btnSecondary}>
                    {t('keep_original')}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {o.total_savings > 0 && (
        <p className="text-lg font-semibold text-teal-800">{t('savings', { n: o.total_savings })}</p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-base text-slate-600">
        <span>{o.paid === 1 || o.payment === 'upi_test' ? t('paid_lbl') : t('cod')}</span>
        {canPay && (
          <button
            type="button"
            onClick={payNow}
            disabled={paying}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-teal-700 px-4 text-base font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-60"
          >
            <CreditCard className="h-5 w-5" aria-hidden="true" />
            {paying ? t('paying') : t('pay_online')}
          </button>
        )}
      </footer>
    </article>
  );
}
