import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

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
      text: `Namaste! I am the AICTE Statutory Governance Assistant. Ask me about overdue inspections, expiring document validity, high-risk delay cases, or request a drafted deficiency notice. All queries are strictly role-scoped to your clearance (${user?.role || 'User'}).`,
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

  const handleCopyDraft = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedDraftId(id);
    setTimeout(() => setCopiedDraftId(null), 2000);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 p-3.5 bg-gradient-to-r from-[#0B2240] to-blue-900 text-white rounded-full shadow-2xl hover:shadow-blue-900/40 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer border border-blue-400/40 group"
        title="Open AICTE Natural Language Assistant"
      >
        <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
        <span className="text-xs font-bold pr-1 hidden sm:inline">Ask AI Assistant</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
      </button>

      {/* Slide-over Drawer / Modal Widget */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 gov-header-gradient text-white flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300 flex items-center justify-center text-amber-300">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                  AICTE Statutory Assistant
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded font-mono font-bold">
                    RBAC Scoped
                  </span>
                </h3>
                <p className="text-[10px] text-blue-100/90">
                  Role: {user?.role} • Model: Verified Service Queries (No Raw SQL)
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 shrink-0 overflow-x-auto flex gap-1.5 scrollbar-none">
            {SAMPLE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-900 text-[11px] rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {prompt}
              </button>
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
                  <div className="w-6 h-6 rounded-md bg-[#0B2240] text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-[#0B2240] text-white rounded-br-xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                  {/* Render Structured Data Items if present */}
                  {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {msg.data.slice(0, 4).map((item: any, iIdx: number) => (
                        <div
                          key={iIdx}
                          className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] space-y-0.5"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-900">
                            <span>{item.ref_no || item.doc_type || item.institution_name}</span>
                            {item.status && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-700 font-mono">
                                {item.status}
                              </span>
                            )}
                            {item.risk_score !== undefined && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-100 text-rose-800 font-bold font-mono">
                                Risk: {item.risk_score}
                              </span>
                            )}
                          </div>
                          {item.institution_name && (
                            <div className="text-slate-600 truncate">{item.institution_name}</div>
                          )}
                          {item.days_overdue !== undefined && (
                            <div className="text-red-700 font-semibold text-[10px]">
                              Overdue by {item.days_overdue} days
                            </div>
                          )}
                          {item.days_remaining !== undefined && (
                            <div className="text-amber-700 text-[10px]">
                              Expires in {item.days_remaining} days ({item.expiry_date})
                            </div>
                          )}
                          {item.primary_driver && (
                            <div className="text-slate-500 text-[10px]">
                              Driver: {item.primary_driver}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Render Drafted Notice with Mandatory Human Review Watermark */}
                  {msg.draftContent && (
                    <div className="pt-2 space-y-2">
                      <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-[10px] font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          AI DRAFT — REQUIRES MANDATORY OFFICIAL HUMAN REVIEW
                        </span>
                        <button
                          onClick={() => handleCopyDraft(msg.draftContent || '', msg.id)}
                          className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[10px] font-semibold text-amber-800 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedDraftId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {copiedDraftId === msg.id ? 'Copied' : 'Copy Draft'}
                        </button>
                      </div>

                      <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
                        {msg.draftContent}
                      </pre>
                    </div>
                  )}

                  <div
                    className={`text-[9px] font-mono ${
                      msg.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-xs text-slate-500">
                <div className="w-6 h-6 rounded-md bg-[#0B2240] text-amber-300 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600">
                  Querying role-scoped statutory clearance services...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
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
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#0B2240] focus:bg-white"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-[#0B2240] hover:bg-[#07172C] text-white rounded-xl disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Strict Rule #2 Human Oversight: AI outputs are advisory drafts and cannot execute approvals.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

