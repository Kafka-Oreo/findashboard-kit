"use client";

import { useState, useRef, useEffect } from "react";
import { TeacherAvatar } from "@/components/report/teacher-avatar";

interface StreamChunk {
  type: "content" | "thinking" | "done" | "error";
  text?: string;
  message?: string;
}

export type PersonaType = "industry" | "ma" | "qian";

const SUGGESTED_QUESTIONS: Record<PersonaType, string[]> = {
  industry: [
    "算力链当前景气度如何？",
    "锂电行业现在处于什么周期位置？",
    "国产替代逻辑还能持续吗？",
    "怎么判断一个行业的持续性？",
    "六维分析框架怎么用？",
    "创新药板块有什么催化？",
  ],
  ma: [
    "如何从基本面判断行业景气度拐点？",
    "算力产业链的长期投资逻辑是什么？",
    "怎么看一个赛道的天花板空间？",
    "如何区分题材炒作和真正的产业趋势？",
    "创新药的估值体系怎么看？",
    "机械行业的周期位置怎么判断？",
  ],
  qian: [
    "当前市场情绪处于什么阶段？",
    "怎么判断连板梯队的强弱？",
    "龙头断板后市场怎么走？",
    "板块轮动的节奏怎么把握？",
    "冰点期的反弹怎么参与？",
    "怎么看资金流向的信号意义？",
  ],
};

const PERSONA_INFO: Record<PersonaType, { name: string; subtitle: string; icon: string }> = {
  industry: { name: "产业链助手", subtitle: "六维分析框架", icon: "💬" },
  ma: { name: "马老师", subtitle: "基本面·产业链深度", icon: "📊" },
  qian: { name: "钱老师", subtitle: "短线情绪·资金博弈", icon: "⚡" },
};

interface IndustryChainQAProps {
  defaultPersona?: PersonaType;
  compact?: boolean;
  showPersonaSwitch?: boolean;
  buttonText?: string;
  buttonIcon?: string;
  buttonAvatar?: string;
  darkMode?: boolean;
}

