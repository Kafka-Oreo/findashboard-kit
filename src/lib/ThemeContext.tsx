'use client';

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { getChartTheme, createTooltipConfig, createAxisConfig, type ChartThemeConfig } from '@/lib/chartTheme';

interface ThemeContextValue {
  isDark: boolean;
  theme: ChartThemeConfig;
  tooltip: ReturnType<typeof createTooltipConfig>;
  axis: ReturnType<typeof createAxisConfig>;
  split: { lineStyle: { color: string } };
  textColor: string;
  axisColor: string;
  labelColor: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      const root = document.documentElement;
      setIsDark(root.classList.contains('dark'));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const theme = useMemo(() => getChartTheme(isDark), [isDark]);

  const value = useMemo<ThemeContextValue>(() => ({
    isDark,
    theme,
    tooltip: createTooltipConfig(theme),
    axis: createAxisConfig(theme),
    split: { lineStyle: { color: theme.grid } },
    textColor: theme.text,
    axisColor: theme.axis,
    labelColor: theme.axis,
  }), [isDark, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useChartTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useChartTheme must be used within a ThemeProvider');
  }
  return context;
}
