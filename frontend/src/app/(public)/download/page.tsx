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
  const [hydroDate, setHydroDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hydroCat, setHydroCat] = useState("salinity");
  const [hydroFiles, setHydroFiles] = useState<Array<{ key: string; size: number; lastModified: string }>>([]);
  const [hydroLoading, setHydroLoading] = useState(false);
  const [hydroSearched, setHydroSearched] = useState(false);
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
    setHydroLoading(true); setHydroSearched(true); setHydroFiles([]);
    try {
      const [y, m, d] = hydroDate.split('-');
      const files = await listFilesAuth(`gis-data/hydrology/${hydroCat}/${y}/${m}/${d}/`);
      if (files.length > 0) {
        setHydroFiles(files.filter((f: any) => /\.tiff?$/i.test(f.key)).map((f: any) => ({ key: f.key, size: f.size || 0, lastModified: f.lastModified || '' })));
      }
    } catch {} finally { setHydroLoading(false); }
  };

  const dlFile = async (s3Key: string, id: string) => {
    setDlMsg(p => ({ ...p, [id]: "..." }));
    try { await downloadWithAuth(s3Key); setDlMsg(p => ({ ...p, [id]: "Done" })); setTimeout(() => setDlMsg(p => { const n = { ...p }; delete n[id]; return n; }), 2000); }
    catch { setDlMsg(p => ({ ...p, [id]: "Error" })); setTimeout(() => setDlMsg(p => { const n = { ...p }; delete n[id]; return n; }), 2000); }
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
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {HYDRO_CATEGORIES.map(c => (
                    <button key={c.key} onClick={() => { setHydroCat(c.key); setHydroFiles([]); setHydroSearched(false); }}
                      style={{ padding: '7px 14px', borderRadius: 8, border: hydroCat === c.key ? `2px solid ${c.color}` : '1px solid #e2e8f0', background: hydroCat === c.key ? `${c.color}10` : '#fff', color: hydroCat === c.key ? c.color : '#64748b', fontWeight: hydroCat === c.key ? 600 : 400, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <c.icon size={14} />{c.name}{c.unit ? ` (${c.unit})` : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</label>
                <input type="date" value={hydroDate} onChange={e => { setHydroDate(e.target.value); setHydroFiles([]); setHydroSearched(false); }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#0f172a', outline: 'none' }} />
              </div>
              <button onClick={searchHydro} disabled={hydroLoading}
                style={{ padding: '8px 24px', height: 38, background: hydroLoading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: hydroLoading ? 'not-allowed' : 'pointer', transition: 'all 150ms ease' }}>
                {hydroLoading ? 'Searching...' : 'Search Files'}
              </button>
            </div>

            <div style={{ padding: '20px 24px', minHeight: 200 }}>
              {!hydroSearched ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Droplets size={28} color="#94a3b8" /></div>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Select a data category and date above, then click <strong>Search Files</strong></p>
                </div>
              ) : hydroLoading ? (
                <div style={{ textAlign: 'center', padding: 48 }}><div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} /><p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Searching S3 bucket...</p></div>
              ) : hydroFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><FileText size={28} color="#dc2626" /></div>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 4 }}>No files found</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{HYDRO_CATEGORIES.find(c => c.key === hydroCat)?.name} — {hydroDate}</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{hydroFiles.length} file{hydroFiles.length > 1 ? 's' : ''} found</h3>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{HYDRO_CATEGORIES.find(c => c.key === hydroCat)?.name} — {hydroDate} · {formatSize(hydroFiles.reduce((s, f) => s + f.size, 0))} total</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {hydroFiles.map(f => {
                      const parts = f.key.split('/');
                      const timePart = parts.find(p => /^\d{2}-\d{2}$/.test(p)) || '';
                      const fileName = parts[parts.length - 1].replace(/\.(tif|tiff)$/i, '');
                      const label = timePart || fileName || 'Download';
                      const id = `hydro__${f.key}`; const msg = dlMsg[id];
                      return (
                        <button key={f.key} onClick={() => dlFile(f.key, id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: msg ? (msg === 'Done' ? '#ecfdf5' : '#fef2f2') : '#fff', textAlign: 'left', cursor: 'pointer', transition: 'all 120ms ease' }}
                          onMouseEnter={e => { if (!msg) { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.1)'; } }}
                          onMouseLeave={e => { if (!msg) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; } }}>
                          <Download size={14} color={msg === 'Done' ? '#059669' : '#3b82f6'} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: msg ? (msg === 'Done' ? '#059669' : '#dc2626') : '#0f172a' }}>{msg || label}</div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{formatSize(f.size)} · GeoTIFF</div>
                          </div>
                        </button>
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
