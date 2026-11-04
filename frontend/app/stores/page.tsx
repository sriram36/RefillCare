'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Building2, MapPin, Phone, Clock, Search, ArrowLeft, ShieldCheck, 
  Sparkles, CheckCircle2, ChevronRight, Navigation, Layers, Filter 
} from 'lucide-react';

interface StoreInfo {
  id: number;
  name: string;
  zone: 'Central Kolkata' | 'South Kolkata' | 'North Kolkata' | 'East Kolkata & IT Corridor' | 'Howrah & Riverfront' | 'Central Hub';
  address: string;
  pincode: string;
  phone: string;
  timing: string;
  isHub?: boolean;
  hasColdChain: boolean;
  pharmacistOnDuty: string;
  wbmcNo: string;
  expressDelivery: boolean;
}

const STORES: StoreInfo[] = [
  // Central Hub
  {
    id: 100,
    name: "RefillCare Central Warehouse & Cold Chain Hub",
    zone: "Central Hub",
    address: "Central Distribution Facility, Kolkata",
    pincode: "700088",
    phone: "+91 33 2401 9900",
    timing: "24 Hours / 7 Days",
    isHub: true,
    hasColdChain: true,
    pharmacistOnDuty: "Chief Pharmacist Dr. A. Banerjee",
    wbmcNo: "WBMC #39281",
    expressDelivery: true
  },

  // East Kolkata & IT Corridor
  {
    id: 1,
    name: "Salt Lake Sector V Hub (Store #1)",
    zone: "East Kolkata & IT Corridor",
    address: "Block EP & GP, Sector V, Bidhannagar, Kolkata",
    pincode: "700091",
    phone: "+91 33 2357 8810",
    timing: "24 Hours / 7 Days",
    isHub: true,
    hasColdChain: true,
    pharmacistOnDuty: "Anita Rao, M.Pharm",
    wbmcNo: "WBMC #48192",
    expressDelivery: true
  },
  {
    id: 4,
    name: "Salt Lake City Centre 1",
    zone: "East Kolkata & IT Corridor",
    address: "DC Block, Sector I, Bidhannagar, Kolkata",
    pincode: "700064",
    phone: "+91 33 2358 1204",
    timing: "8:00 AM – 11:00 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Subhashis Roy, B.Pharm",
    wbmcNo: "WBMC #51209",
    expressDelivery: true
  },
  {
    id: 5,
    name: "New Town Action Area I",
    zone: "East Kolkata & IT Corridor",
    address: "Near Nazrul Tirtha, Major Arterial Road, New Town",
    pincode: "700156",
    phone: "+91 33 2950 4401",
    timing: "8:00 AM – 11:30 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Poulomi Sengupta",
    wbmcNo: "WBMC #53981",
    expressDelivery: true
  },
  {
    id: 6,
    name: "New Town City Centre 2",
    zone: "East Kolkata & IT Corridor",
    address: "Action Area II, Rajarhat, Kolkata",
    pincode: "700136",
    phone: "+91 33 2977 1920",
    timing: "8:00 AM – 10:30 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Rajarshi Das",
    wbmcNo: "WBMC #47190",
    expressDelivery: true
  },
  {
    id: 7,
    name: "EM Bypass - Ruby Hospital More",
    zone: "East Kolkata & IT Corridor",
    address: "Kasba Golpark, E.M. Bypass, Kolkata",
    pincode: "700107",
    phone: "+91 33 2442 8820",
    timing: "24 Hours / 7 Days",
    isHub: true,
    hasColdChain: true,
    pharmacistOnDuty: "Dr. B. K. Sarkar",
    wbmcNo: "WBMC #39810",
    expressDelivery: true
  },
  {
    id: 8,
    name: "Chingrighata Bypass Crossing",
    zone: "East Kolkata & IT Corridor",
    address: "Canal South Road, Chingrighata, Kolkata",
    pincode: "700105",
    phone: "+91 33 2323 1189",
    timing: "8:00 AM – 11:00 PM",
    hasColdChain: false,
    pharmacistOnDuty: "Suman Kalyan Ghosh",
    wbmcNo: "WBMC #55120",
    expressDelivery: true
  },

  // South Kolkata
  {
    id: 2,
    name: "Behala Tram Depot (Store #2)",
    zone: "South Kolkata",
    address: "Diamond Harbour Road, Behala, Kolkata",
    pincode: "700034",
    phone: "+91 33 2468 7720",
    timing: "8:00 AM – 11:00 PM",
    isHub: false,
    hasColdChain: true,
    pharmacistOnDuty: "Snehasis Pal, D.Pharm",
    wbmcNo: "WBMC #42981",
    expressDelivery: true
  },
  {
    id: 9,
    name: "Gariahat Tri-junction",
    zone: "South Kolkata",
    address: "Gariahat Road, Ballygunge, Kolkata",
    pincode: "700019",
    phone: "+91 33 2464 3301",
    timing: "8:30 AM – 11:00 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Mousumi Chakraborty",
    wbmcNo: "WBMC #49120",
    expressDelivery: true
  },
  {
    id: 10,
    name: "Jadavpur 8B Bus Stand",
    zone: "South Kolkata",
    address: "Raja S.C. Mallick Road, Jadavpur, Kolkata",
    pincode: "700032",
    phone: "+91 33 2414 6702",
    timing: "8:00 AM – 11:00 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Debojyoti Mondal",
    wbmcNo: "WBMC #50392",
    expressDelivery: true
  },
  {
    id: 11,
    name: "Garia Mahamayatala",
    zone: "South Kolkata",
    address: "NSC Bose Road, Garia, Kolkata",
    pincode: "700084",
    phone: "+91 33 2435 9012",
    timing: "8:00 AM – 10:30 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Alok Naskar",
    wbmcNo: "WBMC #46128",
    expressDelivery: true
  },
  {
    id: 12,
    name: "Tollygunge Metro Phari",
    zone: "South Kolkata",
    address: "Deshapran Sasmal Road, Tollygunge, Kolkata",
    pincode: "700033",
    phone: "+91 33 2422 1890",
    timing: "8:00 AM – 11:00 PM",
    hasColdChain: false,
    pharmacistOnDuty: "Rupa Bhattacharya",
    wbmcNo: "WBMC #52190",
    expressDelivery: true
  },
  {
    id: 13,
    name: "New Alipore Block C",
    zone: "South Kolkata",
    address: "Sahapur Main Road, New Alipore, Kolkata",
    pincode: "700053",
    phone: "+91 33 2478 5540",
    timing: "8:30 AM – 10:30 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Kalyan Sundaram",
    wbmcNo: "WBMC #44892",
    expressDelivery: true
  },
  {
    id: 14,
    name: "Bhowanipore Ashutosh Mukherjee Road",
    zone: "South Kolkata",
    address: "Ashutosh Mukherjee Road, Bhowanipore, Kolkata",
    pincode: "700025",
    phone: "+91 33 2455 1290",
    timing: "8:00 AM – 11:00 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Swati Sengupta",
    wbmcNo: "WBMC #47812",
    expressDelivery: true
  },

  // Central Kolkata
  {
    id: 15,
    name: "Park Street Crossing",
    zone: "Central Kolkata",
    address: "Mother Teresa Sarani (Park St), Kolkata",
    pincode: "700016",
    phone: "+91 33 2229 4480",
    timing: "24 Hours / 7 Days",
    isHub: true,
    hasColdChain: true,
    pharmacistOnDuty: "Dr. Farhan Qureshi",
    wbmcNo: "WBMC #38190",
    expressDelivery: true
  },
  {
    id: 16,
    name: "College Street & Medical College",
    zone: "Central Kolkata",
    address: "Opposite Calcutta Medical College Gate #2, Kolkata",
    pincode: "700073",
    phone: "+91 33 2241 8901",
    timing: "24 Hours / 7 Days",
    isHub: true,
    hasColdChain: true,
    pharmacistOnDuty: "Bivas Mazumdar",
    wbmcNo: "WBMC #40192",
    expressDelivery: true
  },
  {
    id: 17,
    name: "Sealdah Station North",
    zone: "Central Kolkata",
    address: "AJC Bose Road, Sealdah, Kolkata",
    pincode: "700014",
    phone: "+91 33 2350 7820",
    timing: "6:00 AM – Midnight",
    hasColdChain: true,
    pharmacistOnDuty: "Sanjoy Dutta",
    wbmcNo: "WBMC #43120",
    expressDelivery: true
  },
  {
    id: 18,
    name: "Burrabazar Cotton Street",
    zone: "Central Kolkata",
    address: "Kalakar Street, Burrabazar, Kolkata",
    pincode: "700007",
    phone: "+91 33 2259 3302",
    timing: "9:00 AM – 9:30 PM",
    hasColdChain: false,
    pharmacistOnDuty: "Girdhari Agarwal",
    wbmcNo: "WBMC #39012",
    expressDelivery: true
  },

  // North Kolkata
  {
    id: 19,
    name: "Shyambazar Five Point Crossing",
    zone: "North Kolkata",
    address: "Bidhan Sarani, Shyambazar, Kolkata",
    pincode: "700004",
    phone: "+91 33 2555 8920",
    timing: "8:00 AM – 11:30 PM",
    isHub: true,
    hasColdChain: true,
    pharmacistOnDuty: "Tamal Kanti Sen",
    wbmcNo: "WBMC #41920",
    expressDelivery: true
  },
  {
    id: 20,
    name: "Dum Dum Cantonment Station Road",
    zone: "North Kolkata",
    address: "Cantonment Road, Dum Dum, Kolkata",
    pincode: "700028",
    phone: "+91 33 2549 1209",
    timing: "8:00 AM – 10:30 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Dipanjan Mitra",
    wbmcNo: "WBMC #51902",
    expressDelivery: true
  },
  {
    id: 21,
    name: "Hatibagan Market Square",
    zone: "North Kolkata",
    address: "Bidhan Sarani, Hatibagan, Kolkata",
    pincode: "700006",
    phone: "+91 33 2530 4490",
    timing: "8:30 AM – 10:30 PM",
    hasColdChain: false,
    pharmacistOnDuty: "Sharmila Bose",
    wbmcNo: "WBMC #48910",
    expressDelivery: true
  },
  {
    id: 22,
    name: "Bagbazar Ghat Road",
    zone: "North Kolkata",
    address: "Girindra Bose Lane, Bagbazar, Kolkata",
    pincode: "700003",
    phone: "+91 33 2554 9912",
    timing: "8:00 AM – 10:00 PM",
    hasColdChain: false,
    pharmacistOnDuty: "Pranab Mukherjee",
    wbmcNo: "WBMC #45102",
    expressDelivery: true
  },

  // Howrah & Riverfront
  {
    id: 3,
    name: "Howrah Maidan Hub (Store #3)",
    zone: "Howrah & Riverfront",
    address: "Grand Trunk Road, Howrah Maidan, Howrah",
    pincode: "711101",
    phone: "+91 33 2638 9012",
    timing: "24 Hours / 7 Days",
    isHub: true,
    hasColdChain: true,
    pharmacistOnDuty: "Dipak Karar, B.Pharm",
    wbmcNo: "WBMC #41029",
    expressDelivery: true
  },
  {
    id: 23,
    name: "Shibpur Mandirtala Crossing",
    zone: "Howrah & Riverfront",
    address: "Mandirtala Road, Shibpur, Howrah",
    pincode: "711102",
    phone: "+91 33 2677 3341",
    timing: "8:00 AM – 11:00 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Avik Chatterjee",
    wbmcNo: "WBMC #52981",
    expressDelivery: true
  },
  {
    id: 24,
    name: "Salkia Chowrasta",
    zone: "Howrah & Riverfront",
    address: "Aurobindo Road, Salkia, Howrah",
    pincode: "711106",
    phone: "+91 33 2665 1928",
    timing: "8:00 AM – 10:30 PM",
    hasColdChain: false,
    pharmacistOnDuty: "Santanu Pal",
    wbmcNo: "WBMC #49021",
    expressDelivery: true
  },
  {
    id: 25,
    name: "Liluah Station Bazaar",
    zone: "Howrah & Riverfront",
    address: "Station Road, Liluah, Howrah",
    pincode: "711204",
    phone: "+91 33 2654 8812",
    timing: "8:00 AM – 10:30 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Gautam Ghosh",
    wbmcNo: "WBMC #46912",
    expressDelivery: true
  },
  {
    id: 26,
    name: "Belur Math Sarani",
    zone: "Howrah & Riverfront",
    address: "GT Road, Belur, Howrah",
    pincode: "711202",
    phone: "+91 33 2654 1109",
    timing: "8:00 AM – 10:00 PM",
    hasColdChain: false,
    pharmacistOnDuty: "Balaram Das",
    wbmcNo: "WBMC #44092",
    expressDelivery: true
  },
  {
    id: 27,
    name: "Santragachi Railway Terminal",
    zone: "Howrah & Riverfront",
    address: "Kona Expressway, Santragachi, Howrah",
    pincode: "711111",
    phone: "+91 33 2627 9920",
    timing: "7:00 AM – 11:30 PM",
    hasColdChain: true,
    pharmacistOnDuty: "Amitava Roy",
    wbmcNo: "WBMC #48129",
    expressDelivery: true
  }
];

