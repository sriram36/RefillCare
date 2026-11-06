'use client';

import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Language, translate } from '../../lib/i18n';
import { fetchApi, postApi } from '../../lib/api';
import DeliveryOptions from './DeliveryOptions';
import { btnPrimary, btnQuiet, card, input, medName, medPack } from './ui';

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
  onToast: (msg: string) => void;
  onOrdered: () => void;
}

interface CartLine {
  id: number;
  name: string;
  price: number;
  qty: number;
}

export default function MedicineSearch(p: Props) {
  const t = (k: string, vars?: Record<string, string | number>) => translate(k, p.lang, vars);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placing, setPlacing] = useState(false);

  const search = async (value: string) => {
    setTerm(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      setResults(await fetchApi(`search?term=${encodeURIComponent(value)}`));
    } catch (err: any) {
      p.onToast(err.message || t('try_again'));
    }
  };

  const add = (m: any) =>
    setCart((c) =>
      c.some((x) => x.id === m.id)
        ? c.map((x) => (x.id === m.id ? { ...x, qty: x.qty + 1 } : x))
        : [...c, { id: m.id, name: m.name, price: m.price, qty: 1 }]
    );

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const place = async () => {
    setPlacing(true);
    try {
      await postApi('cart', {
        for_name: p.forName,
        payment: p.payment,
        area: p.area,
        lines: cart.map((c) => ({ med_id: c.id, qty: c.qty })),
      });
      setCart([]);
      p.onToast(t('order_placed'));
      p.onOrdered();
    } catch (err: any) {
      p.onToast(err.message || t('try_again'));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <section className={`${card} space-y-6`} aria-label={t('find_med')}>
      <h2 className="text-xl font-bold text-slate-900">{t('find_med')}</h2>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={term}
          onChange={(e) => search(e.target.value)}
          placeholder={t('search_ph')}
          aria-label={t('search_title')}
          className={`${input} pl-12`}
        />
      </div>

      {results.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
          {results.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-slate-900">{medName(m.name)}</div>
                <div className="text-base text-slate-500">
                  {medPack(m.name)}
                  {medPack(m.name) ? ' · ' : ''}₹{m.price}
                </div>
              </div>
              {m.rule === 'ok' ? (
                <button
                  type="button"
                  onClick={() => add(m)}
                  className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-teal-700 px-4 text-base font-semibold text-teal-700 hover:bg-teal-50"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  {t('add_cart')}
                </button>
              ) : (
                <span className="max-w-[9rem] shrink-0 text-right text-base text-slate-500">
                  {m.rule === 'rx' ? t('needs_rx') : t('not_online')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {cart.length > 0 && (
        <div className="space-y-6 rounded-xl bg-stone-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">{t('cart_title')}</h3>
            <button type="button" onClick={() => setCart([])} className={btnQuiet}>
              {t('clear_cart')}
            </button>
          </div>
          <ul className="space-y-2 text-lg">
            {cart.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>
                  {medName(c.name)} × {c.qty}
                </span>
                <span className="font-semibold">₹{c.price * c.qty}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-bold">
            <span>{t('total')}</span>
            <span>₹{total}</span>
          </div>

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

          <button type="button" onClick={place} disabled={placing} className={btnPrimary}>
            {t('place_order')}
          </button>
        </div>
      )}
    </section>
  );
}
