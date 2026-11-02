'use client';

import React from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { Language, translate } from '../lib/i18n';

interface TimelineProps {
  status: string;
  lang: Language;
}

export default function Timeline({ status, lang }: TimelineProps) {
  const t = (k: string) => translate(k, lang);

  if (status === 'rejected') {
    return (
      <div className="my-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white">
          <X className="h-3 w-3" />
        </span>
        <span>{t('step_placed')}</span>
        <span className="h-0.5 w-4 bg-red-300 dark:bg-red-800" />
        <span className="font-bold text-red-600">{t('status_rejected')}</span>
      </div>
    );
  }

  const isHold = status === 'on_hold';
  const s2Done = ['approved', 'packed', 'dispatched'].includes(status);
  const s2Active = status === 'awaiting_pharmacist';
  const s3Done = ['packed', 'dispatched'].includes(status);
  const s3Active = status === 'approved';
  const s4Done = status === 'dispatched';
  const s4Active = status === 'packed';
  const s5Done = status === 'dispatched';

  return (
    <div className="my-3 flex items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-xs dark:border-slate-800 dark:bg-slate-900/50">
      {/* Step 1: Placed */}
      <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-3 w-3" />
        </span>
        <span className="whitespace-nowrap">{t('step_placed')}</span>
      </div>

      <div className={`h-0.5 w-3.5 flex-shrink-0 ${s2Done ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`} />

      {/* Step 2: Verification */}
      <div
        className={`flex items-center gap-1.5 whitespace-nowrap font-medium ${
          s2Done
            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
            : isHold
            ? 'font-bold text-amber-600 dark:text-amber-400'
            : s2Active
            ? 'font-bold text-teal-700 dark:text-teal-400'
            : 'text-slate-400 dark:text-slate-600'
        }`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            s2Done
              ? 'bg-emerald-600 text-white'
              : isHold
              ? 'bg-amber-500 text-white ring-2 ring-amber-200'
              : s2Active
              ? 'bg-teal-700 text-white ring-2 ring-teal-200'
              : 'border border-slate-300 bg-white text-slate-500'
          }`}
        >
          {s2Done ? <Check className="h-3 w-3" /> : isHold ? <AlertCircle className="h-3 w-3" /> : '2'}
        </span>
        <span>{isHold ? t('status_on_hold') : t('step_review')}</span>
      </div>

      <div className={`h-0.5 w-3.5 flex-shrink-0 ${s3Done ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`} />

      {/* Step 3: Approved */}
      <div
        className={`flex items-center gap-1.5 whitespace-nowrap font-medium ${
          s3Done
            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
            : s3Active
            ? 'font-bold text-teal-700 dark:text-teal-400'
            : 'text-slate-400 dark:text-slate-600'
        }`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            s3Done
              ? 'bg-emerald-600 text-white'
              : s3Active
              ? 'bg-teal-700 text-white ring-2 ring-teal-200'
              : 'border border-slate-300 bg-white text-slate-500'
          }`}
        >
          {s3Done ? <Check className="h-3 w-3" /> : '3'}
        </span>
        <span>{t('step_approved')}</span>
      </div>

      <div className={`h-0.5 w-3.5 flex-shrink-0 ${s4Done ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`} />

      {/* Step 4: Packed */}
      <div
        className={`flex items-center gap-1.5 whitespace-nowrap font-medium ${
          s4Done
            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
            : s4Active
            ? 'font-bold text-teal-700 dark:text-teal-400'
            : 'text-slate-400 dark:text-slate-600'
        }`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            s4Done
              ? 'bg-emerald-600 text-white'
              : s4Active
              ? 'bg-teal-700 text-white ring-2 ring-teal-200'
              : 'border border-slate-300 bg-white text-slate-500'
          }`}
        >
          {s4Done ? <Check className="h-3 w-3" /> : '4'}
        </span>
        <span>{t('step_packed')}</span>
      </div>

      <div className={`h-0.5 w-3.5 flex-shrink-0 ${s5Done ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`} />

      {/* Step 5: Dispatched */}
      <div
        className={`flex items-center gap-1.5 whitespace-nowrap font-medium ${
          s5Done ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'
        }`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            s5Done ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-slate-500'
          }`}
        >
          {s5Done ? <Check className="h-3 w-3" /> : '5'}
        </span>
        <span>{t('step_dispatched')}</span>
      </div>
    </div>
  );
}
