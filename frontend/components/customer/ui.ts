// Shared look for the customer screens: 48px controls, 15px text, soft sage on oat paper.

export const card = 'rounded-2xl border border-stone-200 bg-white p-5';

export const btnPrimary =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60';

export const btnSecondary =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-base font-semibold text-slate-900 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60';

export const btnQuiet =
  'inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-teal-700 underline-offset-4 hover:underline';

export const input =
  'h-12 w-full rounded-xl border border-stone-300 bg-cream px-4 text-slate-900 placeholder:text-slate-400 focus:border-teal-600';

export const label = 'block text-sm font-semibold text-slate-800';

/** A choice button in a group (person, area, payment). */
export const choice = (selected: boolean) =>
  `min-h-12 rounded-xl border px-4 py-2 text-left text-base font-medium transition-colors ${
    selected
      ? 'border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-600/25'
      : 'border-stone-300 bg-white text-slate-800 hover:bg-stone-50'
  }`;

/** Medicine names print as 'Metformin 500 mg, strip of 15'. The pack detail is shown on its own. */
export const medName = (full: string) => (full || '').split(',')[0];
export const medPack = (full: string) => (full || '').split(',').slice(1).join(',').trim();

/** Backend notes that only repeat what the status line already says in the customer's language. */
export const DEFAULT_NOTES = [
  'Prescription not readable. Please upload a clearer photo.',
  'Please upload a clearer prescription.',
  'Please upload a current prescription',
  'Automatic reading unavailable. Pharmacist will read it manually.',
];
