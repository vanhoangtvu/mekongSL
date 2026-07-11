"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "../../../lib/auth";
import { AppHeader } from "../../../components/layout/app-header";
import { AppFooter } from "../../../components/layout/app-footer";
import { Download, Lock, FileText, Layers, Droplets, HardDrive, Info } from "lucide-react";

const LANDUSE_KEYS = [
  { key: "landuse-classification/aquaculture", name: "Aquaculture", full: "Aquaculture and Water Surface Lands", color: "#0ea5e9" },
  { key: "landuse-classification/rice-shrimp", name: "Rice-Shrimp", full: "Rice-to-shrimp / Intensive shrimp farming", color: "#f59e0b" },
  { key: "landuse-classification/perennial-crops", name: "Perennial Crops", full: "Perennial crops, Fruit Orchards and Mangrove Forests", color: "#10b981" },
  { key: "landuse-classification/residential-land", name: "Residential", full: "Residential Land and Sandy Ridge Land", color: "#8b5cf6" },
  { key: "landuse-classification/coconut-garden", name: "Coconut Garden", full: "Coconut Plantation, mix garden", color: "#f97316" },
  { key: "landuse-classification/vegetable-crops", name: "Vegetable", full: "Vegetable and Upland Crop Area", color: "#84cc16" },
  { key: "landuse-classification/rice-cultivation", name: "Rice", full: "Rice Cultivation Zone", color: "#06b6d4" },
];

const HYDRO_CATEGORIES = [
  { key: "salinity", name: "Salinity", unit: "ppt", icon: Droplets, color: "#0ea5e9" },
  { key: "tidal", name: "Tidal (Water Level)", unit: "cm", icon: Droplets, color: "#6366f1" },
  { key: "ph", name: "pH", unit: "", icon: Droplets, color: "#10b981" },
];

type TabKey = "landuse" | "hydrology";

function formatSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; }

