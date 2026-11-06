'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Language, translate } from '../../lib/i18n';
import { btnQuiet, choice, label } from './ui';

export const AREAS = [
  { value: 'Park Street', key: 'area_park' },
  { value: 'Salt Lake', key: 'area_saltlake' },
  { value: 'Behala', key: 'area_behala' },
  { value: 'Howrah', key: 'area_howrah' },
];

const RELATION_KEYS: Record<string, string> = {
  Mother: 'rel_mother',
  Father: 'rel_father',
  Spouse: 'rel_spouse',
  Child: 'rel_child',
  Grandparent: 'rel_grandparent',
};

// "Mother" the person, relation "Mother": say it once
const showRelation = (pr: any) => !!pr.relation && pr.relation !== 'Self' && pr.relation !== pr.name;

interface Props {
  lang: Language;
  profiles: any[];
  forName: string;
  area: string;
  payment: string;
  onForName: (v: string) => void;
  onArea: (v: string) => void;
  onPayment: (v: string) => void;
  onAddPerson: () => void;
}

/** Who it is for, where it goes, how it is paid. Shared by the prescription form and the cart. */
export default function DeliveryOptions(p: Props) {
  const t = (k: string) => translate(k, p.lang);

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className={label}>{t('for_whom')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {p.profiles.map((pr) => (
            <button
              key={pr.id}
              type="button"
              role="radio"
              aria-checked={p.forName === pr.name}
              onClick={() => p.onForName(pr.name)}
              className={choice(p.forName === pr.name)}
            >
              <span className="block">{pr.name}</span>
              {(showRelation(pr) || pr.is_minor) && (
                <span className="block text-base font-normal text-slate-500">
                  {showRelation(pr) ? t(RELATION_KEYS[pr.relation] || '') || pr.relation : ''}
                  {showRelation(pr) && pr.is_minor ? ' · ' : ''}
                  {pr.is_minor ? t('minor_tag') : ''}
                </span>
              )}
            </button>
          ))}
        </div>
        <button type="button" onClick={p.onAddPerson} className={btnQuiet}>
          <Plus className="h-5 w-5" aria-hidden="true" />
          {t('add_person')}
        </button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={label}>{t('delivery_area')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {AREAS.map((a) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={p.area === a.value}
              onClick={() => p.onArea(a.value)}
              className={choice(p.area === a.value)}
            >
              {t(a.key)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={label}>{t('payment')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'cod', text: t('cod') },
            { value: 'upi_test', text: t('upi_test') },
          ].map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={p.payment === m.value}
              onClick={() => p.onPayment(m.value)}
              className={choice(p.payment === m.value)}
            >
              {m.text}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
