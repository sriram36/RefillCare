'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, ArrowLeft, Lock, FileText, CheckCircle2, AlertTriangle, 
  Scale, Building2, UserCheck, Eye, RefreshCw, Mail, Phone, ExternalLink 
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
            <span className="text-xs font-bold text-slate-700">Drugs &amp; Cosmetics Act &amp; DPDP Act 2023 Compliant</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
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
            RefillCare operates strictly under the <strong>Drugs and Cosmetics Act &amp; Rules 1945 (Rule 65)</strong> and the <strong>Digital Personal Data Protection Act, 2023</strong> across all 46 retail pharmacy branches in Kolkata &amp; Howrah.
          </p>
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
              Every prescription medicine order is evaluated under statutory pharmacy dispensing laws:
            </p>
            <ul className="text-xs text-slate-700 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Schedule H &amp; H1 Mandatory Verification:</strong> Dispatched only after affirmative physical sign-off by a registered pharmacist licensed with the West Bengal Pharmacy Council.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Schedule X &amp; Narcotic Ban:</strong> Narcotic drugs, psychotropic substances, and Schedule X medications are strictly blocked by software filters and cannot be ordered online under any circumstances.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Statutory Schedule H1 Register:</strong> Separate digital records (append-only table; not cryptographically tamper-proof) are maintained with prescriber name, council registration number, patient details, and quantity dispensed for 3 years.
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
              Prescriptions and health records represent sensitive personal data protected by rigorous safeguards:
            </p>
            <ul className="text-xs text-slate-700 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Fernet (AES-128-CBC with HMAC-SHA256) Prescription Encryption:</strong> All uploaded prescription photos are encrypted in flight and at rest with cryptographic Fernet keys in isolated cloud blob storage.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Access Audit Logging:</strong> Every decryption event and prescription view by pharmacists or staff is logged with timestamp, user ID, and IP address.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Right to Erasure ("Forget Me"):</strong> Customers may request full data deletion at any time via their profile, erasing marketing and order logs while preserving only statutory registers required by law.
                </span>
              </li>
            </ul>
          </div>

          {/* Pillar 3: PMBJP Generic Substitution */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              3. Pradhan Mantri Janaushadhi Generic Guidelines
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              RefillCare supports affordable healthcare access while upholding strict ethical standards:
            </p>
            <ul className="text-xs text-slate-700 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Bioequivalent Molecules Only:</strong> Recommended generics (e.g. Metformin 500mg, Telmisartan 40mg) share identical active pharmaceutical ingredients, strength, and bioavailability.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Dual Affirmative Consent:</strong> Generics are never substituted automatically. A licensed pharmacist must propose the alternative, and the patient/caregiver must explicitly accept it before the order is packed.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Up to 65% Chronic Cost Savings:</strong> Families managing chronic conditions save substantial recurring expenses without compromising therapeutic efficacy.
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
              Computer vision and LLMs assist transcription but are prohibited from autonomous dispensing:
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
                  <strong>Doctor Registry Validation:</strong> Prescriber registration numbers (WBMC, NMC, MCI) are structurally verified against Indian medical council registry standards.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Blurry Prescription Rejection:</strong> Low-confidence or unreadable handwriting is placed on hold with an immediate patient re-upload SMS/push alert.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Data Protection Officer & Contact Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-800" />
            <h3 className="font-extrabold text-base text-slate-900">
              Grievance Redressal &amp; Data Protection Officer (DPO)
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            In compliance with Section 13 of the Digital Personal Data Protection Act, 2023, patients and caregivers may submit inquiries, correction requests, or data erasure grievances to our registered Data Protection Officer:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-semibold">Registered DPO:</span>
              <p className="font-bold text-slate-800">Adv. Supratim Sen, LL.M</p>
              <p className="text-slate-500 text-[11px]">Healthcare Compliance Counsel</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-semibold">Email Contact:</span>
              <p className="font-bold text-teal-800">dpo@refillcare.kolkata.in</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-semibold">Office Address:</span>
              <p className="font-bold text-slate-800">RefillCare Central Operations</p>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100">
            SLA: All privacy inquiries and erasure requests are processed within <strong>48 hours</strong> of verification.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <strong className="text-slate-800">RefillCare Compliance Directorate</strong> • Kolkata &amp; Howrah
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-teal-800 font-semibold">Online Reordering</Link>
            <Link href="/stores" className="hover:text-teal-800 font-semibold">46 Pharmacy Locations</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
