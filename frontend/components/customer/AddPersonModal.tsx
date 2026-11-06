'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Language, translate } from '../../lib/i18n';
import { postApi } from '../../lib/api';
import { btnPrimary, btnSecondary, choice, input, label } from './ui';

interface Props {
  lang: Language;
  onClose: () => void;
  onAdded: (name: string) => void;
  onToast: (msg: string) => void;
}

// Values are what the server stores; labels are shown in the customer's language.
const RELATIONS = [
  { value: 'Self', key: 'rel_self' },
  { value: 'Mother', key: 'rel_mother' },
  { value: 'Father', key: 'rel_father' },
  { value: 'Spouse', key: 'rel_spouse' },
  { value: 'Child', key: 'rel_child' },
  { value: 'Grandparent', key: 'rel_grandparent' },
];

export default function AddPersonModal({ lang, onClose, onAdded, onToast }: Props) {
  const t = (k: string, vars?: Record<string, string | number>) => translate(k, lang, vars);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('Mother');
  const [minor, setMinor] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onToast(t('name_needed'));
    if (minor && !guardian) return onToast(t('guardian_needed'));
    setSaving(true);
    try {
      await postApi('profiles', {
        name: name.trim(),
        relation,
        is_minor: minor,
        guardian_consent: guardian,
      });
      onToast(t('person_added', { name: name.trim() }));
      onAdded(name.trim());
    } catch (err: any) {
      onToast(err.message || t('try_again'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t('add_person')}
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-md space-y-6 overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{t('add_person')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="person-name" className={label}>
            {t('full_name')}
          </label>
          <input
            id="person-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input}
            autoComplete="off"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className={label}>{t('relation_lbl')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {RELATIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={relation === r.value}
                onClick={() => setRelation(r.value)}
                className={choice(relation === r.value)}
              >
                {t(r.key)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3">
          <label className="flex min-h-[3rem] cursor-pointer items-center gap-3 text-lg text-slate-900">
            <input
              type="checkbox"
              checked={minor}
              onChange={(e) => setMinor(e.target.checked)}
              className="h-6 w-6 accent-teal-700"
            />
            {t('minor_lbl')}
          </label>
          {minor && (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-base text-amber-950">{t('guardian_note')}</p>
              <label className="flex cursor-pointer items-start gap-3 text-base font-medium text-amber-950">
                <input
                  type="checkbox"
                  checked={guardian}
                  onChange={(e) => setGuardian(e.target.checked)}
                  className="mt-1 h-6 w-6 shrink-0 accent-teal-700"
                />
                {t('guardian_decl')}
              </label>
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('cancel')}
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
