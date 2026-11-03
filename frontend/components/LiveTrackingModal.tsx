'use client';

import React, { useState, useEffect } from 'react';
import { Truck, MapPin, CheckCircle2, Clock, X, Shield, Phone, Sparkles } from 'lucide-react';
import { Language, translate } from '../lib/i18n';

interface LiveTrackingModalProps {
  order: any;
  lang: Language;
  onClose: () => void;
}

export default function LiveTrackingModal({ order, lang, onClose }: LiveTrackingModalProps) {
  const [progress, setProgress] = useState(45);
  const t = (k: string) => translate(k, lang);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => (p >= 90 ? 30 : p + 5));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const storeName = order.store || 'Local Pharmacy Hub';
  const deliveryArea = order.area || 'Park Street, Kolkata';
  const courier = order.delivery_partner || 'Local Express Delivery (Store Staff)';
  const invoice = order.invoice_no || 'INV-59281';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 space-y-0">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-md">
              <Truck className="w-5 h-5 text-teal-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight">Live Courier GPS Dispatch</h3>
                <span className="text-[10px] font-bold bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full uppercase">
                  On the way
                </span>
              </div>
              <p className="text-xs text-teal-100 font-medium">Order #{order.code} • Dispatched from {storeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Simulated Map Visualizer */}
        <div className="p-5 space-y-5 bg-slate-50/50">
          <div className="relative h-44 rounded-2xl bg-gradient-to-br from-slate-100 via-teal-50/40 to-slate-200 overflow-hidden border border-slate-200 flex flex-col justify-between p-4 shadow-inner">
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#0d9488_1px,transparent_1px)] [background-size:16px_16px] opacity-25"></div>
            
            {/* Top route label */}
            <div className="relative z-10 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 bg-white/90 px-3 py-1 rounded-full shadow-2xs border border-slate-200">
                <MapPin className="w-3.5 h-3.5 text-teal-700" />
                {storeName}
              </span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5 bg-white/90 px-3 py-1 rounded-full shadow-2xs border border-slate-200">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                {deliveryArea}
              </span>
            </div>

            {/* Visual Route Line & Moving Delivery Marker */}
            <div className="relative z-10 my-auto">
              <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden border border-slate-300 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              
              {/* Moving Vehicle Pin */}
              <div
                className="absolute -top-3.5 transition-all duration-700 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${progress}%` }}
              >
                <div className="p-1.5 bg-teal-800 text-white rounded-full shadow-lg border-2 border-white animate-bounce">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-extrabold text-teal-900 bg-white/95 px-1.5 py-0.5 rounded shadow-xs mt-0.5 whitespace-nowrap border border-teal-200">
                  ETA ~18 mins
                </span>
              </div>
            </div>

            {/* Bottom status badge */}
            <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-600 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Live GPS Active • Speed: 28 km/h
              </span>
              <span className="font-mono text-slate-500">Kolkata / Howrah Metro Zone</span>
            </div>
          </div>

          {/* Delivery & Security Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-400 font-medium">Assigned Courier</span>
              <p className="font-bold text-slate-900">{courier}</p>
              <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 pt-0.5">
                <Shield className="w-3 h-3" />
                Verified Delivery Agent
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-400 font-medium">Tax Invoice Number</span>
              <p className="font-mono font-bold text-slate-900">{invoice}</p>
              <div className="text-[11px] text-slate-500 pt-0.5">
                Signed by Registered Pharmacist
              </div>
            </div>
          </div>

          {/* Cold-chain / Medicines Seal Assurance */}
          <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-center gap-2.5 text-xs text-teal-950 font-medium">
            <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
            <span>Tamper-evident pharmacy seal applied. Temperature monitored during transit.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">Need help? Dial 1800-REFILL</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-xs transition active:scale-95"
          >
            Close Tracking
          </button>
        </div>

      </div>
    </div>
  );
}

