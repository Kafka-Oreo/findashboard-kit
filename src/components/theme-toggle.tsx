'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  let isDark: boolean;
  if (mode === 'system') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    isDark = mode === 'dark';
  }
  root.classList.remove('dark', 'light');
  root.classList.add(isDark ? 'dark' : 'light');
}

export function ThemeToggle() {
  // 使用固定默认值避免 hydration 不匹配，客户端挂载后再读取 localStorage
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const stored = localStorage.getItem('theme-mode') as ThemeMode | null;
    const initialMode = stored || 'dark';
    setMode(initialMode);
    applyTheme(initialMode);
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    applyTheme(mode);
    localStorage.setItem('theme-mode', mode);

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [mode]);

  const handleSelect = useCallback((m: ThemeMode) => {
    setMode(m);
    setOpen(false);
  }, []);

  const icons: Record<ThemeMode, string> = {
    light: '☀️',
    dark: '🌙',
    system: '💻',
  };

  const labels: Record<ThemeMode, string> = {
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-colors bg-surface dark:bg-surface-secondary hover:bg-surface-secondary dark:hover:bg-surface-secondary text-text-primary border border-border dark:border-border"
        title="切换主题"
      >
        <span className="text-sm">{icons[mode]}</span>
        <span className="hidden sm:inline">{labels[mode]}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-32 rounded-xl border border-border dark:border-border bg-surface dark:bg-surface shadow-lg overflow-hidden">
            {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleSelect(m)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  mode === m
                    ? 'bg-[#e8e8ed] dark:bg-surface-secondary text-primary dark:text-primary'
                    : 'text-text-primary dark:text-text-secondary hover:bg-background dark:hover:bg-surface-secondary/50 hover:text-primary dark:hover:text-primary'
                }`}
              >
                <span className="text-sm">{icons[m]}</span>
                <span>{labels[m]}</span>
                {mode === m && (
                  <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
