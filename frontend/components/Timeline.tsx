'use client';

import React from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { Language, translate } from '../lib/i18n';

interface TimelineProps {
  status: string;
  lang: Language;
}

/** Four steps joined by a line. Stays inside a 390px screen: no horizontal scrolling. */
export default function Timeline({ status, lang }: TimelineProps) {
  const t = (k: string) => translate(k, lang);

  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
        <X className="h-4 w-4" aria-hidden="true" />
        {t('status_rejected')}
      </div>
    );
  }

  const held = status === 'on_hold';
  const steps = [
    { label: t('tl_placed'), done: true, current: false },
    { label: t('tl_check'), done: ['approved', 'packed', 'dispatched'].includes(status), current: status === 'awaiting_pharmacist' || held },
    { label: t('tl_packed'), done: ['packed', 'dispatched'].includes(status), current: status === 'approved' },
    { label: t('tl_way'), done: status === 'dispatched', current: status === 'packed' },
  ];

  return (
    <ol className="grid grid-cols-4" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={i} className="relative flex flex-col items-center gap-1.5 text-center">
          {/* the line runs from the middle of the previous step to the middle of this one */}
          {i > 0 && (
            <span
              aria-hidden="true"
              className={`absolute left-[-50%] top-[13px] h-0.5 w-full ${s.done ? 'bg-teal-600' : 'bg-stone-300'}`}
            />
          )}
          <span
            className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              s.done
                ? 'bg-teal-600 text-white'
                : s.current && held
                ? 'bg-marigold-500 text-white'
                : s.current
                ? 'border-2 border-teal-600 bg-white text-teal-700'
                : 'border border-stone-300 bg-stone-50 text-slate-400'
            }`}
          >
            {s.done ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : s.current && held ? (
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              i + 1
            )}
          </span>
          <span className={`px-0.5 text-[0.8125rem] leading-tight ${s.done || s.current ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
