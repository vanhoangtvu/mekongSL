'use client';

import { useCallback, useRef, useState } from 'react';
import { sendChatStream } from '../api/ai-api';
import type { AIMessage, AIResponse, ExecutionStep } from '../types/ai-types';

export function useAIChat() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string, lat?: number | null, lon?: number | null) => {
      if (!text.trim() || isLoading) return;

      // Add user message
      const userMsg: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };
      
      const assistantId = `ai-${Date.now()}`;
      const initialAssistantMsg: AIMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        response: {
          success: true,
          sessionId: sessionId || '',
          message: '',
          executionSteps: [],
          evidence: [],
          timestamp: new Date().toISOString()
        }
      };

      setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
      setIsLoading(true);
      setError(null);

      try {
        await sendChatStream(
          { message: text.trim(), sessionId, lat: lat ?? null, lon: lon ?? null },
          (type, data) => {
            setMessages(prev => {
              const newMsgs = [...prev];
              const aiMsgIdx = newMsgs.findIndex(m => m.id === assistantId);
              if (aiMsgIdx === -1) return prev;
              
              const aiMsg = { ...newMsgs[aiMsgIdx] };
              if (!aiMsg.response) return prev;
              const resp = { ...aiMsg.response };

              if (type === 'step') {
                const step = data.step as ExecutionStep;
                // Update existing step or add new
                const existingIdx = resp.executionSteps?.findIndex(s => s.stepId === step.stepId) ?? -1;
                const newSteps = [...(resp.executionSteps || [])];
                if (existingIdx >= 0) newSteps[existingIdx] = step;
                else newSteps.push(step);
                resp.executionSteps = newSteps;
              } 
              else if (type === 'chunk') {
                aiMsg.content += data.text;
                resp.message = aiMsg.content;
              }
              else if (type === 'metadata') {
                if (data.intent) resp.intent = data.intent;
                if (data.evidence) resp.evidence = data.evidence;
                if (data.sessionId) {
                  resp.sessionId = data.sessionId;
                  setSessionId(data.sessionId);
                }
              }
              else if (type === 'end') {
                if (data.sessionId) setSessionId(data.sessionId);
              }
              else if (type === 'error') {
                setError(data.message);
                resp.success = false;
                resp.error = data.message;
              }

              aiMsg.response = resp;
              newMsgs[aiMsgIdx] = aiMsg;
              return newMsgs;
            });
          }
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Không thể kết nối với AI';
        setError(errMsg);
        setMessages(prev => {
          const newMsgs = [...prev];
          const aiMsgIdx = newMsgs.findIndex(m => m.id === assistantId);
          if (aiMsgIdx >= 0) {
             newMsgs[aiMsgIdx].content = `❌ Lỗi: ${errMsg}`;
             if (newMsgs[aiMsgIdx].response) {
                 newMsgs[aiMsgIdx].response!.success = false;
                 newMsgs[aiMsgIdx].response!.error = errMsg;
             }
          }
          return newMsgs;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  return { messages, isLoading, sessionId, error, sendMessage, clearChat };
}
