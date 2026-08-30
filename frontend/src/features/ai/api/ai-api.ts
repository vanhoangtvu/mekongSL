import type { AIResponse } from '../types/ai-types';

/**
 * Địa chỉ Python AI Microservice (port 8090).
 * Ưu tiên biến môi trường NEXT_PUBLIC_AI_SERVICE_URL,
 * fallback về cùng host với cổng 8090.
 */
function getAIServiceURL(): string {
  if (typeof window !== 'undefined') {
    // Client-side: dùng biến env hoặc tự suy ra từ window.location
    const envURL = process.env.NEXT_PUBLIC_AI_SERVICE_URL;
    if (envURL) return envURL;
    const { hostname } = window.location;
    return `http://${hostname}:8090`;
  }
  // SSR: luôn dùng localhost
  return process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://127.0.0.1:8090';
}

export interface ChatRequestPayload {
  message: string;
  sessionId?: string | null;
  lat?: number | null;
  lon?: number | null;
}

/** Gửi tin nhắn tới Python AI Microservice qua Streaming (SSE) */
export async function sendChatStream(
  payload: ChatRequestPayload,
  onEvent: (type: string, data: any) => void
): Promise<void> {
  const url = `${getAIServiceURL()}/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: payload.message,
      sessionId: payload.sessionId ?? null,
      lat: payload.lat ?? null,
      lon: payload.lon ?? null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }

  if (!res.body) throw new Error("No response body");
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || ""; // Giữ lại phần chưa hoàn thành

    for (const part of parts) {
      if (part.startsWith("data: ")) {
        const jsonStr = part.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const data = JSON.parse(jsonStr);
          onEvent(data.type, data);
        } catch (e) {
          console.error("SSE JSON parse error:", e, jsonStr);
        }
      }
    }
  }
}

/** Lấy lịch sử conversation từ Python AI Service */
export async function getConversationHistory(sessionId: string) {
  const res = await fetch(`${getAIServiceURL()}/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Xóa session trên Python AI Service */
export async function deleteSession(sessionId: string) {
  const res = await fetch(`${getAIServiceURL()}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Health check Python AI Service */
export async function checkAIHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getAIServiceURL()}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
