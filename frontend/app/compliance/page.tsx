import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Privacy and legal rules · RefillCare',
};

const sections: { title: string; points: string[] }[] = [
  {
    title: 'Who checks your medicines',
    points: [
      'A registered pharmacist looks at every prescription and approves every medicine before it is packed. The system will not let a store pack or hand over a prescription medicine that has not been approved.',
      'Schedule H medicines need a valid prescription. Schedule H1 medicines also need the prescriber and patient written in a register.',
      'Schedule X and narcotic medicines are never sold online. They are refused at the cart and rejected the moment they appear on a prescription.',
      'The rules that decide this (which medicines need a prescription, which are never sold, how long a prescription stays valid) sit in one settings file, because the online-pharmacy rules are not final.',
    ],
  },
  {
    title: 'What the computer does and does not do',
    points: [
      'A computer reads your prescription photo and suggests medicines and quantities. That is only a draft. The pharmacist decides.',
      'If the photo cannot be read, we ask you for a clearer one. We never guess.',
      'A cheaper generic is only ever offered by the pharmacist, and only used if you say yes. It is never swapped on its own.',
      'We do not give medical advice.',
    ],
  },
  {
    title: 'Your health information',
    points: [
      'Prescription photos are encrypted when they are stored. Only registered pharmacists and the store that packs your order can see them.',
      'Every time someone opens a prescription it is written to an access log. The log is a database table that is only added to. It is not yet protected against someone with direct database access.',
      'We ask for your agreement before we handle any health information. For someone under 18, a parent or guardian must agree.',
      'You can download everything we hold about you, and you can delete it, from the bottom of your home screen. Deleting removes your family profiles, messages and prescription photos, and signs you out. Records the law requires us to keep, such as the Schedule H1 register, are kept.',
    ],
  },
  {
    title: 'Laws this follows',
    points: [
      'The Drugs and Cosmetics Act and Rules, for prescription medicines, Schedule H1 records, and what cannot be sold online.',
      'The Digital Personal Data Protection Act, 2023, for how health information is collected, protected and deleted.',
    ],
  },
];

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Back to the app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-10 px-4 py-10 sm:px-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Privacy and legal rules</h1>
          <p className="text-lg text-slate-600">In plain words: how your medicines are checked, and how your health information is kept safe.</p>
        </div>

        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
          This is a demonstration built for evaluation. It describes what the software does. It is not legal advice and is not a licence to sell medicines.
        </p>

        {sections.map((s) => (
          <section key={s.title} className="space-y-4" aria-labelledby={s.title.replace(/\W+/g, '-')}>
            <h2 id={s.title.replace(/\W+/g, '-')} className="text-2xl font-bold">
              {s.title}
            </h2>
            <ul className="space-y-3">
              {s.points.map((p) => (
                <li key={p} className="rounded-2xl border border-slate-200 bg-white p-4 text-lg text-slate-800">
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="contact-h">
          <h2 id="contact-h" className="text-2xl font-bold">
            Questions about your data
          </h2>
          <p className="text-lg text-slate-700">
            Write to <strong>dpo-demo@refillcare.example.com</strong>. This is a sample address for the demonstration.
          </p>
        </section>
      </main>
    </div>
  );
}
