'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { ExportFormat } from '@/hooks/use-export-report';

interface ToolboxProps {
  onExport: (format: ExportFormat) => void;
  isExporting?: boolean;
}

export function Toolbox({ onExport, isExporting = false }: ToolboxProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleShare = useCallback(async () => {
    setOpen(false);
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      toast.success('链接已复制', {
        description: '可以粘贴分享给朋友了',
        duration: 2000,
      });
    } catch {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast.success('链接已复制', {
        description: '可以粘贴分享给朋友了',
        duration: 2000,
      });
    }
  }, []);

  const handleExportClick = useCallback(
    (format: ExportFormat) => {
      setOpen(false);
      onExport(format);
    },
    [onExport],
  );

  return (
    <div className="relative" data-export-hide>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setOpen(!open)}
          disabled={isExporting}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-border bg-transparent hover:bg-accent/50 transition-colors text-text-primary disabled:opacity-50"
          title="工具箱"
          aria-label="工具箱"
        >
          {isExporting ? (
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 108 8h-2a6 6 0 11-6-6z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>

        {open && !isExporting && (
          <div
            ref={dropdownRef}
            className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-surface dark:bg-surface-secondary shadow-xl z-50 overflow-hidden"
          >
            <div className="px-4 pt-3 pb-1">
              <span className="text-[10px] text-text-muted uppercase tracking-wider">分享</span>
            </div>
            <button
              onClick={handleShare}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary dark:hover:bg-card-content transition-colors"
            >
              <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              <span>复制链接</span>
            </button>

            <div className="h-px bg-border/50" />

            <div className="px-4 pt-3 pb-1">
              <span className="text-[10px] text-text-muted uppercase tracking-wider">导出完整日报</span>
            </div>
            <button
              onClick={() => handleExportClick('png')}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary dark:hover:bg-card-content transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>PNG 无损图片</span>
              </span>
              <span className="text-[10px] text-text-muted">推荐</span>
            </button>
            <button
              onClick={() => handleExportClick('jpg')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary dark:hover:bg-card-content transition-colors"
            >
              <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>JPG 压缩图片</span>
            </button>
            <button
              onClick={() => handleExportClick('pdf')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary dark:hover:bg-card-content transition-colors"
            >
              <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>PDF 文档</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
