/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Globe, Phone, MapPin as MapPinIcon, Loader2, Link as LinkIcon, AlertTriangle, Store, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Circle, Marker } from '@react-google-maps/api';

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

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '16px'
};

const defaultCenter = {
  lat: 37.7749, // SF Default
  lng: -122.4194
};

export default function Home() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [radiusMeters, setRadiusMeters] = useState(8046); // ~5 miles in meters
  const circleRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 10;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedBusinesses = allBusinesses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(allBusinesses.length / ITEMS_PER_PAGE) + (nextPageToken ? 1 : 0);

  // Initialize Map Center from Browser Geolocation
  const jumpToCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setMapCenter(newCenter);
          if (mapRef.current) {
            mapRef.current.panTo(newCenter);
            mapRef.current.setZoom(12);
          }
        },
        () => {
          console.warn("Location access denied or unavailable.");
        }
      );
    }
  }, []);

  useEffect(() => {
    jumpToCurrentLocation();
  }, [jumpToCurrentLocation]);

  useEffect(() => {
    if (displayedBusinesses.length === 0) return;

    // We must NOT include `displayedBusinesses` as a dependency array raw, 
    // or else analyzeWebsite mutating `allBusinesses` will trigger an infinite loop.
    // We only want this to run when the `startIndex` or base page changes.
    let needsAnalysis = false;

    displayedBusinesses.forEach((biz, localIdx) => {
      if (biz.website && !biz.analysis) {
        needsAnalysis = true;
      }
    });

    if (needsAnalysis) {
      displayedBusinesses.forEach((biz, localIdx) => {
        const globalIdx = startIndex + localIdx;
        if (biz.website && !biz.analysis) {
          analyzeWebsite(globalIdx, biz.website);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex, allBusinesses.length]);


  const fetchBusinesses = async (token?: string) => {
    if (token) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
      setNotice(null);
      setAllBusinesses([]);
      setCurrentPage(1);
      setNextPageToken(null);
    }

    try {
      // Use mapCenter from the Google map instead of browser geolocation
      const radiusMiles = radiusMeters / 1609.34;
      const url = token
        ? `/api/businesses?pageToken=${token}`
        : `/api/businesses?lat=${mapCenter.lat}&lng=${mapCenter.lng}&radius=${radiusMiles}`;

      if (token) await new Promise(r => setTimeout(r, 2000));

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch businesses');

      if (token) {
        setAllBusinesses(prev => [...prev, ...data.businesses]);
      } else {
        setAllBusinesses(data.businesses);
      }

      setNextPageToken(data.nextPageToken || null);
      if (data._notice) setNotice(data._notice);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const analyzeWebsite = async (globalIndex: number, url: string) => {
    setAllBusinesses(prev => {
      const arr = [...prev];
      arr[globalIndex] = { ...arr[globalIndex], analysis: { analyzing: true } as unknown as Insight };
      return arr;
    });

    try {
      const res = await fetch('/api/analyze-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      setAllBusinesses(prev => {
        const arr = [...prev];
        arr[globalIndex] = { ...arr[globalIndex], analysis: { ...data, analyzing: false } };
        return arr;
      });
    } catch (err) {
      setAllBusinesses(prev => {
        const arr = [...prev];
        arr[globalIndex] = { ...arr[globalIndex], analysis: { score: 0, category: 'Error', insights: ['Analysis failed'], isSecure: false, analyzing: false } };
        return arr;
      });
    }
  };

  const exportCSV = () => {
    if (allBusinesses.length === 0) return;
    const headers = ['Name', 'Category', 'Address', 'Phone', 'Website', 'Tech Score', 'Category (Legacy/Modern)', 'Insights'];
    const rows = allBusinesses.map(biz => [
      `"${(biz.name || '').replace(/"/g, '""')}"`,
      `"${biz.category}"`,
      `"${(biz.address || '').replace(/"/g, '""')}"`,
      `"${biz.phone || ''}"`,
      `"${biz.website || ''}"`,
      biz.analysis?.score !== undefined ? biz.analysis.score : '',
      biz.analysis?.category || '',
      `"${(biz.analysis?.insights || []).join('; ')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `local_leads_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNextPage = () => {
    if (currentPage * ITEMS_PER_PAGE < allBusinesses.length) {
      setCurrentPage(currentPage + 1);
    } else if (nextPageToken) {
      fetchBusinesses(nextPageToken).then(() => {
        setCurrentPage(currentPage + 1);
      });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Map Handlers - Debounced and guarded to prevent infinite loops
  const onRadiusChanged = useCallback(() => {
    if (circleRef.current) {
      const newRadius = circleRef.current.getRadius();
      // Only update state if it changed significantly to avoid floating point loops
      if (Math.abs(newRadius - radiusMeters) > 5) {
        setRadiusMeters(newRadius);
      }
    }
  }, [radiusMeters]);

  const onCenterChanged = useCallback(() => {
    if (circleRef.current) {
      const newCenter = circleRef.current.getCenter();
      if (newCenter) {
        const lat = newCenter.lat();
        const lng = newCenter.lng();
        // Prevent microscopic sub-pixel drags from triggering mass re-renders
        if (Math.abs(lat - mapCenter.lat) > 0.0001 || Math.abs(lng - mapCenter.lng) > 0.0001) {
          setMapCenter({ lat, lng });
        }
      }
    }
  }, [mapCenter]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden relative selection:bg-indigo-500/30 pb-24">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-cyan-600/10 blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[150px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6 text-sm text-indigo-300 font-medium">
            <Globe className="w-4 h-4" /> AI-Powered Lead Generation
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold mb-4 tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-500 text-transparent bg-clip-text">
            Find Your Next <span className="text-indigo-400">Perfect Client</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Drag the circle to define your search area and discover local businesses ready for a digital upgrade.
          </p>
        </motion.div>

        {/* Map Search Control */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto mb-16"
        >
          <div className="glass rounded-3xl p-4 shadow-2xl border border-white/5">
            <div className="w-full h-[350px] sm:h-[450px] relative rounded-2xl overflow-hidden mb-4 bg-slate-900 flex items-center justify-center">
              {!isLoaded ? (
                <div className="flex flex-col items-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                  Loading Interactive Map...
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={12}
                  onLoad={(map) => { mapRef.current = map; }}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                      {
                        featureType: "administrative.locality",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#d59563" }],
                      },
                      {
                        featureType: "poi",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#d59563" }],
                      },
                      {
                        featureType: "poi.park",
                        elementType: "geometry",
                        stylers: [{ color: "#263c3f" }],
                      },
                      {
                        featureType: "poi.park",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#6b9a76" }],
                      },
                      {
                        featureType: "road",
                        elementType: "geometry",
                        stylers: [{ color: "#38414e" }],
                      },
                      {
                        featureType: "road",
                        elementType: "geometry.stroke",
                        stylers: [{ color: "#212a37" }],
                      },
                      {
                        featureType: "road",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#9ca5b3" }],
                      },
                      {
                        featureType: "water",
                        elementType: "geometry",
                        stylers: [{ color: "#17263c" }],
                      },
                      {
                        featureType: "water",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#515c6d" }],
                      },
                      {
                        featureType: "water",
                        elementType: "labels.text.stroke",
                        stylers: [{ color: "#17263c" }],
                      },
                    ]
                  }}
                >
                  <Marker position={mapCenter} />
                  <Circle
                    center={mapCenter}
                    radius={radiusMeters}
                    options={{
                      fillColor: '#6366f1',
                      fillOpacity: 0.2,
                      strokeColor: '#6366f1',
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                      editable: true,
                      draggable: true,
                    }}
                    onLoad={(circle) => { circleRef.current = circle; }}
                    onRadiusChanged={onRadiusChanged}
                    onCenterChanged={onCenterChanged}
                  />
                </GoogleMap>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
              <div className="flex flex-col gap-1">
                <div className="text-slate-400 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  Search Area: <span className="text-white font-medium break-all">{Math.round((radiusMeters / 1609.34) * 10) / 10} miles</span>
                </div>
                <button
                  onClick={jumpToCurrentLocation}
                  className="text-xs text-indigo-400 hover:text-indigo-300 text-left transition-colors font-medium flex items-center gap-1"
                >
                  <MapPinIcon className="w-3 h-3" /> Jump to My Location
                </button>
              </div>

              <button
                onClick={() => fetchBusinesses()}
                disabled={loading || !isLoaded}
                className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                {loading ? 'Scanning Area...' : 'Scan For Prospects'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
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
          {allBusinesses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xl font-semibold">Local Prospects Found: {allBusinesses.length}{nextPageToken && '+'}</h3>
                <button
                  onClick={exportCSV}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-2 px-4 rounded-lg text-sm transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export ALL to CSV
                </button>
              </div>

              <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-white/5">
                        <th className="py-5 px-6 font-semibold text-slate-300">Business Details</th>
                        <th className="py-5 px-6 font-semibold text-slate-300">Contact</th>
                        <th className="py-5 px-6 font-semibold text-slate-300">Digital Presence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 min-h-[400px]">
                      {displayedBusinesses.map((biz, idx) => (
                        <motion.tr
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * idx }}
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
                          <td className="py-6 px-6 align-top max-w-[320px]">
                            {!biz.website ? (
                              <div className="inline-flex bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-semibold">
                                Prime Target: Needs Website
                              </div>
                            ) : biz.analysis ? (
                              biz.analysis.analyzing ? (
                                <div className="flex items-center gap-2 text-indigo-300 text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Auto-Analyzing Tech Stack...
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
                              <div className="flex items-center gap-2 text-slate-500 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Pending queue...
                              </div>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                      {loadingMore && (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Fetching more leads from Google...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Controls */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-slate-400 text-sm">
                  Showing <span className="text-white font-medium">{startIndex + 1}</span> to <span className="text-white font-medium">{Math.min(startIndex + ITEMS_PER_PAGE, allBusinesses.length)}</span>
                  {' '}of {allBusinesses.length}{nextPageToken ? '+' : ''} entries
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || loadingMore}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium px-4">
                    Page {currentPage} {totalPages ? `of ${totalPages}` : ''}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={(currentPage >= totalPages && !nextPageToken) || loadingMore}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
