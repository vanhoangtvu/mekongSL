"use client";

import { useEffect, useRef, useState } from "react";
import { fromUrl } from "geotiff";
import { listS3Files } from "../../lib/admin-api";

type YearStat = { year: number; areaHa: number };

const CACHE_VERSION = 2;
const _cache = new Map<string, YearStat[] | null>();
function cacheKey(key: string) { return `v${CACHE_VERSION}:${key}`; }

const UTM48N_EXTENT_M = { xMin: 594885, yMin: 1052655, xMax: 688485, yMax: 1117455 };
const UTM48N_WIDTH_M = UTM48N_EXTENT_M.xMax - UTM48N_EXTENT_M.xMin;
const UTM48N_HEIGHT_M = UTM48N_EXTENT_M.yMax - UTM48N_EXTENT_M.yMin;

async function computeArea(key: string): Promise<number | null> {
  try {
    const url = `/api/tif?key=${encodeURIComponent(key)}`;
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    const tiff = await fromUrl(fullUrl);
    const image = await tiff.getImage();
    const data = await image.readRasters();
    if (!data || data.length === 0) {
      console.warn("[lu:computeArea] empty raster data for key:", key);
      return null;
    }
    const band = data[0];
    if (!band || band.length === 0) {
      console.warn("[lu:computeArea] empty band for key:", key);
      return null;
    }

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

    const area = (count * pixelAreaM2) / 10000;
    console.log("[lu:computeArea] key:", key,
      "dims:", imgW, "x", imgH,
      "pixelAreaM2:", pixelAreaM2.toFixed(4),
      "totalPixels:", band.length,
      "classPixels:", count,
      "rawNodata:", rawNodata, "parsedNodata:", nodata,
      "areaHa:", area,
      "sampleValues:", Array.from(band.slice(0, 10)), "...",
      "sampleValuesEnd:", Array.from(band.slice(band.length - 10, band.length)));
    return area;
  } catch (err) {
    console.warn("[lu:computeArea]", err);
    return null;
  }
}

async function fetchYearly(luKey: string): Promise<YearStat[] | null> {
  const prefix = `gis-data/baseline-environment/${luKey}/`;
  console.log("[lu:fetch] listing prefix:", prefix);
  const res = await listS3Files(prefix);
  console.log("[lu:fetch] raw result:", { fileCount: res.files?.length, hasError: !!res._error, sampleFiles: res.files?.slice(0, 3).map(f => (f as {key?:string}).key) });
  if (res._error) { console.warn("[lu:fetch] s3 error:", res._error); return null; }

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

  console.log("[lu:fetch] years found:", [...yearMap.keys()]);

  if (yearMap.size === 0) return [];

  const result: YearStat[] = [];
  for (const [year, key] of [...yearMap].sort((a, b) => a[0] - b[0])) {
    const ha = await computeArea(key);
    console.log("[lu:fetch] year", year, "area:", ha);
    if (ha !== null) result.push({ year, areaHa: Math.round(ha) });
  }

  console.log("[lu:fetch] result:", result.length, "years");
  return result;
}

export function useLanduseYearlyStats(landuseKey: string | null) {
  const [stats, setStats] = useState<YearStat[] | null>(null);
  const latestKey = useRef<string | null>(null);

  useEffect(() => {
    const key = landuseKey;
    console.log("[lu:hook] called with key:", key);

    if (!key) {
      setStats(null);
      latestKey.current = null;
      return;
    }

    const ck = cacheKey(key);
    const cached = _cache.get(ck);
    if (cached !== undefined) {
      console.log("[lu:hook] cache hit:", cached?.length, "years");
      setStats(cached);
      return;
    }

    let cancelled = false;
    latestKey.current = key;

    (async () => {
      const result = await fetchYearly(key);
      if (cancelled || latestKey.current !== key) return;
      _cache.set(ck, result);
      setStats(result);
    })();

    return () => { cancelled = true; };
  }, [landuseKey]);

  return stats;
}
