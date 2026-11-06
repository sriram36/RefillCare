'use client';

import React, { useRef, useState } from 'react';
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

// The groups to browse. `value` is what the server stores; `key` is the translated label.
const GROUPS = [
  { value: 'Pain and fever', key: 'cat_pain' },
  { value: 'Cold and cough', key: 'cat_cold' },
  { value: 'Vitamins and minerals', key: 'cat_vitamins' },
  { value: 'Stomach', key: 'cat_stomach' },
  { value: 'First aid', key: 'cat_firstaid' },
  { value: 'Diabetes', key: 'cat_diabetes' },
  { value: 'Blood pressure', key: 'cat_bp' },
  { value: 'Cholesterol', key: 'cat_cholesterol' },
  { value: 'Thyroid', key: 'cat_thyroid' },
  { value: 'Heart', key: 'cat_heart' },
  { value: 'Antibiotics', key: 'cat_antibiotics' },
  { value: 'Sleep and anxiety', key: 'cat_sleep' },
];
const GROUP_KEY: Record<string, string> = { ...Object.fromEntries(GROUPS.map((g) => [g.value, g.key])), Restricted: 'cat_restricted' };

export default function MedicineSearch(p: Props) {
  const t = (k: string, vars?: Record<string, string | number>) => translate(k, p.lang, vars);
  const [term, setTerm] = useState('');
  const [group, setGroup] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placing, setPlacing] = useState(false);
  const latest = useRef(0); // only the newest search may update the list, even if an older one answers last

  const run = async (nextTerm: string, nextGroup: string) => {
    setTerm(nextTerm);
    setGroup(nextGroup);
    const needsSearch = nextTerm.trim().length >= 2 || nextGroup !== '';
    if (!needsSearch) {
      latest.current++;
      setResults([]);
      setSearched(false);
      return;
    }
    const mine = ++latest.current;
    try {
      const rows = await fetchApi(`search?term=${encodeURIComponent(nextTerm.trim())}&category=${encodeURIComponent(nextGroup)}`);
      if (mine !== latest.current) return;
      setResults(rows);
      setSearched(true);
    } catch (err: any) {
      if (mine === latest.current) p.onToast(err.message || t('try_again'));
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

  const stockLine = (n: number) => (n === 0 ? t('stock_none') : n === 1 ? t('stock_1') : t('stock_n', { n }));

  return (
    <section className={`${card} space-y-5`} aria-label={t('find_med')}>
      <h2 className="text-xl text-slate-900">{t('find_med')}</h2>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={term}
          onChange={(e) => run(e.target.value, group)}
          placeholder={t('search_ph')}
          aria-label={t('search_title')}
          className={`${input} pl-12`}
        />
      </div>

      <div role="group" aria-label={t('find_med')} className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.value}
            type="button"
            aria-pressed={group === g.value}
            onClick={() => run(term, group === g.value ? '' : g.value)}
            className={`h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
              group === g.value
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-stone-300 bg-white text-slate-700 hover:bg-stone-50'
            }`}
          >
            {t(g.key)}
          </button>
        ))}
      </div>

      {!searched && results.length === 0 && <p className="text-sm text-slate-500">{t('search_hint')}</p>}
      {searched && results.length === 0 && <p className="text-base text-slate-700">{t('search_none')}</p>}

      {results.length > 0 && (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {results.map((m) => {
            const inStock = m.stores_in_stock > 0;
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-slate-900">{medName(m.name)}</div>
                  <div className="text-sm text-slate-600">
                    {medPack(m.name)}
                    {medPack(m.name) ? ' · ' : ''}₹{m.price}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {GROUP_KEY[m.category] ? t(GROUP_KEY[m.category]) : m.category}
                    {m.rule !== 'blocked' && (
                      <>
                        {' · '}
                        <span className={inStock ? 'text-teal-800' : 'text-rose-700'}>{stockLine(m.stores_in_stock)}</span>
                      </>
                    )}
                  </div>
                </div>
                {m.rule === 'ok' && inStock ? (
                  <button
                    type="button"
                    onClick={() => add(m)}
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-teal-700 px-3.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {t('add_cart')}
                  </button>
                ) : (
                  <span className="max-w-[8.5rem] shrink-0 text-right text-sm text-slate-500">
                    {m.rule === 'rx' ? t('needs_rx') : m.rule === 'blocked' ? t('not_online') : ''}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {cart.length > 0 && (
        <div className="space-y-5 rounded-xl bg-stone-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg text-slate-900">{t('cart_title')}</h3>
            <button type="button" onClick={() => setCart([])} className={btnQuiet}>
              {t('clear_cart')}
            </button>
          </div>
          <ul className="space-y-2 text-base">
            {cart.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>
                  {medName(c.name)} × {c.qty}
                </span>
                <span className="font-semibold">₹{c.price * c.qty}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-stone-200 pt-3 text-lg font-semibold">
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
