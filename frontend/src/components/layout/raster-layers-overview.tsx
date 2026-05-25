'use client';

import { useEffect, useState } from 'react';
import type { RasterLayerManifest } from '../../lib/constants/raster-layers';

export function RasterLayersOverview() {
  const [layers, setLayers] = useState<RasterLayerManifest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLayers = async () => {
      try {
        const response = await fetch('/api/layers');
        const payload = await response.json();
        setLayers(Array.isArray(payload.layers) ? payload.layers : []);
      } catch {
        setLayers([]);
      } finally {
        setLoading(false);
      }
    };

    void loadLayers();
  }, []);

  return (
    <section style={{ marginBottom: '24px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>Raster layers</p>
          <h2 style={{ margin: '4px 0 0', fontSize: '18px', color: '#111827' }}>Manifest lớp raster sẵn sàng render</h2>
        </div>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>{loading ? 'Đang tải...' : `${layers.length} layer`}</span>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {layers.map((layer) => (
          <article key={layer.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>{layer.name}</h3>
                <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '14px' }}>{layer.description}</p>
              </div>
              <a href={layer.previewUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start', color: '#2563eb', fontSize: '14px', textDecoration: 'none' }}>
                Xem URL render
              </a>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              <span style={{ padding: '4px 8px', borderRadius: '999px', background: '#e0f2fe', color: '#075985', fontSize: '12px' }}>{layer.format}</span>
              <span style={{ padding: '4px 8px', borderRadius: '999px', background: '#eef2ff', color: '#3730a3', fontSize: '12px' }}>{layer.crs}</span>
              <span style={{ padding: '4px 8px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontSize: '12px' }}>Opacity {layer.opacity}</span>
            </div>
          </article>
        ))}

        {!loading && layers.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Chưa có manifest layer raster nào.</div>
        ) : null}
      </div>
    </section>
  );
}
