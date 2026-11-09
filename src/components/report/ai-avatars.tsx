"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Users,
  RefreshCw,
  CandlestickChart,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { TeacherAvatar } from "@/components/report/teacher-avatar";

interface Teacher {
  id: string;
  name: string;
  title: string;
  avatar: string;
  side: "bull" | "bear";
  /** 派别标签文案，如「龙头派」「稳健派」 */
  sideName: string;
  style: string;
  goodAt: string;
  /** 对话弹窗中的一句话自我介绍 */
  intro: string;
}

const teachers: Teacher[] = [
  {
    id: "ma",
    name: "马老师",
    title: "龙头派掌门",
    avatar: "/avatars/analyst-a.svg",
    side: "bull",
    sideName: "龙头派",
    style: "趋势 · 龙头 · 打板",
    goodAt: "短线情绪 · 连板梯队",
    intro: "龙头战法、打板、连板情绪，有什么想问的？",
  },
  {
    id: "qianduo",
    name: "钱多多",
    title: "稳健型掌门",
    avatar: "/avatars/analyst-b.svg",
    side: "bear",
    sideName: "稳健派",
    style: "趋势跟踪 · 风控第一",
    goodAt: "趋势 · 选股 · 风控",
    intro: "趋势跟踪、风控选股，有什么想聊的？",
  },
];

/**
 * 两张老师卡片的主题视觉配置。
 * 左「龙头派」暖杏橙、右「稳健派」薄荷绿，配色克制，仅作浅色底 + 主题色点缀。
 */
interface TeacherTheme {
  card: string;
  tag: string;
  avatarBg: string;
  avatarPattern: string;
  personality: string;
  iconColor: string;
  cta: string;
  avatarPatternIcon: LucideIcon;
  styleIcon: LucideIcon;
  skillIcon: LucideIcon;
}

const teacherTheme: Record<Teacher["side"], TeacherTheme> = {
  bull: {
    card: "border-[#F3E8D5] bg-[#FFFCF7] hover:border-[#F59E0B]/45 dark:border-[#F6B73C]/20 dark:bg-[#1A1608] dark:hover:border-[#F6B73C]/40",
    tag: "bg-[#FDEFD0] text-[#C9821C] dark:bg-[#3A2C12] dark:text-[#F5C96B]",
    avatarBg:
      "bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.08),rgba(245,158,11,0.02)_72%)]",
    avatarPattern: "text-[#F6B73C]/12 dark:text-[#F6B73C]/10",
    personality: "text-[#C9821C] dark:text-[#E8B050]",
    iconColor: "text-[#E78A00] dark:text-[#F5C96B]",
    cta: "bg-[#FFF3D9] text-[#B5760A] group-hover:bg-[#FFEBC4] dark:bg-[#2A2110] dark:text-[#F0BE5A] dark:group-hover:bg-[#33280F]",
    avatarPatternIcon: TrendingUp,
    styleIcon: TrendingUp,
    skillIcon: Users,
  },
  bear: {
    card: "border-[#DDEFE7] bg-[#F7FCFA] hover:border-[#22B77A]/45 dark:border-[#34C77B]/20 dark:bg-[#07150E] dark:hover:border-[#34C77B]/40",
    tag: "bg-[#DDF3E9] text-[#15855B] dark:bg-[#123524] dark:text-[#6FD6A3]",
    avatarBg:
      "bg-[radial-gradient(circle_at_center,rgba(34,183,122,0.08),rgba(34,183,122,0.02)_72%)]",
    avatarPattern: "text-[#34C77B]/12 dark:text-[#34C77B]/10",
    personality: "text-[#15855B] dark:text-[#6FD6A3]",
    iconColor: "text-[#1AA56D] dark:text-[#6FD6A3]",
    cta: "bg-[#E4F6EE] text-[#14905C] group-hover:bg-[#D3EFE1] dark:bg-[#0E2A1B] dark:text-[#6BD0A0] dark:group-hover:bg-[#123324]",
    avatarPatternIcon: CandlestickChart,
    styleIcon: CheckCircle2,
    skillIcon: RefreshCw,
  },
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 聊天气泡内的 Markdown 渲染配置（助手回复）。
 * 仅覆盖常用语法，样式与 Apple 风格设计语言一致；
 * 流式输出过程中未闭合的 Markdown 语法由 react-markdown 自动容错。
 */
const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 ml-4 list-disc space-y-1 marker:text-current/60">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 ml-4 list-decimal space-y-1 marker:text-current/60">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mb-1.5 mt-2.5 text-[15px] font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-2.5 text-[14px] font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-[13px] font-semibold first:mt-0">{children}</h3>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-current/25 pl-2.5 text-[#475569] dark:text-[#A6B0BE]">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return <code className="font-mono text-[12px]">{children}</code>;
    }
    return (
      <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[12px] dark:bg-white/10">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-black/[0.06] p-2.5 dark:bg-white/10">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-2.5 border-current/15" />,
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-current/15 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-current/15 px-2 py-1 align-top">{children}</td>
  ),
};