const TIME_SLOTS = ["00-00", "06-00", "12-00", "18-00"];
const MAX_RANGE_DAYS = 31;

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function listFilesAuth(prefix: string): Promise<any[]> {
  const token = authService.getToken();
  const res = await fetch(`/api/download/files?prefix=${encodeURIComponent(prefix)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.files || (Array.isArray(data) ? data : []);
}

async function downloadWithAuth(s3Key: string) {
  const token = authService.getToken();
  const res = await fetch(`/api/s3/download?key=${encodeURIComponent(s3Key)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = s3Key.split('/').pop() || 'download.tif';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function DownloadPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("landuse");
  const [auth, setAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [luStats, setLuStats] = useState<Record<string, any[]>>({});
  const [luLoading, setLuLoading] = useState(true);
  const [hydroDateFrom, setHydroDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [hydroDateTo, setHydroDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [hydroCat, setHydroCat] = useState("salinity");
  const [hydroTimeSlots, setHydroTimeSlots] = useState<string[]>(TIME_SLOTS);
  const [hydroResults, setHydroResults] = useState<Record<string, Array<{ key: string; size: number; lastModified: string; time: string }>>>({});
  const [hydroSelected, setHydroSelected] = useState<Set<string>>(new Set());
  const [hydroScanning, setHydroScanning] = useState(false);
  const [hydroScanned, setHydroScanned] = useState(false);
  const [hydroProgress, setHydroProgress] = useState({ current: 0, total: 0, date: '' });
  const [hydroDlProgress, setHydroDlProgress] = useState<string>('');
  const [dlMsg, setDlMsg] = useState<Record<string, string>>({});

  useEffect(() => { if (authService.getToken()) setAuth(true); setChecking(false); }, []);

  useEffect(() => {
    if (!auth || tab !== "landuse" || Object.keys(luStats).length > 0) return;
    let c = false;
    Promise.all(LANDUSE_KEYS.map(({ key }) => fetch(`/api/gis/landuse-yearly-stats?key=${encodeURIComponent(key)}`).then(r => r.json()).then(d => ({ key, d })).catch(() => ({ key, d: [] }))))
      .then(r => { if (c) return; const m: Record<string, any[]> = {}; r.forEach(({ key, d }) => { m[key] = d; }); setLuStats(m); setLuLoading(false); });
    return () => { c = true; };
  }, [auth, tab]);

  const searchHydro = async () => {
    setHydroScanning(true); setHydroScanned(false); setHydroResults({}); setHydroSelected(new Set());
    const dates = eachDate(hydroDateFrom, hydroDateTo);
    if (dates.length > MAX_RANGE_DAYS) { setHydroScanning(false); return; }
    setHydroProgress({ current: 0, total: dates.length, date: '' });
    const results: Record<string, Array<{ key: string; size: number; lastModified: string; time: string }>> = {};
    const discoveredSlots = new Set(hydroTimeSlots);
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      setHydroProgress({ current: i + 1, total: dates.length, date: d });
      try {
        const [y, m, day] = d.split('-');
        const files = await listFilesAuth(`gis-data/hydrology/${hydroCat}/${y}/${m}/${day}/`);
        const tifFiles = files.filter((f: any) => /\.tiff?$/i.test(f.key));
        if (tifFiles.length > 0) {
          const mapped = tifFiles.map((f: any) => {
            const parts = f.key.split('/');
            const time = parts.find((p: string) => /^\d{2}-\d{2}$/.test(p)) || '';
            return { key: f.key, size: f.size || 0, lastModified: f.lastModified || '', time };
          });
          results[d] = mapped;
          mapped.forEach(f => { if (f.time) discoveredSlots.add(f.time); });
        }
      } catch {}
    }
    if (discoveredSlots.size > hydroTimeSlots.length) setHydroTimeSlots(Array.from(discoveredSlots).sort());
    const activeSlots = new Set(hydroTimeSlots);
    const filtered: typeof results = {};
    for (const [date, files] of Object.entries(results)) {
      const matched = files.filter(f => activeSlots.has(f.time));
      if (matched.length > 0) filtered[date] = matched;
    }
    setHydroResults(filtered);
    setHydroScanned(true);
    setHydroScanning(false);
  };

  const dlFile = async (s3Key: string, id: string) => {
    setDlMsg(p => ({ ...p, [id]: "..." }));
    try { await downloadWithAuth(s3Key); setDlMsg(p => ({ ...p, [id]: "Done" })); setTimeout(() => setDlMsg(p => { const n = { ...p }; delete n[id]; return n; }), 2000); }
    catch { setDlMsg(p => ({ ...p, [id]: "Error" })); setTimeout(() => setDlMsg(p => { const n = { ...p }; delete n[id]; return n; }), 2000); }
  };

  const dlHydroFile = async (key: string, label: string) => {
    setHydroDlProgress(`Downloading ${label}...`);
    try { await downloadWithAuth(key); } catch {}
    setHydroDlProgress('');
  };

  const dlAllSelected = async () => {
    const allFiles = Object.values(hydroResults).flat().filter(f => hydroSelected.has(f.key));
    for (let i = 0; i < allFiles.length; i++) {
      const f = allFiles[i];
      setHydroDlProgress(`Downloading ${i + 1}/${allFiles.length}: ${f.time} ${f.key.split('/').pop()}`);
      try { await downloadWithAuth(f.key); } catch {}
    }
    setHydroDlProgress('');
  };

  const toggleAll = () => {
    const allKeys = Object.values(hydroResults).flat().map(f => f.key);
    setHydroSelected(prev => prev.size === allKeys.length ? new Set() : new Set(allKeys));
  };

  const toggleFile = (key: string) => {
    setHydroSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };


  if (checking) return (<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}><div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #cbd5e1', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} /></div>);

  if (!auth) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', maxWidth: 420 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}><Lock size={32} color="#3b82f6" /></div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Authentication Required</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 28 }}>Please sign in to access the data download center. Your account must have the appropriate permissions.</p>
        <button onClick={() => router.push('/auth?redirect=/download')} style={{ padding: '12px 32px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)', transition: 'all 150ms ease' }}>Sign In</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>
      <AppHeader />
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 16px', marginBottom: 16 }}>
            <HardDrive size={14} color="#bfdbfe" />
            <span style={{ fontSize: '0.78rem', color: '#bfdbfe', fontWeight: 500 }}>Data Download Center</span>
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>Download Data</h1>
          <p style={{ color: '#bfdbfe', fontSize: '1rem', maxWidth: 600 }}>Access GeoTIFF raster datasets for analysis and research. All downloads require authentication.</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#e2e8f0', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {([{ k: 'landuse', l: 'Landuse Classification', i: Layers }, { k: 'hydrology', l: 'Hydrology Data', i: Droplets }] as const).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', border: 'none', borderRadius: 9, background: tab === t.k ? '#fff' : 'transparent', color: tab === t.k ? '#0f172a' : '#64748b', fontWeight: tab === t.k ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', boxShadow: tab === t.k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 150ms ease' }}><t.i size={15} />{t.l}</button>
          ))}
        </div>

        {/* Landuse */}
        {tab === "landuse" && (
          luLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 24, height: 120, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {LANDUSE_KEYS.map(({ key, name, full, color }) => {
                const years = luStats[key] || [];
                return (
                  <div key={key} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', transition: 'all 150ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={full}>{name}</h3>
                          <p style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{full}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, background: '#f8fafc', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>{years.length} yr</span>
                    </div>
                    <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 44, alignItems: 'center' }}>
                      {years.length === 0 ? <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontStyle: 'italic' }}>No data available</span> : years.sort((a: any, b: any) => b.year - a.year).map((y: any) => {
                        const id = `${key}__${y.year}`;
                        const msg = dlMsg[id];
                        return (
                          <button key={y.year} onClick={async () => {
                            try { const f = await listFilesAuth(`gis-data/baseline-environment/${encodeURIComponent(key)}/${y.year}/`); if (f.length > 0) await dlFile(f[0].key, id); } catch {}
                          }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: msg ? (msg === 'Done' ? '#ecfdf5' : '#fef2f2') : '#f8fafc', color: msg ? (msg === 'Done' ? '#059669' : '#dc2626') : '#334155', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', transition: 'all 120ms ease' }}
                            onMouseEnter={e => { if (!msg) { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; } }}
                            onMouseLeave={e => { if (!msg) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}>
                            <Download size={12} />{msg || y.year}
                            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{Math.round(y.areaHa).toLocaleString()} ha</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Hydrology */}
        {tab === "hydrology" && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Filter bar */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {HYDRO_CATEGORIES.map(c => (
                      <button key={c.key} onClick={() => { setHydroCat(c.key); setHydroScanned(false); setHydroResults({}); }}
                        style={{ padding: '7px 14px', borderRadius: 8, border: hydroCat === c.key ? `2px solid ${c.color}` : '1px solid #e2e8f0', background: hydroCat === c.key ? `${c.color}10` : '#fff', color: hydroCat === c.key ? c.color : '#64748b', fontWeight: hydroCat === c.key ? 600 : 400, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <c.icon size={14} />{c.name}{c.unit ? ` (${c.unit})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</label>
                  <input type="date" value={hydroDateFrom} max={hydroDateTo}
                    onChange={e => { setHydroDateFrom(e.target.value); setHydroScanned(false); setHydroResults({}); }}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#0f172a', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</label>
                  <input type="date" value={hydroDateTo} min={hydroDateFrom}
                    onChange={e => { setHydroDateTo(e.target.value); setHydroScanned(false); setHydroResults({}); }}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#0f172a', outline: 'none' }} />
                </div>
                <button onClick={searchHydro} disabled={hydroScanning}
                  style={{ padding: '8px 24px', height: 38, background: hydroScanning ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: hydroScanning ? 'not-allowed' : 'pointer', transition: 'all 150ms ease' }}>
                  {hydroScanning ? 'Scanning...' : 'Search Files'}
                </button>
              </div>
              {/* Time slot chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</span>
                {TIME_SLOTS.map(slot => {
                  const active = hydroTimeSlots.includes(slot);
                  return (
                    <button key={slot} onClick={() => {
                      setHydroTimeSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot].sort());
                      setHydroScanned(false); setHydroResults({});
                    }} style={{ padding: '4px 12px', borderRadius: 6, border: active ? '1px solid #3b82f6' : '1px solid #e2e8f0', background: active ? '#eff6ff' : '#fff', color: active ? '#2563eb' : '#94a3b8', fontSize: '0.78rem', fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 120ms ease' }}>
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Results */}
            <div style={{ padding: '20px 24px', minHeight: 200 }}>
              {!hydroScanned && !hydroScanning ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Droplets size={28} color="#94a3b8" /></div>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Select a category and date range above, then click <strong>Search Files</strong></p>
                </div>
              ) : hydroScanning ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Scanning {hydroProgress.current}/{hydroProgress.total} days...</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 4 }}>{hydroProgress.date}</p>
                </div>
              ) : Object.keys(hydroResults).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><FileText size={28} color="#dc2626" /></div>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 4 }}>No files found</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{hydroDateFrom} → {hydroDateTo}</p>
                </div>
              ) : (
                <div>
                  {/* Summary bar */}
                  {(() => {
                    const allFiles = Object.values(hydroResults).flat();
                    const totalSize = allFiles.reduce((s, f) => s + f.size, 0);
                    const selectedSize = allFiles.filter(f => hydroSelected.has(f.key)).reduce((s, f) => s + f.size, 0);
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', color: '#0f172a', fontWeight: 500 }}>
                            <input type="checkbox" checked={hydroSelected.size === allFiles.length && allFiles.length > 0} onChange={toggleAll} style={{ accentColor: '#2563eb' }} />
                            Select All
                          </label>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {allFiles.length} files · {formatSize(totalSize)} total
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {hydroDlProgress && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{hydroDlProgress}</span>}
                          <button onClick={dlAllSelected} disabled={hydroSelected.size === 0 || !!hydroDlProgress}
                            style={{ padding: '8px 20px', background: hydroSelected.size === 0 || hydroDlProgress ? '#cbd5e1' : '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: hydroSelected.size === 0 || hydroDlProgress ? 'not-allowed' : 'pointer', transition: 'all 150ms ease', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Download size={14} />Download Selected{hydroSelected.size > 0 ? ` (${hydroSelected.size})` : ''}
                          </button>
                          {selectedSize > 0 && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{formatSize(selectedSize)}</span>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Grouped by date */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.entries(hydroResults).sort(([a], [b]) => b.localeCompare(a)).map(([date, files]) => {
                      const dateFiles = files.filter(f => hydroTimeSlots.includes(f.time));
                      if (dateFiles.length === 0) return null;
                      const dateSize = dateFiles.reduce((s, f) => s + f.size, 0);
                      const checkedCount = dateFiles.filter(f => hydroSelected.has(f.key)).length;
                      return (
                        <div key={date} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{date}</span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{dateFiles.length} files · {formatSize(dateSize)}</span>
                            </div>
                            <button onClick={() => {
                              const keys = dateFiles.map(f => f.key);
                              setHydroSelected(prev => {
                                const allChecked = keys.every(k => prev.has(k));
                                const next = new Set(prev);
                                keys.forEach(k => { if (allChecked) next.delete(k); else next.add(k); });
                                return next;
                              });
                            }} style={{ fontSize: '0.72rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                              {checkedCount === dateFiles.length ? 'Deselect all' : checkedCount > 0 ? `${checkedCount} selected` : 'Select all'}
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, background: '#f1f5f9' }}>
                            {dateFiles.sort((a, b) => a.time.localeCompare(b.time)).map(f => {
                              const checked = hydroSelected.has(f.key);
                              const fileName = f.key.split('/').pop() || 'download.tif';
                              return (
                                <div key={f.key} onClick={() => toggleFile(f.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: checked ? '#eff6ff' : '#fff', cursor: 'pointer', transition: 'all 100ms ease', borderBottom: '1px solid #f1f5f9' }}>
                                  <input type="checkbox" checked={checked} onChange={() => {}} style={{ accentColor: '#2563eb', flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{f.time}</div>
                                      <div style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{formatSize(f.size)}</span>
                                      <button onClick={e => { e.stopPropagation(); dlHydroFile(f.key, f.time); }}
                                        style={{ padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.62rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Download size={10} />DL
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 22px', display: 'flex', gap: 12 }}>
            <Info size={18} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
            <div><h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>File Format</h4><p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>All data in GeoTIFF (.tif) format, UTM 48N (EPSG:32648). Landuse: yearly binary masks. Hydrology: hourly Float32 rasters.</p></div>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 22px', display: 'flex', gap: 12 }}>
            <Lock size={18} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
            <div><h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Access Control</h4><p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>Downloads are authenticated. Each request is verified against your account permissions. Unauthorized access returns 403.</p></div>
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
