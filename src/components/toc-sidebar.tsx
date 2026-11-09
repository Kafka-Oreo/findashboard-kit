'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export interface TocItem {
  id: string;
  label: string;
  group?: string;
}

const tocItems: TocItem[] = [
  { id: 'sec-temperature', label: '市场情绪温度', group: '情绪' },
  { id: 'sec-catalysts', label: '催化因素', group: '情绪' },
  { id: 'sec-ladder', label: '连板梯队', group: '情绪' },
  { id: 'sec-intraday', label: '板块解析', group: '数据' },
  { id: 'sec-signals', label: '交易信号', group: '策略' },
  { id: 'sec-institutional', label: '机构观点', group: '观点' },
  { id: 'sec-risk-warnings', label: '避雷提醒', group: '观点' },
];

function TocItemButton({ item, activeId, onClick }: { item: TocItem; activeId: string; onClick: (id: string) => void }) {
  const [isClicking, setIsClicking] = useState(false);
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const isActive = activeId === item.id;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Calculate ripple position
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setRipplePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    setIsClicking(true);
    onClick(item.id);

    // Reset click animation
    setTimeout(() => setIsClicking(false), 400);
  };

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      className={`relative block w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-all duration-200 ${
        isActive
          ? 'bg-accent text-warning font-medium border-l-2 border-warning shadow-[0_0_8px_rgba(245,158,11,0.15)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 border-l-2 border-transparent'
      } ${isClicking ? 'bg-accent' : ''}`}
      style={{ transition: 'all 0.15s ease-out' }}
    >
      {/* Active indicator dot */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-warning rounded-r-full shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
      )}

      <span className="relative z-10">{item.label}</span>
    </button>
  );
}

export function TocSidebar({
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const [activeId, setActiveId] = useState('');
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;
  const setCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === 'function' ? value(collapsed) : value;
      if (!isControlled) {
        setInternalCollapsed(next);
      }
      onCollapsedChange?.(next);
    },
    [collapsed, isControlled, onCollapsedChange]
  );
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCollapse = (value: boolean) => {
    setCollapsed(value);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Skip updates if we're in the middle of a programmatic scroll
        if (isScrollingRef.current) return;

        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            const ai = tocItems.findIndex((t) => t.id === a.target.id);
            const bi = tocItems.findIndex((t) => t.id === b.target.id);
            return ai - bi;
          });
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    tocItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // Set flag to prevent IntersectionObserver from updating during scroll
      isScrollingRef.current = true;
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Immediately set the active item to the clicked one
      setActiveId(id);

      // Offset for sticky header (about 90px)
      const headerOffset = 90;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // Re-enable IntersectionObserver after scroll completes
      // Use a longer timeout to ensure scroll animation finishes
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 1000);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const groups = Array.from(new Set(tocItems.map((i) => i.group).filter(Boolean))) as string[];

  return (
    <>
      {/* Spacer to push content when TOC is open */}
      <div
        className={`hidden md:block flex-shrink-0 transition-all duration-300 ease-out ${
          collapsed ? 'w-0' : 'w-[180px]'
        }`}
      />

      {/* Fixed TOC Panel */}
      <div
        className={`hidden md:flex fixed left-0 top-0 h-screen z-40 transition-transform duration-300 ease-out bg-background border-r border-border ${
          collapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
        style={{ width: '180px' }}
      >
        <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-2">
          {/* Header with collapse button */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[11px] text-muted-foreground uppercase tracking-[2px] font-medium">目录</span>
            <button
              onClick={() => handleCollapse(true)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-warning hover:bg-accent transition-colors"
              title="收起目录"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>

          {/* TOC Items */}
          {groups.map((group) => (
            <div key={group} className="mb-2">
              <div className="text-[9px] text-muted-foreground uppercase tracking-[1.5px] px-2 py-1 font-medium">
                {group}
              </div>
              <div className="space-y-0.5">
                {tocItems
                  .filter((i) => i.group === group)
                  .map((item) => (
                    <TocItemButton key={item.id} item={item} activeId={activeId} onClick={handleClick} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collapse toggle button - shown when collapsed */}
      <div
        className={`hidden md:flex fixed left-0 top-4 z-50 transition-all duration-300 ${
          collapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={() => handleCollapse(false)}
          className="w-8 h-8 flex items-center justify-center rounded-r-lg bg-card border border-l-0 border-border text-muted-foreground hover:text-warning hover:bg-accent transition-colors"
          title="展开目录"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </>
  );
}
