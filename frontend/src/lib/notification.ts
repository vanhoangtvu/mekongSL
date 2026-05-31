"use client";

export function showNotification(msg: string, type: "info" | "success" | "error" = "info") {
  console.warn("[Notif]", type, msg);
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "99999",
    padding: "12px 24px",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    fontFamily: "sans-serif",
    background: type === "error" ? "#dc2626" : type === "success" ? "#16a34a" : "#2563eb",
    color: "#fff",
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    maxWidth: "90%",
    textAlign: "center",
    pointerEvents: "none",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
