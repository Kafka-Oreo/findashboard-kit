"use client";

import { useState, useRef, useEffect } from "react";

interface StreamChunk {
  type: "content" | "thinking" | "done" | "error" | "ready";
  text?: string;
  message?: string;
}

const SUGGESTED_QUESTIONS = [
  "下周有哪些重要事件？",
  "最近有哪些宏观政策？",
  "有哪些财报需要关注？",
  "最近的风险事件有哪些？",
  "本周市场级别的大事是什么？",
  "行业方面有什么催化？",
];

interface CalendarQAProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarQA({ isOpen, onClose }: CalendarQAProps) {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (answerRef.current && answer) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [answer, thinking]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || isLoading) return;

    setAnswer("");
    setThinking("");
    setShowThinking(false);
    setError(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/calendar-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "请求失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6));
            if (chunk.type === "content" && chunk.text) {
              setAnswer((prev) => prev + chunk.text);
            } else if (chunk.type === "thinking" && chunk.text) {
              setThinking((prev) => prev + chunk.text);
            } else if (chunk.type === "error" && chunk.message) {
              setError(chunk.message);
              setIsLoading(false);
            } else if (chunk.type === "done") {
              setIsLoading(false);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // 用户主动停止
      } else {
        setError((err as Error).message || "请求失败");
      }
      setIsLoading(false);
    }
  };

  const handleSuggestion = (q: string) => {
    setQuestion(q);
  };

  // Markdown 简易渲染
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuffer: string[] = [];

    const flushList = (idx: number) => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul key={`ul-${idx}`} className="list-disc list-inside space-y-1 mb-2 text-[12px] text-text-secondary">
            {listBuffer.map((item, i) => (
              <li key={i}>{renderInline(item)}</li>
            ))}
          </ul>,
        );
        listBuffer = [];
      }
    };

    const renderInline = (str: string) => {
      const parts = str.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-text-primary">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });
    };

    lines.forEach((line, idx) => {
      if (line.startsWith("### ")) {
        flushList(idx);
        elements.push(
          <h3 key={idx} className="text-[13px] font-semibold text-text-primary mt-4 mb-1.5">
            {renderInline(line.slice(4))}
          </h3>,
        );
      } else if (line.startsWith("## ")) {
        flushList(idx);
        elements.push(
          <h2 key={idx} className="text-[14px] font-semibold text-text-primary mt-4 mb-2">
            {renderInline(line.slice(3))}
          </h2>,
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        listBuffer.push(line.slice(2));
      } else if (line.match(/^\d+\./)) {
        listBuffer.push(line.replace(/^\d+\.\s*/, ""));
      } else if (line.trim() === "") {
        flushList(idx);
        elements.push(<div key={idx} className="h-2" />);
      } else {
        flushList(idx);
        elements.push(
          <p key={idx} className="text-[12px] leading-relaxed text-text-secondary">
            {renderInline(line)}
          </p>,
        );
      }
    });

    flushList(lines.length);
    return elements;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between flex-shrink-0">
          <div className="text-[14px] text-[#111827] dark:text-[#F4F4F5] font-semibold flex items-center gap-2">
            <span className="text-[16px]">📅</span>
            日历智能问答
            <span className="text-[10px] text-[#94A3B8] dark:text-[#71717A] font-normal">
              基于财经事件数据
            </span>
          </div>
          <div className="flex items-center gap-1">
            {thinking && (
              <button
                type="button"
                onClick={() => setShowThinking((s) => !s)}
                className="px-2.5 py-1 text-[10px] text-[#94A3B8] dark:text-[#71717A] hover:text-[#64748B] dark:hover:text-[#A1A1AA] hover:bg-[#F1F5F9] dark:hover:bg-[#27272A] rounded-full transition-colors"
              >
                {showThinking ? "隐藏思考" : "查看思考"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#27272A] text-[#94A3B8] dark:text-[#71717A] hover:text-[#111827] dark:hover:text-[#F4F4F5] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {/* 输入框 */}
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="问问下周有哪些大事…"
                className="flex-1 px-4 py-2.5 bg-[#F7F8FA] dark:bg-[#09090B] border border-[#E5E7EB] dark:border-[#27272A] rounded-full text-[13px] text-[#111827] dark:text-[#F4F4F5] placeholder:text-[#94A3B8] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#3B82F6] transition-colors"
                disabled={isLoading}
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-5 py-2.5 bg-[#64748B] dark:bg-[#52525B] text-white rounded-full text-[12px] font-medium hover:bg-[#475569] dark:hover:bg-[#3F3F46] transition-colors"
                >
                  停止
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!question.trim()}
                  className="px-5 py-2.5 bg-[#2563EB] dark:bg-[#3B82F6] text-white rounded-full text-[12px] font-medium hover:bg-[#1D4ED8] dark:hover:bg-[#2563EB] disabled:bg-[#E5E7EB] dark:disabled:bg-[#27272A] disabled:text-[#94A3B8] dark:disabled:text-[#71717A] disabled:cursor-not-allowed transition-colors"
                >
                  提问
                </button>
              )}
            </div>
          </form>

          {/* 推荐问题 */}
          {!answer && !isLoading && !error && (
            <div className="mb-4">
              <div className="text-[11px] text-[#64748B] dark:text-[#A1A1AA] mb-2">试试这些问题：</div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSuggestion(q)}
                    className="px-3 py-1.5 bg-[#F7F8FA] dark:bg-[#121214] text-[11px] text-[#64748B] dark:text-[#A1A1AA] rounded-full hover:bg-[#EFF6FF] dark:hover:bg-[#172554] hover:text-[#2563EB] dark:hover:text-[#3B82F6] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 思考过程 */}
          {showThinking && thinking && (
            <div className="mb-4 p-3 bg-[#F7F8FA] dark:bg-[#09090B] rounded-lg border border-dashed border-[#E5E7EB] dark:border-[#27272A]">
              <div className="text-[10px] text-[#94A3B8] dark:text-[#71717A] mb-1.5 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                思考过程
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-[#A1A1AA] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {thinking}
                {isLoading && (
                  <span className="inline-block w-1.5 h-3 bg-[#94A3B8] dark:bg-[#71717A] ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            </div>
          )}

          {/* 回答区域 */}
          {(answer || isLoading || error) && (
            <div
              ref={answerRef}
              className="p-4 bg-[#F7F8FA] dark:bg-[#09090B]/50 rounded-lg max-h-64 overflow-y-auto"
            >
              {error ? (
                <div className="text-[12px] text-red-500">{error}</div>
              ) : (
                <>
                  {renderMarkdown(answer)}
                  {isLoading && !answer && (
                    <div className="text-[12px] text-[#94A3B8] dark:text-[#71717A]">
                      正在整理事件数据…
                      <span className="inline-block w-1.5 h-3 bg-[#94A3B8] dark:bg-[#71717A] ml-1 animate-pulse align-middle" />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
