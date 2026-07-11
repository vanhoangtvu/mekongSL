"use client";

import { useEffect, useRef, useState } from "react";

type YearStat = { year: number; areaHa: number; percentage?: number; classPixels?: number; totalPixels?: number };

const _sessionCache = new Map<string, YearStat[]>();

export function useLanduseYearlyStats(landuseKey: string | null) {
  const [stats, setStats] = useState<YearStat[] | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!landuseKey) {
      setStats(null);
      fetchingRef.current = false;
      return;
    }

    const cached = _sessionCache.get(landuseKey);
    if (cached) {
      setStats(cached);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    let cancelled = false;

    fetch(`/api/gis/landuse-yearly-stats?key=${encodeURIComponent(landuseKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: YearStat[]) => {
        if (cancelled) return;
        const sorted = data.sort((a, b) => a.year - b.year);
        _sessionCache.set(landuseKey, sorted);
        setStats(sorted);
      })
      .catch((err) => {
        console.warn("[lu:yearly] fetch failed", err);
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        fetchingRef.current = false;
      });

    return () => {
      cancelled = true;
      fetchingRef.current = false;
    };
  }, [landuseKey]);

  return stats;
}
