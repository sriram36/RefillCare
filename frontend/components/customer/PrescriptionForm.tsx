'use client';

import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Language, translate } from '../../lib/i18n';
import { fetchApi } from '../../lib/api';
import DeliveryOptions from './DeliveryOptions';
import { btnPrimary, btnSecondary, card, label } from './ui';

interface Props {
  lang: Language;
  user: any;
  profiles: any[];
  forName: string;
  area: string;
  payment: string;
  onForName: (v: string) => void;
  onArea: (v: string) => void;
  onPayment: (v: string) => void;
  onAddPerson: () => void;
  onToast: (msg: string) => void;
  onSent: () => void;
}

const SAMPLES = [
  { id: 'clean', key: 'sample_clean' },
  { id: 'handwritten', key: 'sample_handwritten' },
  { id: 'blurry', key: 'sample_blurry' },
  { id: 'h1', key: 'sample_h1' },
  { id: 'schedx', key: 'sample_schedx' },
];

export default function PrescriptionForm(p: Props) {
  const t = (k: string, vars?: Record<string, string | number>) => translate(k, p.lang, vars);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sample, setSample] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !sample) {
      p.onToast(t('pick_photo_err'));
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('for_name', p.forName || p.user.name);
      fd.append('payment', p.payment);
      fd.append('area', p.area);
      fd.append('demo', sample);
      if (file) fd.append('file', file);
      await fetchApi('orders', { method: 'POST', body: fd });
      p.onToast(t('sent_toast'));
      setFile(null);
      setSample('');
      p.onSent();
    } catch (err: any) {
      p.onToast(err.message || t('try_again'));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-7`} aria-label={t('send_rx')}>
      <h2 className="text-xl font-bold text-slate-900">{t('send_rx')}</h2>

      <DeliveryOptions
        lang={p.lang}
        profiles={p.profiles}
        forName={p.forName}
        area={p.area}
        payment={p.payment}
        onForName={p.onForName}
        onArea={p.onArea}
        onPayment={p.onPayment}
        onAddPerson={p.onAddPerson}
      />

      <div className="space-y-3">
        <span className={label}>{t('rx_photo')}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          aria-label={t('rx_photo')}
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setSample('');
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className={btnSecondary}>
          {file ? <CheckCircle2 className="h-6 w-6 text-teal-700" aria-hidden="true" /> : <Camera className="h-6 w-6" aria-hidden="true" />}
          <span className="truncate">{file ? file.name : t('rx_pick')}</span>
        </button>
        {file && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-base font-semibold text-teal-700 underline underline-offset-4"
          >
            {t('rx_change')}
          </button>
        )}
      </div>

      <details className="rounded-xl border border-dashed border-slate-300 p-4" open={!!sample}>
        <summary className="cursor-pointer text-base font-medium text-slate-600">{t('sample_title')}</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sample === s.id}
              onClick={() => {
                setSample(sample === s.id ? '' : s.id);
                setFile(null);
              }}
              className={`min-h-[2.75rem] rounded-lg border px-3 text-base font-medium ${
                sample === s.id
                  ? 'border-teal-700 bg-teal-50 text-teal-900 ring-2 ring-teal-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t(s.key)}
            </button>
          ))}
        </div>
      </details>

      <div className="space-y-3">
        <button type="submit" disabled={sending || (!file && !sample)} className={btnPrimary}>
          {sending ? t('sending') : t('send')}
        </button>
        <p className="flex items-start gap-2 text-base text-slate-600">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
          {t('rx_safety_note')}
        </p>
      </div>
    </form>
  );
}
