'use client';

import React, { useRef, useState } from 'react';
import { AlertTriangle, Camera, CreditCard, Tag } from 'lucide-react';
import { Language, translate } from '../../lib/i18n';
import { fetchApi, postApi } from '../../lib/api';
import Timeline from '../Timeline';
import PayModal from './PayModal';
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
  const [showPay, setShowPay] = useState(false);
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

  const checked = ['approved', 'packed', 'dispatched'].includes(o.status); // a pharmacist has signed it off
  const canPay = o.paid !== 1 && o.payment !== 'upi_test' && !['rejected', 'on_hold'].includes(o.status);
  const showNote = o.status === 'on_hold' && o.note && !DEFAULT_NOTES.includes(o.note);

  // what the customer would pay: every line that was not rejected
  const amount = (o.items || [])
    .filter((i: any) => i.status !== 'rejected')
    .reduce((sum: number, i: any) => sum + i.price * i.qty, 0);

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
    <article className={`${card} relative space-y-5`} aria-label={o.code}>
      {checked && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 -rotate-6 whitespace-pre-line rounded-md border-2 border-double border-teal-700/70 px-2 py-0.5 text-center text-[0.65rem] font-bold leading-tight text-teal-800/80 mix-blend-multiply"
        >
          {t('stamp_checked')}
        </span>
      )}
      <header className={`min-w-0 ${checked ? 'pr-24' : ''}`}>
        <h3 className="text-xl text-slate-900">
          {(o.items || [])
            .filter((i: any) => i.status !== 'rejected')
            .map((i: any) => medName(i.name))
            .join(', ') || o.code}
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {t('order_for', { name: o.for_name })} · {o.code}
        </p>
      </header>

      <p className="text-base text-slate-800">{statusLine}</p>

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
            <Camera className="h-5 w-5" aria-hidden="true" />
            {sending ? t('sending') : t('upload_new')}
          </button>
          <details className="text-sm text-slate-700">
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
                  className="min-h-[2.5rem] rounded-lg border border-stone-300 bg-white px-3 font-medium hover:bg-stone-50"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}

      <ul className="divide-y divide-stone-100 border-t border-stone-100">
        {(o.items || []).map((item: any) => (
          <li key={item.id} className="space-y-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-medium text-slate-900">
                {medName(item.name)} × {item.qty}
              </span>
              {item.status === 'rejected' && (
                <span className="text-right text-sm font-medium text-rose-700">{item.reason}</span>
              )}
            </div>

            {item.offer_med && item.consent == null && (
              <div className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-4">
                <p className="flex items-center gap-2 text-base font-semibold text-teal-900">
                  <Tag className="h-4 w-4" aria-hidden="true" />
                  {t('generic_offer_title')}
                </p>
                <p className="text-sm text-slate-800">
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
        <p className="text-base font-semibold text-teal-800">{t('savings', { n: o.total_savings })}</p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 text-sm text-slate-600">
        {o.paid === 1 || o.payment === 'upi_test' ? (
          <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 font-semibold text-teal-800">{t('paid_lbl')}</span>
        ) : (
          <span>{t('cod')}</span>
        )}
        {canPay && amount > 0 && (
          <button
            type="button"
            onClick={() => setShowPay(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-teal-700 px-3.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50"
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            {t('pay_online')}
          </button>
        )}
      </footer>

      {showPay && (
        <PayModal
          lang={lang}
          code={o.code}
          amount={amount}
          onClose={() => setShowPay(false)}
          onError={onToast}
          onPaid={(n) => {
            setShowPay(false);
            onToast(t('paid_toast', { n }));
            onChanged();
          }}
        />
      )}
    </article>
  );
}