export function IndustryChainQA({
  defaultPersona = "industry",
  compact = false,
  showPersonaSwitch = true,
  buttonText = "产业链问答",
  buttonIcon = "💬",
  buttonAvatar,
  darkMode = false,
}: IndustryChainQAProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [persona, setPersona] = useState<PersonaType>(defaultPersona);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const personaInfo = PERSONA_INFO[persona];
  const suggestedQuestions = SUGGESTED_QUESTIONS[persona];

  useEffect(() => {
    if (answerRef.current && answer) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [answer, thinking]);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    if (isLoading) {
      abortRef.current?.abort();
    }
    setIsOpen(false);
  };

  const handlePersonaSwitch = (newPersona: PersonaType) => {
    if (newPersona === persona) return;
    setPersona(newPersona);
    setAnswer("");
    setThinking("");
    setError(null);
    setQuestion("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    setAnswer("");
    setThinking("");
    setError(null);
    setShowThinking(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/industry-chain-qa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: q, persona }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `请求失败 (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法获取响应流");

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
          const jsonStr = line.slice(6);
          try {
            const chunk: StreamChunk = JSON.parse(jsonStr);
            if (chunk.type === "content" && chunk.text) {
              setAnswer((prev) => prev + chunk.text);
            } else if (chunk.type === "thinking" && chunk.text) {
              setThinking((prev) => prev + chunk.text);
              setShowThinking(true);
            } else if (chunk.type === "error") {
              throw new Error(chunk.message || "生成失败");
            } else if (chunk.type === "done") {
              // 完成
            }
          } catch {
            // 忽略解析失败的块
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "生成失败");
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleSuggestion = (q: string) => {
    if (isLoading) return;
    setQuestion(q);
    // 自动提交
    setTimeout(() => {
      const form = document.getElementById("qa-form") as HTMLFormElement | null;
      form?.requestSubmit();
    }, 0);
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const formatAnswer = (text: string) => {
    // 简单的 Markdown 渲染：标题、列表、加粗
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuffer: string[] = [];

    const flushList = (key: number) => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul key={`ul-${key}`} className="list-disc list-inside space-y-1 my-2 pl-1">
            {listBuffer.map((item, i) => (
              <li key={i} className="text-[12px] leading-relaxed">
                {renderInline(item)}
              </li>
            ))}
          </ul>,
        );
        listBuffer = [];
      }
    };

    const renderInline = (str: string) => {
      // 处理 **加粗**
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
      // 标题
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

  return (
    <>
      {/* 收起态：头像/emoji 按钮 */}
      <button
        onClick={handleOpen}
        className="group flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary hover:bg-indigo-50 text-[11px] text-text-secondary hover:text-indigo-600 rounded-full transition-all duration-200"
        title={buttonText}
      >
        {buttonAvatar ? (
          <TeacherAvatar src={buttonAvatar} alt={buttonText} size={20} />
        ) : (
          <span className="text-[13px]">{buttonIcon}</span>
        )}
        <span className="font-medium">{buttonText}</span>
      </button>

      {/* 弹窗 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={handleClose}
        >
          <div
            className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题 */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="text-[14px] text-text-primary font-semibold flex items-center gap-2">
                <span className="text-[16px]">🧠</span>
                产业链智能问答
                <span className="text-[10px] text-text-muted font-normal">
                  基于六维分析框架
                </span>
              </div>
              <div className="flex items-center gap-1">
                {thinking && (
                  <button
                    onClick={() => setShowThinking((s) => !s)}
                    className="px-2.5 py-1 text-[10px] text-text-muted hover:text-text-secondary hover:bg-surface-secondary rounded-full transition-colors"
                  >
                    {showThinking ? "隐藏思考" : "查看思考"}
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-secondary text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 分身切换 */}
            {showPersonaSwitch && (
              <div className="flex gap-1.5 px-5 pt-3 pb-1">
                {(Object.keys(PERSONA_INFO) as PersonaType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePersonaSwitch(p)}
                    className={`flex-1 py-2 px-3 rounded-lg text-[12px] font-medium transition-all ${
                      persona === p
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'bg-surface-secondary text-text-secondary hover:bg-border/50'
                    }`}
                  >
                    <span className="mr-1">{PERSONA_INFO[p].icon}</span>
                    {PERSONA_INFO[p].name}
                  </button>
                ))}
              </div>
            )}

            <div className="p-5 flex-1 overflow-y-auto">{/* 输入框 */}
              <form id="qa-form" onSubmit={handleSubmit} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="输入行业或产业链问题，如：算力链当前景气度如何？"
                    className="flex-1 px-4 py-2.5 bg-surface-secondary border border-border rounded-full text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo-400 transition-colors"
                    disabled={isLoading}
                  />
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="px-5 py-2.5 bg-text-muted text-white rounded-full text-[12px] font-medium hover:bg-text-secondary transition-colors"
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!question.trim()}
                      className="px-5 py-2.5 bg-indigo-500 text-white rounded-full text-[12px] font-medium hover:bg-indigo-600 disabled:bg-surface-secondary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
                    >
                      提问
                    </button>
                  )}
                </div>
              </form>

              {/* 推荐问题 */}
              {!answer && !isLoading && (
                <div className="mb-4">
                  <div className="text-[11px] text-text-muted mb-2">试试这些问题：</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQuestions.map((q: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestion(q)}
                        className="px-3 py-1.5 bg-surface-secondary text-[11px] text-text-secondary rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 思考过程 */}
              {showThinking && thinking && (
                <div className="mb-4 p-3 bg-surface-secondary rounded-lg border border-dashed border-border">
                  <div className="text-[10px] text-text-muted mb-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    思考过程
                  </div>
                  <div className="text-[11px] text-text-muted leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {thinking}
                    {isLoading && <span className="inline-block w-1.5 h-3 bg-text-muted ml-0.5 animate-pulse align-middle" />}
                  </div>
                </div>
              )}

              {/* 回答区域 */}
              {(answer || isLoading || error) && (
                <div
                  ref={answerRef}
                  className="p-4 bg-surface-secondary/50 rounded-lg max-h-64 overflow-y-auto"
                >
                  {error ? (
                    <div className="text-[12px] text-red-500">
                      ⚠️ {error}
                    </div>
                  ) : answer ? (
                    <div className="space-y-1">{formatAnswer(answer)}</div>
                  ) : isLoading ? (
                    <div className="flex items-center gap-2 text-text-muted">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[12px]">正在分析...</span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* 数据来源 */}
              {answer && !isLoading && (
                <div className="mt-3 text-[10px] text-text-muted flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  回答基于产业链研究语料生成，仅供参考，不构成投资建议
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
