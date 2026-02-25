'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Globe, Phone, MapPin as MapPinIcon, Loader2, Link as LinkIcon, AlertTriangle, CheckCircle, Store } from 'lucide-react';

interface Insight {
  score: number;
  category: string;
  insights: string[];
  isSecure: boolean;
  analyzing?: boolean;
}

interface Business {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string | null;
  category: string;
  analysis?: Insight;
}

export default function Home() {
  const [radius, setRadius] = useState('5');
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchBusinesses = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    setBusinesses([]);

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`/api/businesses?lat=${latitude}&lng=${longitude}&radius=${radius}`);
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Failed to fetch businesses');
          }

          setBusinesses(data.businesses);
          if (data._notice) setNotice(data._notice);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }, (err) => {
        setError("Location access denied. Please enable location services.");
        setLoading(false);
      });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const analyzeWebsite = async (index: number, url: string) => {
    // Set analyzing state
    setBusinesses(prev => prev.map((b, i) => i === index ? { ...b, analysis: { ...(b.analysis || {}), analyzing: true } as unknown as Insight } : b));

    try {
      const res = await fetch('/api/analyze-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      setBusinesses(prev => prev.map((b, i) => i === index ? { ...b, analysis: { ...data, analyzing: false } } : b));
    } catch (err) {
      console.error(err);
      setBusinesses(prev => prev.map((b, i) => i === index ? { ...b, analysis: { score: 0, category: 'Error', insights: ['Analysis failed to run'], isSecure: false, analyzing: false } } : b));
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden relative selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-cyan-600/10 blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[150px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6 text-sm text-indigo-300 font-medium">
            <Globe className="w-4 h-4" /> AI-Powered Lead Generation
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold mb-6 tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-500 text-transparent bg-clip-text">
            Find Your Next <br /> <span className="text-indigo-400">Perfect Client</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Discover local businesses near you and instantly analyze their digital presence to identify high-value prospects for your software agency.
          </p>
        </motion.div>

        {/* Search Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div className="glass rounded-2xl p-4 sm:p-6 shadow-2xl shadow-indigo-500/10 border border-white/5 flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-400 mb-2">Search Radius (miles)</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  placeholder="e.g. 10"
                />
              </div>
            </div>

            <button
              onClick={fetchBusinesses}
              disabled={loading}
              className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />}
              {loading ? 'Scanning Area...' : 'Find Prospects'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {notice && (
            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {notice}
            </div>
          )}
        </motion.div>

        {/* Results Data Table */}
        <AnimatePresence>
          {businesses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-16"
            >
              <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-white/5">
                        <th className="py-5 px-6 font-semibold text-slate-300">Business Details</th>
                        <th className="py-5 px-6 font-semibold text-slate-300">Contact</th>
                        <th className="py-5 px-6 font-semibold text-slate-300">Digital Presence</th>
                        <th className="py-5 px-6 font-semibold text-slate-300 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {businesses.map((biz, idx) => (
                        <motion.tr
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * idx }}
                          key={biz.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Details */}
                          <td className="py-6 px-6 align-top">
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                <Store className="w-5 h-5 text-indigo-400" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-white text-lg">{biz.name}</h3>
                                <p className="text-slate-400 text-sm mt-1 mb-2 capitalize">{biz.category.replace(/_/g, ' ')}</p>
                                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                                  <MapPinIcon className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[200px]">{biz.address}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="py-6 px-6 align-top">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-slate-300">
                                <Phone className="w-4 h-4 text-slate-500" />
                                {biz.phone || 'N/A'}
                              </div>
                              {biz.website ? (
                                <a href={biz.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors group">
                                  <LinkIcon className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
                                  <span className="truncate max-w-[180px]">Visit Website</span>
                                </a>
                              ) : (
                                <div className="flex items-center gap-2 text-rose-400 text-sm font-medium">
                                  <AlertTriangle className="w-4 h-4" /> No Website Detected
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Digital Presence / Analysis */}
                          <td className="py-6 px-6 align-top max-w-[300px]">
                            {!biz.website ? (
                              <div className="inline-flex bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-semibold">
                                Prime Target: Needs Website
                              </div>
                            ) : biz.analysis ? (
                              biz.analysis.analyzing ? (
                                <div className="flex items-center gap-2 text-indigo-300 text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing Tech Stack...
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${biz.analysis.category === 'Modern' ? 'bg-emerald-500/10 text-emerald-400' :
                                        biz.analysis.category === 'Average' ? 'bg-blue-500/10 text-blue-400' :
                                          'bg-amber-500/10 text-amber-400'
                                      }`}>
                                      {biz.analysis.category}
                                    </div>
                                    <div className="text-sm font-medium text-slate-300">
                                      Score: {biz.analysis.score}/10
                                    </div>
                                  </div>
                                  <ul className="space-y-1">
                                    {biz.analysis.insights.slice(0, 3).map((insight, i) => (
                                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5 leading-tight">
                                        <div className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                                        {insight}
                                      </li>
                                    ))}
                                    {biz.analysis.insights.length > 3 && (
                                      <li className="text-xs text-slate-500 italic">+ {biz.analysis.insights.length - 3} more flags</li>
                                    )}
                                  </ul>
                                </div>
                              )
                            ) : (
                              <span className="text-slate-500 text-sm">Not analyzed yet</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-6 px-6 align-top text-right">
                            {biz.website && !biz.analysis && (
                              <button
                                onClick={() => analyzeWebsite(idx, biz.website as string)}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-2 px-5 rounded-lg text-sm transition-all shadow-sm"
                              >
                                Analyze Tech
                              </button>
                            )}
                            {(!biz.website || (biz.analysis && biz.analysis.category === 'Legacy')) && (
                              <button className="bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 px-5 rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/20">
                                Contact Lead
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