export default function AIAvatars() {
  const [activeTeacher, setActiveTeacher] = useState<Teacher | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (overrideText?: string) => {
    const userMsg = (overrideText ?? input).trim();
    if (!userMsg || !activeTeacher || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher: activeTeacher.id,
          message: userMsg,
          messages: messages.slice(-10),
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("请求失败");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      // SSE 帧可能跨 TCP 分片，保留不完整的尾部帧待下一块拼接
      let sseBuffer = "";
      let streamError = "";

      const processSseChunk = (chunk: string) => {
        sseBuffer += chunk;
        const frames = sseBuffer.split("\n\n");
        // 最后一段可能是不完整帧，留在 buffer 里等下一块
        sseBuffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              streamError = String(parsed.error);
              continue;
            }
            if (parsed.content) {
              assistantContent += parsed.content;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantContent };
                return next;
              });
            }
          } catch {
            // ignore parse errors on incomplete/partial frames
          }
        }
      };

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          processSseChunk(decoder.decode(value, { stream: true }));
        }
        // 流结束后处理 buffer 中残余的最后一帧
        processSseChunk("\n\n");
      }

      // 后端流式报错：把错误信息写进气泡（非用户主动中断场景）
      if (streamError && !assistantContent) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: "抱歉，服务出了点小问题，稍后再试吧。" };
          return next;
        });
      } else if (!assistantContent && !controller.signal.aborted) {
        // 流正常结束但没有任何内容
        setMessages((prev) => {
          const next = [...prev];
          if (!next[next.length - 1].content) {
            next[next.length - 1] = { role: "assistant", content: "（本次没有返回内容，请换个问题再试）" };
          }
          return next;
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，出了点小问题，稍后再试吧。" }]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleCardClick = (teacher: Teacher) => {
    setActiveTeacher(teacher);
    setMessages([]);
    setInput("");
  };

  const handleClose = () => {
    if (loading && abortRef.current) {
      abortRef.current.abort();
    }
    setActiveTeacher(null);
    setLoading(false);
  };

  const quickQuestions = [
    "今天市场情绪怎么样？",
    "怎么判断一只股票是分歧还是修复？",
    "分析板块一般看哪几个维度？",
    "仓位和止损一般怎么控制？",
  ];

  return (
    <div>
      {/* 标题区：AI 装饰图标 + 大标题 + 辅助提示 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[#2563EB] dark:text-[#60A5FA]" aria-hidden />
          <h2 className="text-[32px] font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] dark:text-[#F5F5F7]">
            <span className="text-[#2563EB] dark:text-[#60A5FA]">AI</span> 投顾助手
          </h2>
        </div>
        <span className="text-[15px] font-medium text-[#64748B] dark:text-[#94A3B8]">
          点击卡片提问
        </span>
      </div>

      <p className="mt-2.5 max-w-[620px] text-[17px] leading-relaxed text-[#475569] dark:text-[#A6B0BE]">
        两位老师从不同风格出发，已接入万得 Wind 今日盘面数据，帮你全面看市场
      </p>

      {/* 两位老师卡片：横向 AI 投顾入口 */}
      <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {teachers.map((t) => {
          const theme = teacherTheme[t.side];
          const StyleIcon = theme.styleIcon;
          const SkillIcon = theme.skillIcon;
          const PatternIcon = theme.avatarPatternIcon;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleCardClick(t)}
              aria-label={`向${t.name}（${t.sideName}）提问`}
              className={cn(
                "group relative flex h-auto min-h-[360px] w-full flex-col overflow-hidden rounded-[28px] border p-6 text-left md:min-h-0 lg:aspect-[2/1]",
                "cursor-pointer shadow-[0_10px_30px_rgba(15,23,42,0.05)]",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]",
                "active:translate-y-0 active:shadow-[0_10px_30px_rgba(15,23,42,0.05)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 dark:focus-visible:ring-[#3B82F6] dark:focus-visible:ring-offset-black",
                theme.card,
              )}
            >
              {/* 主体：38% 头像 + 62% 信息 */}
              <div className="flex flex-1 flex-col items-center gap-5 md:grid md:grid-cols-[minmax(110px,32%)_1fr] md:items-center md:gap-4 lg:grid-cols-[minmax(140px,38%)_1fr] lg:gap-6">
                {/* 左侧头像区 */}
                <div className="relative flex items-center justify-center self-center">
                  <span className={cn("absolute -inset-1.5 rounded-full", theme.avatarBg)} aria-hidden />
                  <PatternIcon
                    className={cn(
                      "pointer-events-none absolute bottom-0 right-0 h-6 w-6 -rotate-12",
                      theme.avatarPattern,
                    )}
                    aria-hidden
                  />
                  <TeacherAvatar
                    src={t.avatar}
                    alt={`${t.name}的头像`}
                    size={120}
                    className="relative z-10 transition-transform duration-300 ease-out group-hover:scale-[1.02] md:!h-[100px] md:!w-[100px] lg:!h-[120px] lg:!w-[120px]"
                  />
                </div>

                {/* 右侧信息区 */}
                <div className="flex min-w-0 flex-col justify-center">
                  {/* 姓名 + Badge（同一视觉层级，禁止换行） */}
                  <div className="flex items-center gap-2 whitespace-nowrap md:gap-3">
                    <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] dark:text-[#F5F5F7] md:text-[32px] lg:text-[36px]">
                      {t.name}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-[30px] shrink-0 items-center rounded-full px-3 text-[12px] font-semibold leading-none whitespace-nowrap md:h-[34px] md:px-4 md:text-[13px] lg:h-[36px] lg:px-5",
                        theme.tag,
                      )}
                    >
                      {t.sideName}
                    </span>
                  </div>

                  {/* 人格定位 */}
                  <div
                    className={cn(
                      "mt-1.5 whitespace-nowrap text-[18px] font-semibold leading-snug tracking-[-0.01em] md:text-[21px] lg:text-[23px]",
                      theme.personality,
                    )}
                  >
                    “{t.title}”
                  </div>

                  {/* 风格 / 擅长（完整显示内容） */}
                  <div className="mt-3 space-y-1 lg:mt-4">
                    <div className="flex items-center gap-2.5">
                      <StyleIcon className={cn("h-4 w-4 shrink-0", theme.iconColor)} aria-hidden />
                      <span className="w-10 shrink-0 text-[14px] font-medium text-[#94A3B8] dark:text-[#7C8896]">
                        风格
                      </span>
                      <span className="text-[13px] font-medium text-[#334155] dark:text-[#D6DEE8] md:text-[15px] lg:text-[16px]">
                        {t.style}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <SkillIcon className={cn("h-4 w-4 shrink-0", theme.iconColor)} aria-hidden />
                      <span className="w-10 shrink-0 text-[14px] font-medium text-[#94A3B8] dark:text-[#7C8896]">
                        擅长
                      </span>
                      <span className="text-[13px] font-medium text-[#334155] dark:text-[#D6DEE8] md:text-[15px] lg:text-[16px]">
                        {t.goodAt}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA：左右留白，自然融入底部 */}
              <div className="mt-auto w-[calc(100%-64px)] self-center pt-4 md:pt-5">
                <span
                  className={cn(
                    "flex h-[52px] w-full items-center justify-center gap-3 rounded-[17px] text-[17px] font-semibold",
                    "transition-colors duration-300",
                    theme.cta,
                  )}
                >
                  <span>向{t.name}提问</span>
                  <ArrowRight
                    className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!activeTeacher} onOpenChange={handleClose}>
        <DialogContent className="flex h-[80vh] max-h-[700px] min-h-[500px] w-[95vw] max-w-[520px] flex-col p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {activeTeacher && (
                <TeacherAvatar src={activeTeacher.avatar} alt={activeTeacher.name} size={32} />
              )}
              <span>{activeTeacher?.name} · {activeTeacher?.title}</span>
            </DialogTitle>
          </DialogHeader>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
          >
            {messages.length === 0 ? (
              <div className="flex gap-2.5 py-1">
                {activeTeacher && (
                  <TeacherAvatar src={activeTeacher.avatar} alt={activeTeacher.name} size={36} className="mt-1" />
                )}
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-[#0F172A] dark:text-[#F5F5F7]">
                        你好，我是{activeTeacher?.name}
                      </span>
                      {activeTeacher && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                            activeTeacher.side === "bull"
                              ? "bg-[#FDEFD0] text-[#C9821C] dark:bg-[#3A2C12] dark:text-[#F5C96B]"
                              : "bg-[#DDF3E9] text-[#15855B] dark:bg-[#123524] dark:text-[#6FD6A3]",
                          )}
                        >
                          {activeTeacher.sideName} · {activeTeacher.title}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm leading-relaxed text-[#475569] dark:text-[#A6B0BE]">
                      {activeTeacher?.intro}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#64748B] dark:bg-white/[0.06] dark:text-[#A6B0BE]">
                        <ShieldCheck className="h-3 w-3" aria-hidden />
                        已接入万得 Wind 今日盘面数据
                      </span>
                      <span className="text-[11px] text-[#94A3B8] dark:text-[#7C8896]">
                        方法论交流，不构成投资建议
                      </span>
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    {quickQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSend(q)}
                        className="block w-full rounded-xl border border-border bg-card px-3.5 py-2 text-left text-sm text-[#334155] transition-colors hover:border-accent hover:text-accent dark:text-[#D1D1D6]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {m.role === "assistant" && activeTeacher && (
                      <TeacherAvatar src={activeTeacher.avatar} alt={activeTeacher.name} size={26} />
                    )}
                    {m.role === "user" ? (
                      <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl bg-accent px-3 py-2 text-[13px] leading-relaxed text-white">
                        {m.content}
                      </div>
                    ) : (
                      <div className="max-w-[88%] rounded-2xl bg-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-[#1E293B] dark:text-[#E2E8F0]">
                        {m.content ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {m.content}
                          </ReactMarkdown>
                        ) : (
                          loading &&
                          i === messages.length - 1 && (
                            <span className="inline-block h-4 w-1 animate-pulse bg-current" />
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t p-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入你的问题..."
                className="flex-1 h-8"
                disabled={loading}
              />
              <Button type="submit" size="sm" disabled={!input.trim() || loading} className="h-8 px-2.5">
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
