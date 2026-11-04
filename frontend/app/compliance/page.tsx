'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, ArrowLeft, Lock, FileText, CheckCircle2, AlertTriangle, 
  Scale, UserCheck 
} from 'lucide-react';

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-teal-800 hover:text-teal-900 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Reorder App</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-teal-600 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700">Regulatory Safeguards &amp; Privacy Architecture</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold shadow-2xs">
            <Scale className="w-3.5 h-3.5 text-teal-700" />
            Statutory Healthcare &amp; Data Privacy Center
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Regulatory &amp; Patient Privacy Standards
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            RefillCare demonstrates technical safeguards modeled on the <strong>Drugs and Cosmetics Act &amp; Rules 1945 (Rule 65)</strong> and the <strong>Digital Personal Data Protection Act, 2023</strong> for retail pharmacy reordering in Kolkata &amp; Howrah.
          </p>
        </div>

        {/* Informational Notice Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Informational Demonstration Notice:</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              This overview outlines software safeguards and data handling mechanisms implemented in this application. It is provided for informational and evaluation purposes only and does not constitute formal legal certification or professional legal advice.
            </p>
          </div>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1: Drugs & Cosmetics Act */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
              <Scale className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              1. Drugs and Cosmetics Act &amp; Rules (Rule 65)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Prescription medicine reorders are gated under statutory pharmacy dispensing rules:
            </p>
            <ul className="text-xs text-slate-700 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Schedule H &amp; H1 Mandatory Verification:</strong> Dispatched only after affirmative physical sign-off by a registered pharmacist. Store dispatch is blocked (HTTP 403) until approval.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Schedule X &amp; Narcotic Ban:</strong> Narcotic drugs and Schedule X medications are strictly blocked by software filters and cannot be ordered online.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Statutory Schedule H1 Register:</strong> Dispensing records are recorded to an append-only register with prescriber name, registration number, patient details, and quantity dispensed.
                </span>
              </li>
            </ul>
          </div>

          {/* Pillar 2: DPDP Act 2023 */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-800">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              2. Digital Personal Data Protection Act, 2023
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Prescriptions and health records represent sensitive personal data protected by technical controls:
            </p>
            <ul className="text-xs text-slate-700 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Fernet (AES-128-CBC with HMAC-SHA256) Encryption:</strong> Uploaded prescription photos are encrypted in flight and at rest with Fernet keys in storage.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Audit Log:</strong> Decryption events and prescription views are recorded in an audit log (append-only table; not cryptographically tamper-proof).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Right to Erasure (&quot;Forget Me&quot;):</strong> Customers may exercise data erasure via <code className="bg-slate-100 px-1 rounded">/api/me/forget</code>, clearing profile identifiers and order logs while retaining statutory registers required by Rule 65.
                </span>
              </li>
            </ul>
          </div>

          {/* Pillar 3: Generic Substitution */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              3. Generic Substitution &amp; Patient Consent
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              RefillCare supports affordable healthcare access while upholding patient choice:
            </p>
            <ul className="text-xs text-slate-700 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Bioequivalent Molecules:</strong> Suggested generics (e.g. Metformin 500mg, Telmisartan 40mg) share identical active pharmaceutical ingredients and strength.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Dual Affirmative Consent:</strong> Generics are never substituted automatically. A pharmacist proposes the alternative, and the patient must explicitly consent before packing.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Chronic Cost Savings:</strong> Families managing recurring conditions can opt for lower-cost equivalents to lower monthly medication expenses.
                </span>
              </li>
            </ul>
          </div>

          {/* Pillar 4: AI Assisted Workflow Safeguards */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-800">
              <UserCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              4. AI OCR &amp; Human-in-the-Loop Governance
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Computer vision assists transcription but is prohibited from autonomous dispensing:
            </p>
            <ul className="text-xs text-slate-700 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>AI Output is Strictly a Draft:</strong> The machine-read prescription appears only as an editable suggestion in the pharmacist verification workbench.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Doctor Registration Check:</strong> Doctor registration number is validated for standard format (format check only, informational; does not block dispensing).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Blurry Prescription Handling:</strong> Low-confidence or unreadable handwriting is placed on hold with an immediate patient re-upload notification.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Data Protection Desk & Demo Contact Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-800" />
            <h3 className="font-extrabold text-base text-slate-900">
              Grievance Redressal &amp; Data Protection Contact (Sample Data)
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            In demonstration of DPDP Act 2023 Section 13 contact mechanisms, privacy inquiries or data erasure requests are routed to the designated desk:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-semibold">Privacy Desk:</span>
              <p className="font-bold text-slate-800">Sample Compliance Desk</p>
              <p className="text-slate-500 text-[11px]">Evaluation &amp; Demo Role</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-semibold">Email Contact:</span>
              <p className="font-bold text-teal-800">dpo-demo@refillcare.example.com</p>
              <p className="text-slate-500 text-[11px]">Simulated correspondence</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-semibold">Office:</span>
              <p className="font-bold text-slate-800">RefillCare Central Operations</p>
              <p className="text-slate-500 text-[11px]">Sample operations facility</p>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100">
            Automated DPDP workflow: Data erasure requests are processed via <code className="bg-slate-100 px-1 rounded">/api/me/forget</code>.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <strong className="text-slate-800">RefillCare</strong> • Regulatory Architecture Reference
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-teal-800 font-semibold">Online Reordering</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
