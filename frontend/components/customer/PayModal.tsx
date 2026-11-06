'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Language, translate } from '../../lib/i18n';
import { postApi } from '../../lib/api';
import { btnPrimary, btnSecondary } from './ui';

interface Props {
  lang: Language;
  code: string;
  amount: number;
  onClose: () => void;
  onPaid: (amount: number) => void;
  onError: (message: string) => void;
}

/** A dummy payment screen. It looks like a UPI payment, but nothing real happens behind it. */
export default function PayModal({ lang, code, amount, onClose, onPaid, onError }: Props) {
  const t = (k: string, vars?: Record<string, string | number>) => translate(k, lang, vars);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !paying && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, paying]);

  const pay = async () => {
    setPaying(true);
    try {
      await new Promise((r) => setTimeout(r, 900)); // a moment of "processing", so it feels like a payment
      const res = await postApi(`orders/${code}/pay`);
      onPaid(res.amount_rupees);
    } catch (err: any) {
      onError(err.message || t('try_again'));
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pay_title')}
        className="w-full max-w-md space-y-6 rounded-t-2xl bg-white p-6 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{t('pay_title')}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={paying}
            aria-label={t('close')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-xl bg-stone-50 p-5 text-center">
          <p className="text-base text-slate-600">{t('pay_amount')}</p>
          <p className="text-4xl font-bold text-slate-900">₹{amount}</p>
          <p className="mt-1 text-base text-slate-500">{code}</p>
        </div>

        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-base text-amber-950">{t('pay_demo_note')}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onClose} disabled={paying} className={btnSecondary}>
            {t('cancel')}
          </button>
          <button type="button" onClick={pay} disabled={paying} className={btnPrimary}>
            {paying ? t('paying') : t('pay_confirm', { n: amount })}
          </button>
        </div>
      </div>
    </div>
  );
}
