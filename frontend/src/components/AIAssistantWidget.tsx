import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/Button';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  intent?: string;
  data?: any;
  draftContent?: string;
  isAiDraft?: boolean;
}

const SAMPLE_PROMPTS = [
  'Show overdue EVCs in Western region',
  'Which institutions have leases expiring in 30 days?',
  'Show high-risk delay bottleneck cases',
  'Draft deficiency notice for 1-1029380001 regarding fire NOC'
];

export const AIAssistantWidget: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am your Statutory Governance Assistant. Ask me about overdue inspections, expiring document validity, high-risk delay cases, or request a drafted deficiency notice. All queries are strictly role-scoped to your clearance (${user?.role || 'User'}).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiRequest<any>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: promptText })
      });

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: res.response_text || 'Query processed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: res.intent,
        data: res.data,
        draftContent: res.draft_content,
        isAiDraft: res.is_ai_draft
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: `Query error: ${err.message || 'Unable to communicate with assistant service.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef<boolean>(false);
  const [hasOtherOverlay, setHasOtherOverlay] = useState<boolean>(false);
  const [isTapped, setIsTapped] = useState<boolean>(false);
  const tapTimerRef = useRef<number | null>(null);

  const handlePointerDown = () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    setIsTapped(true);
  };

  const handlePointerUp = () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      setIsTapped(false);
      tapTimerRef.current = null;
    }, 250);
  };

  // Return focus to trigger button when closed
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      setTimeout(() => {
        triggerButtonRef.current?.focus();
      }, 50);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Hide button while any dialog, drawer, or modal is open in the app
  useEffect(() => {
    const checkOverlays = () => {
      const overlays = document.querySelectorAll(
        '[role="dialog"]:not(#ai-assistant-drawer), [aria-modal="true"]:not(#ai-assistant-drawer), [data-overlay="true"], .fixed.inset-0.z-50:not(#ai-assistant-backdrop)'
      );
      setHasOtherOverlay(overlays.length > 0);
    };

    checkOverlays();
    const observer = new MutationObserver(checkOverlays);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleCopyDraft = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedDraftId(id);
    setTimeout(() => setCopiedDraftId(null), 2000);
  };

  return (
    <>
      {/* Floating Action Button (Ask AI Pill) rendered via Portal into document.body */}
      {typeof document !== 'undefined' &&
        !isOpen &&
        !hasOtherOverlay &&
        createPortal(
          <button
            ref={triggerButtonRef}
            type="button"
            onClick={() => setIsOpen(true)}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => {
              if (isTapped) handlePointerUp();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handlePointerDown();
                handlePointerUp();
              }
            }}
            aria-label="Ask AI"
            title="Ask AI"
            className={`ask-ai-floating-btn ${isTapped ? 'is-tapped' : ''}`}
            style={{
              position: 'fixed',
              top: 'auto',
              left: 'auto',
              right: '24px',
              bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              zIndex: 40,
            }}
          >
            <Sparkles className="w-4 h-4 text-white shrink-0" />
            <span className="font-semibold text-sm text-white select-none">Ask AI</span>
          </button>,
          document.body
        )}

      {/* Slide-over Drawer / Modal Widget rendered via Portal into document.body */}
      {typeof document !== 'undefined' &&
        isOpen &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              id="ai-assistant-backdrop"
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] animate-backdrop-in"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <div
              id="ai-assistant-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Statutory Governance Assistant"
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white border-l border-[#E6E6E6] flex flex-col shadow-2xl animate-drawer-in"
            >
          {/* Header */}
          <div className="p-4 bg-white border-b border-[#E6E6E6] text-[#111111] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] flex items-center justify-center text-[#111111]">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5 text-[#111111]">
                  Statutory Governance Assistant
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] rounded font-mono font-semibold">
                    RBAC Scoped
                  </span>
                </h3>
                <p className="text-[11px] text-[#595959]">
                  Role: {user?.role} • Verified Service Clearance
                </p>
              </div>
            </div>

            <Button
              size="icon"
              aria-label="Close assistant"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="p-2.5 bg-[#F4F4F5] border-b border-[#E6E6E6] shrink-0 overflow-x-auto flex gap-1.5 scrollbar-none">
            {SAMPLE_PROMPTS.map((prompt, idx) => (
              <Button
                key={idx}
                size="sm"
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
                className="whitespace-nowrap shrink-0 text-[11px]"
              >
                {prompt}
              </Button>
            ))}
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-[6px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-[8px] p-3.5 space-y-2 ${msg.sender === 'user'
                    ? 'bg-[#18181B] text-white'
                    : 'bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111]'
                    }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                  {/* Render Structured Data Items if present */}
                  {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {msg.data.slice(0, 4).map((item: any, iIdx: number) => (
                        <div
                          key={iIdx}
                          className="p-2 bg-white rounded-[6px] border border-[#E6E6E6] text-[11px] space-y-0.5"
                        >
                          <div className="flex items-center justify-between font-bold text-[#111111]">
                            <span>{item.ref_no || item.doc_type || item.institution_name}</span>
                            {item.status && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#F4F4F5] text-[#111111] font-mono">
                                {item.status}
                              </span>
                            )}
                            {item.risk_score !== undefined && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] border border-[#E0202A] text-[#B5121A] font-bold font-mono">
                                Risk: {item.risk_score}
                              </span>
                            )}
                          </div>
                          {item.institution_name && (
                            <div className="text-[#595959] truncate">{item.institution_name}</div>
                          )}
                          {item.days_overdue !== undefined && (
                            <div className="text-[#B5121A] font-semibold text-[10px]">
                              Overdue by {item.days_overdue} days
                            </div>
                          )}
                          {item.days_remaining !== undefined && (
                            <div className="text-[#111111] font-medium text-[10px]">
                              Expires in {item.days_remaining} days ({item.expiry_date})
                            </div>
                          )}
                          {item.primary_driver && (
                            <div className="text-[#595959] text-[10px]">
                              Driver: {item.primary_driver}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Render Drafted Notice */}
                  {msg.draftContent && (
                    <div className="pt-2 space-y-2">
                      <div className="p-2 bg-white border border-[#E0202A] rounded-[6px] text-[#B5121A] text-[10px] font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#B5121A]" />
                          AI DRAFT — REQUIRES OFFICIAL REVIEW
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleCopyDraft(msg.draftContent || '', msg.id)}
                          className="h-7 min-h-7 px-2.5 text-[10px]"
                        >
                          {copiedDraftId === msg.id ? (
                            <Check className="w-3 h-3 mr-1" />
                          ) : (
                            <Copy className="w-3 h-3 mr-1" />
                          )}
                          {copiedDraftId === msg.id ? 'Copied' : 'Copy'}
                        </Button>
                      </div>

                      <pre className="p-3 bg-[#18181B] text-white rounded-[6px] font-mono text-[10px] overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
                        {msg.draftContent}
                      </pre>
                    </div>
                  )}

                  <div
                    className={`text-[9px] font-mono ${msg.sender === 'user' ? 'text-white/80 text-right' : 'text-[#595959]'
                      }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-[6px] bg-[#18181B] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-xs text-[#595959]">
                <div className="w-6 h-6 rounded-[6px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="p-3 bg-[#F4F4F5] rounded-[8px] border border-[#E6E6E6] text-[#111111]">
                  Querying role-scoped statutory clearance services...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-[#E6E6E6] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('assistant.placeholder', 'Ask a question or request notice draft...')}
                disabled={loading}
                className="flex-1 px-3.5 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !input.trim()}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-[10px] text-[#595959] text-center mt-1.5">
              Rule #2 Human Oversight: AI outputs are advisory drafts and cannot execute approvals.
            </p>
          </div>
        </div>
      </>,
      document.body
    )}
  </>
);
};
