'use client';

import React from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { Language, translate } from '../lib/i18n';

interface TimelineProps {
  status: string;
  lang: Language;
}

/** Four plain steps. Stays inside a 390px screen: no horizontal scrolling. */
export default function Timeline({ status, lang }: TimelineProps) {
  const t = (k: string) => translate(k, lang);

  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2 text-base font-semibold text-rose-700">
        <X className="h-5 w-5" aria-hidden="true" />
        {t('status_rejected')}
      </div>
    );
  }

  // steps are done when the order has moved past them
  const placed = true;
  const checked = ['approved', 'packed', 'dispatched'].includes(status);
  const packed = ['packed', 'dispatched'].includes(status);
  const way = status === 'dispatched';
  const held = status === 'on_hold';

  const steps = [
    { label: t('tl_placed'), done: placed, current: false },
    { label: t('tl_check'), done: checked, current: status === 'awaiting_pharmacist' || held },
    { label: t('tl_packed'), done: packed, current: status === 'approved' },
    { label: t('tl_way'), done: way, current: status === 'packed' },
  ];

  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-col items-center gap-1.5 text-center">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              s.done
                ? 'bg-teal-700 text-white'
                : s.current && held
                ? 'bg-amber-500 text-white'
                : s.current
                ? 'border-2 border-teal-700 bg-white text-teal-700'
                : 'border border-slate-300 bg-white text-slate-400'
            }`}
          >
            {s.done ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : s.current && held ? (
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
            ) : (
              i + 1
            )}
          </span>
          <span
            className={`text-sm leading-tight ${
              s.done || s.current ? 'font-semibold text-slate-900' : 'text-slate-500'
            }`}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
