"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getLanduseInventory,
  getLanduseComputeStatus,
  triggerLanduseCompute,
  type LanduseInventoryItem,
  type LanduseComputeStatus,
} from "../../lib/admin-api";
import { Calculator, CheckCircle, Clock, AlertTriangle, RefreshCw } from "lucide-react";

const POLL_INTERVAL = 3000;

export default function LanduseComputePanel() {
  const [items, setItems] = useState<LanduseInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [computeStatus, setComputeStatus] = useState<LanduseComputeStatus | null>(null);
  const [computing, setComputing] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" | "info" } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [inv, status] = await Promise.all([
        getLanduseInventory(),
        getLanduseComputeStatus(),
      ]);
      setItems(inv.items);
      setComputeStatus(status);
    } catch (err) {
      console.warn("[landuse:admin] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const status = await getLanduseComputeStatus();
        setComputeStatus(status);
        if (status.status === "COMPLETED" || status.status === "FAILED" || status.status === "NEVER_RUN") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setComputing(false);
          if (status.status === "COMPLETED" || status.status === "FAILED") {
            const [inv] = await Promise.all([getLanduseInventory()]);
            setItems(inv.items);
          }
        }
      } catch {}
    }, POLL_INTERVAL);
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleCompute = async () => {
    setComputing(true);
    setMessage(null);
    try {
      const res = await triggerLanduseCompute(true);
      const status = await getLanduseComputeStatus();
      setComputeStatus(status);
      if (status.status === "RUNNING" || status.status === "PENDING") {
        startPolling();
      }
    } catch (err) {
      setComputing(false);
      setMessage({ text: err instanceof Error ? err.message : "Compute failed", kind: "error" });
    }
  };

  const isRunning = computing || computeStatus?.status === "RUNNING" || computeStatus?.status === "PENDING";

  const progressPct = computeStatus && computeStatus.totalYears > 0
    ? Math.round((computeStatus.completedYears / computeStatus.totalYears) * 100)
    : 0;

  const totalS3Years = items.reduce((sum, i) => sum + i.s3Years.length, 0);
  const totalComputed = items.reduce((sum, i) => sum + i.computedYears.length, 0);
  const needsCompute = items.some(i => i.needsCompute);

  return (
    <div className="d-card" style={{ marginTop: 24 }}>
      <div className="d-card-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calculator size={18} />
          <span>Landuse Computation</span>
          {totalS3Years > 0 && (
            <span style={{ fontSize: "0.75rem", color: "var(--r-muted)", fontWeight: 400 }}>
              ({totalComputed}/{totalS3Years} years computed)
            </span>
          )}
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          {needsCompute && !isRunning && (
            <span style={{ fontSize: "0.75rem", color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={14} /> New data detected
            </span>
          )}
          <button
            className="d-btn d-btn-ghost"
            onClick={loadData}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            className="d-btn d-btn-primary"
            onClick={handleCompute}
            disabled={isRunning}
          >
            {isRunning ? (
              <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /></>
            ) : (
              <Calculator size={14} />
            )}
            <span>{isRunning ? "Computing..." : "Compute All"}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`d-message ${message.kind}`} style={{ margin: "8px 0" }}>
          {message.text}
        </div>
      )}

      {isRunning && computeStatus && (
        <div style={{ margin: "12px 0", padding: "12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.8rem", color: "#475569" }}>
            <span>{computeStatus.completedYears} / {computeStatus.totalYears} years</span>
            <span>{progressPct}%</span>
          </div>
          <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {computeStatus?.status === "FAILED" && (
        <div className="d-message error" style={{ margin: "8px 0" }}>
          Failed: {computeStatus.errorMessage || "Unknown error"}
        </div>
      )}

      {loading ? (
        <div className="d-empty" style={{ minHeight: 100 }}>
          <Clock size={24} />
          <p>Loading inventory...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="d-empty" style={{ minHeight: 100 }}>
          <AlertTriangle size={24} />
          <p>No landuse data found on S3</p>
        </div>
      ) : (
        <table style={{ width: "100%", borderSpacing: 0, marginTop: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Landuse</th>
              <th style={{ textAlign: "center", padding: "8px 12px", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>S3 Years</th>
              <th style={{ textAlign: "center", padding: "8px 12px", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Computed</th>
              <th style={{ textAlign: "center", padding: "8px 12px", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.landuseKey} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>{item.landuseName}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", fontSize: "0.78rem", color: "#475569" }}>
                  {item.s3Years.length > 0 ? item.s3Years.join(", ") : "—"}
                </td>
                <td style={{ textAlign: "center", padding: "10px 12px", fontSize: "0.78rem", color: "#475569" }}>
                  {item.computedYears.length > 0 ? item.computedYears.join(", ") : "—"}
                </td>
                <td style={{ textAlign: "center", padding: "10px 12px" }}>
                  {isRunning ? (
                    <span style={{ fontSize: "0.72rem", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: "pulse 1s infinite" }} /> 
                      Computing...
                    </span>
                  ) : item.needsCompute ? (
                    <span style={{ fontSize: "0.72rem", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <AlertTriangle size={14} /> Needs compute
                    </span>
                  ) : item.computedYears.length > 0 ? (
                    <span style={{ fontSize: "0.72rem", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <CheckCircle size={14} /> Complete
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>No data</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {computeStatus && computeStatus.status !== "NEVER_RUN" && (
        <div style={{ marginTop: 16, fontSize: "0.7rem", color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
          Last compute: {computeStatus.completedAt ? new Date(computeStatus.completedAt).toLocaleString("vi-VN") : "N/A"}
          {computeStatus.triggeredBy && ` — by ${computeStatus.triggeredBy}`}
        </div>
      )}
    </div>
  );
}
