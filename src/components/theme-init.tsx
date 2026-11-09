'use client';

import { useEffect } from 'react';

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

export function ThemeInit() {
  useEffect(() => {
    const mode = (localStorage.getItem('theme-mode') as ThemeMode) || 'dark';
    applyTheme(mode);

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  return null;
}