export default function StoresPage() {
  const [query, setQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');

  const filteredStores = useMemo(() => {
    return STORES.filter((s) => {
      const matchesZone = selectedZone === 'all' || s.zone === selectedZone;
      const q = query.toLowerCase().trim();
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.pincode.includes(q) ||
        s.pharmacistOnDuty.toLowerCase().includes(q);
      return matchesZone && matchesQuery;
    });
  }, [query, selectedZone]);

  const zones = ['all', 'Central Hub', 'East Kolkata & IT Corridor', 'South Kolkata', 'Central Kolkata', 'North Kolkata', 'Howrah & Riverfront'];

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
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700">46 Stores Live • Connected via Daily CSV Sync</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-teal-700" />
            RefillCare Store Network Directory
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            46 Neighborhood Pharmacies in Kolkata &amp; Howrah
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every store is staffed with registered West Bengal Medical/Pharmacy Council pharmacists, stocked with chronic diabetes, cardiac, and thyroid formulations, and connected to our <strong>Central Warehouse</strong> for same-day inter-store replenishment.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs text-center">
            <div className="text-2xl font-extrabold text-teal-800">46</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">Physical Branches</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs text-center">
            <div className="text-2xl font-extrabold text-teal-800">380+</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">Healthcare Staff</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs text-center">
            <div className="text-2xl font-extrabold text-teal-800">&lt; 60 Min</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">Local Express SLA</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs text-center">
            <div className="text-2xl font-extrabold text-teal-800">100%</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">WBMC Pharmacist Verified</div>
          </div>
        </div>

        {/* Search & Zone Filter Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by neighborhood, street, pincode (e.g. Salt Lake, Behala, 700091, Dr. Rao)..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          {/* Zone Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3.5 h-3.5" /> Zone:
            </span>
            {zones.map((z) => (
              <button
                key={z}
                onClick={() => setSelectedZone(z)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                  selectedZone === z
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {z === 'all' ? 'All 46 Stores' : z}
              </button>
            ))}
          </div>
        </div>

        {/* Store Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStores.map((s) => (
            <div
              key={s.id}
              className={`bg-white rounded-3xl p-5 border shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                s.isHub ? 'border-teal-300 ring-2 ring-teal-100' : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                {/* Badge Row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {s.zone}
                  </span>
                  {s.isHub && (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-teal-700" />
                      24/7 Super Hub
                    </span>
                  )}
                  {s.hasColdChain && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Cold-Chain Ready
                    </span>
                  )}
                </div>

                {/* Name & Address */}
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                    {s.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                    <span>{s.address} — PIN {s.pincode}</span>
                  </p>
                </div>

                {/* Operating details */}
                <div className="text-xs space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{s.timing}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800">{s.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[11px]">
                      Pharmacist: <strong className="text-slate-800">{s.pharmacistOnDuty}</strong> ({s.wbmcNo})
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Stocked for 60-min Refill
                </span>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 font-bold text-teal-800 hover:text-teal-900 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 hover:bg-teal-100 transition"
                >
                  <span>Select Store</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredStores.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 p-8">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-sm">No pharmacy stores match your query</p>
            <p className="text-xs text-slate-500 mt-1">Try searching for a different neighborhood or select "All 46 Stores".</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <strong className="text-slate-800">RefillCare 46-Store Network</strong> • Operating in Kolkata &amp; Howrah
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-teal-800 font-semibold">Online Reordering</Link>
            <Link href="/compliance" className="hover:text-teal-800 font-semibold">DPDP Act &amp; Rule 65 Compliance</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
