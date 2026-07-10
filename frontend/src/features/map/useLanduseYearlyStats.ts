"use client";

import { useEffect, useRef, useState } from "react";
import { fromUrl } from "geotiff";
import { listS3Files } from "../../lib/admin-api";

type YearStat = { year: number; areaHa: number };

const UTM48N_EXTENT_M = { xMin: 594885, yMin: 1052655, xMax: 688485, yMax: 1117455 };
const UTM48N_WIDTH_M = UTM48N_EXTENT_M.xMax - UTM48N_EXTENT_M.xMin;
const UTM48N_HEIGHT_M = UTM48N_EXTENT_M.yMax - UTM48N_EXTENT_M.yMin;

const API_BASE = "/api/gis";
const META_YEAR = 0;

type MetaInfo = { totalYears: number; maxYear: number } | null;

const _sessionCache = new Map<string, YearStat[]>();

async function fetchCachedStats(landuseKey: string): Promise<{ stats: YearStat[]; meta: MetaInfo }> {
  try {
    const res = await fetch(`${API_BASE}/landuse-yearly-stats?key=${encodeURIComponent(landuseKey)}`);
    if (!res.ok) return { stats: [], meta: null };
    const data: YearStat[] = await res.json();
    const metaRow = data.find(s => s.year === META_YEAR);
    const stats = data.filter(s => s.year !== META_YEAR);
    let meta: MetaInfo = null;
    if (metaRow) {
      const encoded = Math.round(metaRow.areaHa);
      meta = { totalYears: Math.floor(encoded / 10000), maxYear: encoded % 10000 };
    }
    return { stats, meta };
  } catch {
    return { stats: [], meta: null };
  }
}

async function saveStat(landuseKey: string, year: number, areaHa: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/landuse-yearly-stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landuseKey, year, areaHa }),
    });
  } catch { /* best-effort */ }
}

async function saveMeta(landuseKey: string, totalYears: number, maxYear: number): Promise<void> {
  const encoded = totalYears * 10000 + maxYear;
  await saveStat(landuseKey, META_YEAR, encoded);
}

async function computeArea(key: string): Promise<number | null> {
  try {
    const url = `/api/tif?key=${encodeURIComponent(key)}`;
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    const tiff = await fromUrl(fullUrl);
    const image = await tiff.getImage();
    const data = await image.readRasters();
    if (!data || data.length === 0) return null;
    const band = data[0];
    if (!band || band.length === 0) return null;

    const rawNodata = image.getGDALNoData();
    const nodata = rawNodata !== null && rawNodata !== undefined
      ? Number(rawNodata)
      : undefined;

    const imgW = image.getWidth();
    const imgH = image.getHeight();
    const pixelAreaM2 = (UTM48N_WIDTH_M / imgW) * (UTM48N_HEIGHT_M / imgH);

    let count = 0;
    for (let i = 0; i < band.length; i++) {
      const v = band[i];
      if (v === 0) continue;
      if (nodata !== undefined && !Number.isNaN(nodata) && v === nodata) continue;
      if (v === -9999) continue;
      count++;
    }

    return (count * pixelAreaM2) / 10000;
  } catch (err) {
    console.warn("[lu:computeArea]", err);
    return null;
  }
}

async function listYearsOnS3(luKey: string): Promise<Map<number, string>> {
  const prefix = `gis-data/baseline-environment/${luKey}/`;
  try {
    const res = await listS3Files(prefix);
    if (res._error) return new Map();

    const yearMap = new Map<number, string>();
    for (const f of res.files) {
      const k = (f as { key?: string }).key;
      if (!k) continue;
      const m = k.match(/\/(\d{4})\//);
      if (!m) continue;
      const y = Number(m[1]);
      if (y < 1990 || y > 2030) continue;
      if (!k.match(/\.tiff?$/i)) continue;
      if (!yearMap.has(y)) yearMap.set(y, k);
    }
    return yearMap;
  } catch {
    return new Map();
  }
}

export function useLanduseYearlyStats(landuseKey: string | null) {
  const [stats, setStats] = useState<YearStat[] | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!landuseKey) {
      setStats(null);
      fetchingRef.current = false;
      return;
    }

    const sc = _sessionCache.get(landuseKey);
    if (sc) {
      setStats(sc);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    let cancelled = false;

    (async () => {
      const { stats: mysqlStats, meta } = await fetchCachedStats(landuseKey);
      if (cancelled) { fetchingRef.current = false; return; }

      // If session cache was populated during fetch (race), use it
      const sc2 = _sessionCache.get(landuseKey);
      if (sc2) {
        if (cancelled) { fetchingRef.current = false; return; }
        setStats(sc2);
        fetchingRef.current = false;
        return;
      }

      // Check if MySQL has complete data (from previous session)
      let s3Years = new Map<number, string>();
      let needsS3Listing = true;

      if (meta !== null && mysqlStats.length >= meta.totalYears) {
        const currentYear = new Date().getFullYear();
        const likelyComplete = meta.maxYear >= currentYear - 2;
        if (likelyComplete) {
          // MySQL has all data → skip S3 listing
          s3Years = new Map();
          needsS3Listing = false;
          mysqlStats.forEach(s => s3Years.set(s.year, ""));
        }
      }

      if (needsS3Listing) {
        s3Years = await listYearsOnS3(landuseKey);
      }
      if (cancelled) { fetchingRef.current = false; return; }

      const cachedYears = new Set(mysqlStats.map(s => s.year));
      const newYears: Array<{ year: number; s3Key: string }> = [];
      let s3MaxYear = 0;

      for (const [year, s3Key] of s3Years) {
        if (year > s3MaxYear) s3MaxYear = year;
        if (!cachedYears.has(year)) {
          newYears.push({ year, s3Key });
        }
      }

      const result = [...mysqlStats];

      if (newYears.length > 0) {
        console.log("[lu:yearly] computing", newYears.length, "new years:", newYears.map(n => n.year));
        for (const ny of newYears) {
          if (cancelled) { fetchingRef.current = false; return; }
          const ha = await computeArea(ny.s3Key);
          if (ha !== null) {
            const areaHa = Math.round(ha);
            result.push({ year: ny.year, areaHa });
            saveStat(landuseKey, ny.year, areaHa);
          }
        }
      }

      if (cancelled) { fetchingRef.current = false; return; }
      result.sort((a, b) => a.year - b.year);

      // Save metadata so future fetches can skip S3 listing
      if (s3Years.size > 0) {
        const maxYear = s3MaxYear > 0 ? s3MaxYear : (result.length > 0 ? result[result.length - 1].year : 0);
        saveMeta(landuseKey, s3Years.size, maxYear);
      }

      _sessionCache.set(landuseKey, result);
      setStats(result);
      fetchingRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [landuseKey]);

  return stats;
}
