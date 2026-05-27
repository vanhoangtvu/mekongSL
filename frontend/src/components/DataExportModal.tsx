/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { authService } from '../lib/auth';
import { RefreshCw } from 'lucide-react';

export const METRICS = [
  { key: 'salinity', label: 'Độ mặn' },
  { key: 'ph', label: 'pH' },
  { key: 'waterlevel', label: 'Mực nước' },
  { key: 'alkalinity', label: 'Alkalinity' },
];

export default function DataExportModal({ open, onClose, timeframes, date }: { open: boolean; onClose: () => void; timeframes: Array<{ fetch_run_id: string; fetched_at: string }>; date: string; }) {
  const [mode, setMode] = useState<'monthly' | 'daily'>('monthly');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [province, setProvince] = useState('');
  const REGION_OPTIONS = [
    { value: '', label: '-- Tất cả vùng --' },
    { value: 'TV', label: 'TV' },
    { value: 'BT', label: 'BT' },
    { value: 'VL', label: 'VL' },
  ];
  const [provinces, setProvinces] = useState<Array<{ code: string; name: string }>>([]);

  const [selectedDate, setSelectedDate] = useState<string>(date || new Date().toISOString().slice(0,10));

  React.useEffect(() => {
    (async () => {
      try {
        const token = authService.getToken();
        const res = await fetch('/api/mekong-monthly/provinces', { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (res.ok) {
          const body = await res.json();
          setProvinces(body.provinces || []);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['salinity']);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);

  if (!open) return null;

  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const metrics = selectedMetrics.join(',');
      let url = '/api/mekong-monthly/export?mode=' + mode + '&metrics=' + encodeURIComponent(metrics);
      if (province) url += '&region=' + encodeURIComponent(province);

      if (mode === 'monthly') {
        url += `&year=${year}&month=${String(month).padStart(2, '0')}`;
      } else {
        if (!selectedDate) {
          alert('Vui lòng chọn ngày để xuất theo ngày');
          setLoading(false);
          return;
        }
        url += `&date=${encodeURIComponent(selectedDate)}`;
      }

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert('Lỗi khi xuất: ' + (body?.error || 'Server error'));
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const filename = res.headers.get('content-disposition')?.split('filename=')[1]?.replace(/\"/g, '') || 'export.xlsx';
      const urlBlob = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlBlob;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(urlBlob);
      alert('✓ Đã tải file Excel thành công!');
      onClose();
    } catch (e) {
      alert('Lỗi kết nối: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const token = authService.getToken();
      const metrics = selectedMetrics.join(',');
      let url = '/api/mekong-monthly/export?mode=' + mode + '&metrics=' + encodeURIComponent(metrics) + '&preview=1';
      if (province) url += '&region=' + encodeURIComponent(province);
      if (mode === 'monthly') {
        url += `&year=${year}&month=${String(month).padStart(2, '0')}`;
      } else {
        if (!selectedDate) {
          alert('Vui lòng chọn ngày để xem trước');
          setPreviewLoading(false);
          return;
        }
        url += `&date=${encodeURIComponent(selectedDate)}`;
      }

      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert('Lỗi khi xem trước: ' + (body?.error || 'Server error'));
        setPreviewLoading(false);
        return;
      }
      const body = await res.json();
      setPreviewData(body);
    } catch (e) {
      alert('Lỗi kết nối xem trước: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ width: 720, background: 'var(--surface)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow)' }}>
        <h3>Tuỳ chọn xuất Excel</h3>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="mode" checked={mode === 'monthly'} onChange={() => setMode('monthly')} /> Tháng
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="mode" checked={mode === 'daily'} onChange={() => setMode('daily')} /> Ngày (snapshot)
          </label>
        </div>

        {mode === 'monthly' ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <label>Năm: <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ marginLeft: 6, width: 100 }} /></label>
            <label>Tháng: <input type="number" value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ marginLeft: 6, width: 80 }} /></label>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ minWidth: 120 }}>Chọn ngày:</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ marginBottom: 8, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label>Vùng (chọn chữ viết tắt):</label>
            <select value={province} onChange={(e) => setProvince(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }}>
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label>Tỉnh (chọn):</label>
            <select value={''} disabled style={{ width: '100%', padding: 8, marginTop: 4 }}>
              <option>-- (Không bắt buộc) --</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Chọn thuộc tính (metrics)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {METRICS.map((m) => (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={selectedMetrics.includes(m.key)} onChange={() => toggleMetric(m.key)} /> {m.label}
              </label>
            ))}
          </div>
        </div>

        {previewData ? (
          <div style={{ marginBottom: 12, maxHeight: 420, overflow: 'auto', border: '1px solid var(--muted)', padding: 8, borderRadius: 6 }}>
            {previewLoading ? (
              <div>Đang tải xem trước...</div>
            ) : (() => {
              const sheets = previewData.sheets || [];
              const firstSheet = sheets[0] || null;
              const headers = firstSheet?.columns || [];
              const rows = firstSheet?.rows || [];

              if (!rows.length) return <div>Không có dữ liệu cho thời gian này</div>;

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>Xem trước ({headers.length} cột, {Array.isArray(rows) ? rows.length : 0} hàng)</div>
                    {sheets.length > 1 ? (
                      <div>
                        <label style={{ marginRight: 8 }}>Sheet:</label>
                        <select onChange={(e) => {
                          const idx = Number(e.target.value);
                          const sel = sheets[idx];
                          setPreviewData({ sheets }); // keep
                          // replace first sheet's rows/columns to selected one by rotating array
                          // simpler: move selected sheet to first position
                          const copy = [...sheets];
                          const [chosen] = copy.splice(idx, 1);
                          copy.unshift(chosen);
                          setPreviewData({ sheets: copy });
                        }}>
                          {sheets.map((s: any, i: number) => <option key={i} value={i}>{s.metric || ('Sheet ' + (i+1))}</option>)}
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {headers.map((h: string) => (
                          <th key={h} style={{ borderBottom: '1px solid var(--muted)', textAlign: 'left', padding: '4px 6px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 200).map((r: any, idx: number) => (
                        <tr key={idx}>
                          {headers.map((h: string) => (
                            <td key={h} style={{ padding: '4px 6px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>{r[h] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={loading || previewLoading} style={{ padding: '8px 12px' }}>Huỷ</button>
          {previewData ? (
            <>
              <button onClick={() => { setPreviewData(null); }} disabled={loading} style={{ padding: '8px 12px' }}>Quay lại</button>
              <button onClick={handleSubmit} disabled={loading} style={{ padding: '8px 12px', background: 'var(--accent)', color: '#fff' }}>{loading ? 'Đang xuất...' : 'Tải xuống'}</button>
            </>
          ) : (
            <>
              <button onClick={handlePreview} disabled={previewLoading} style={{ padding: '8px 12px' }}>{previewLoading ? 'Đang xem...' : 'Xem trước'}</button>
              <button onClick={handleSubmit} disabled={loading} style={{ padding: '8px 12px', background: 'var(--accent)', color: '#fff' }}>{loading ? 'Đang xuất...' : 'Tải xuống'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
