'use client';

import { useCallback, useRef, useState } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { dashboardConfig } from '@/config/dashboard.config';

export type ExportFormat = 'png' | 'jpg' | 'pdf';
export type ExportSize = 'desktop' | 'tablet' | 'mobile';

export interface UseExportReportOptions {
  /** Filename base (without extension). Defaults to `${site.exportPrefix}_${date}` from dashboard.config. */
  filename?: string;
  /** Pixel ratio for rasterization. */
  pixelRatio?: number;
}

export interface UseExportReportReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  isExporting: boolean;
  exportReport: (format: ExportFormat, size?: ExportSize) => Promise<void>;
}

/**
 * 导出尺寸配置
 * - desktop: 电脑横版，1024px 宽（标准阅读尺寸）
 * - tablet: 平板横版，800px 宽（接近 iPad 横屏内宽）
 * - mobile: 手机竖版，420px 宽（接近主流手机内宽）
 */
const EXPORT_SIZE_CONFIG: Record<ExportSize, { width: number; label: string }> = {
  desktop: { width: 1024, label: '电脑横版' },
  tablet: { width: 800, label: '平板横版' },
  mobile: { width: 420, label: '手机竖版' },
};

/**
 * Measure the true content bounds of an element, including any
 * absolutely / stickily positioned descendants. Resolves any
 * `transform: scale()` applied by a parent (e.g. a preview wrapper)
 * so the returned width/height reflect the unscaled layout size.
 */
function measureExportBounds(element: HTMLElement): {
  width: number;
  height: number;
  previewScale: number;
} {
  const rect = element.getBoundingClientRect();
  const scrollWidth = element.scrollWidth;
  const scrollHeight = element.scrollHeight;
  const offsetWidth = element.offsetWidth;
  const offsetHeight = element.offsetHeight;

  // Detect parent transform: scale() and reverse its effect.
  let previewScale = 1;
  let parent: HTMLElement | null = element.parentElement;
  while (parent) {
    const transform = window.getComputedStyle(parent).transform;
    if (transform && transform !== 'none') {
      const match = transform.match(/^matrix\(([^)]+)\)/);
      if (match) {
        const values = match[1].split(',').map((v) => parseFloat(v.trim()));
        if (values.length >= 4 && values[0] > 0) {
          previewScale = values[0];
          break;
        }
      }
    }
    parent = parent.parentElement;
  }

  const rectW = rect.width / previewScale;
  const rectH = rect.height / previewScale;

  // Walk children to discover content that may extend beyond scrollHeight
  // (e.g. position:absolute elements that don't contribute to scroll).
  let maxRight = 0;
  let maxBottom = 0;
  const baseLeft = rect.left;
  const baseTop = rect.top;
  const all = element.querySelectorAll<HTMLElement>('*');
  for (let i = 0; i < all.length; i += 1) {
    const child = all[i];
    // Skip hidden elements (display:none or visibility:hidden)
    const cs = window.getComputedStyle(child);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const cRect = child.getBoundingClientRect();
    if (cRect.width === 0 && cRect.height === 0) continue;
    const right = (cRect.right - baseLeft) / previewScale;
    const bottom = (cRect.bottom - baseTop) / previewScale;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const width = Math.max(
    Math.ceil(scrollWidth),
    Math.ceil(offsetWidth),
    Math.ceil(rectW),
    Math.ceil(maxRight),
    // 右侧安全缓冲：防止 box-shadow / 边框 / 亚像素渲染导致的边缘裁切
  ) + 40;
  const height = Math.max(
    Math.ceil(scrollHeight),
    Math.ceil(offsetHeight),
    Math.ceil(rectH),
    Math.ceil(maxBottom),
  ) + 20;

  return { width, height, previewScale };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function useExportReport(
  options: UseExportReportOptions = {},
): UseExportReportReturn {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const pixelRatio = options.pixelRatio ?? 2;

  const exportReport = useCallback(
    async (format: ExportFormat, size: ExportSize = 'desktop') => {
      const element = ref.current;
      if (!element) {
        console.error('[export] export container not found');
        return;
      }

      setIsExporting(true);

      try {
        // 1. Freeze animations, hide chrome, force desktop layout.
        document.documentElement.classList.add('exporting');
        document.body.classList.add('exporting');
        document.documentElement.classList.add(`export-${size}`);
        document.body.classList.add(`export-${size}`);

        const sizeConfig = EXPORT_SIZE_CONFIG[size];
        const originalWidth = element.style.width;
        element.style.width = `${sizeConfig.width}px`;

        // 2. Wait for fonts + 2 RAF + a small buffer for layout/charts.
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
        await nextAnimationFrame();
        await nextAnimationFrame();
        await wait(400);

        // 3. Measure real bounds.
        const { width, height, previewScale } = measureExportBounds(element);

        const baseFilename =
          options.filename ||
          `${dashboardConfig.site.exportPrefix}_${new Date().toISOString().slice(0, 10)}`;

        // 3.5 把文档根的 CSS 变量复制到导出元素上
        // html-to-image 生成的 SVG foreignObject 是独立文档上下文，
        // 无法继承 document.documentElement 上的 :root 变量，
        // 导致浅色/深色主题变量丢失、文字颜色渲染异常（全白或全黑）。
        const rootStyles = getComputedStyle(document.documentElement);
        const cssVarText = Array.from(rootStyles)
          .filter((name) => name.startsWith('--'))
          .map((name) => `${name}: ${rootStyles.getPropertyValue(name)}`)
          .join('; ');
        const originalStyleAttr = element.getAttribute('style') || '';

        // 从 CSS 变量读取页面背景色，优先用 --background（Tailwind v4 标准变量）
        const rootStyleForBg = getComputedStyle(document.documentElement);
        const bgColor =
          rootStyleForBg.getPropertyValue('--background') ||
          rootStyleForBg.getPropertyValue('--page') ||
          rootStyleForBg.getPropertyValue('--page-bg') ||
          '#f5f5f7';
        const bg = bgColor.trim() || '#f5f5f7';

        element.setAttribute(
          'style',
          `${originalStyleAttr}; ${cssVarText}; background-color: ${bg}; overflow: visible !important;`,
        );

        // 4. Rasterize.

        // PDF 使用更高像素比以保证打印清晰度
        const effectivePixelRatio = format === 'pdf' ? Math.max(pixelRatio, 2.5) : pixelRatio;

        const commonOptions = {
          width,
          height,
          pixelRatio: effectivePixelRatio,
          cacheBust: true,
          includeQueryParams: true,
          skipFonts: true,
          backgroundColor: bg,
          style: {
            // Ensure the export node uses its un-scaled size.
            transform: 'none',
            transformOrigin: 'top left',
            // 强制给导出根元素设置背景色，避免 SVG foreignObject 中透明导致全白
            backgroundColor: bg,
          },
        };

        // PDF 始终使用 PNG 保证文字/图表清晰度，不使用 JPG 压缩
        let dataUrl: string;
        if (format === 'jpg') {
          dataUrl = await toJpeg(element, {
            ...commonOptions,
            quality: 0.92,
          });
        } else {
          dataUrl = await toPng(element, commonOptions);
        }

        // eslint-disable-next-line no-console
        console.log('[export]', {
          format,
          previewScale,
          size: `${width}x${height}`,
          finalPx: `${width * effectivePixelRatio}x${height * effectivePixelRatio}`,
        });

        if (dataUrl.length < 1000) {
          throw new Error('生成的图片数据异常（长度过小），请重试');
        }

        if (format === 'pdf') {
          // 日报为长文档，统一使用纵向 A4
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: false,
          });

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();

          // 上下左右各留 8mm 安全边距，避免内容贴边或被裁切
          const margin = 8;
          const contentWidth = pageWidth - margin * 2;
          const contentHeight = pageHeight - margin * 2;

          // 按内容宽度等比缩放图片
          const imgWidth = contentWidth;
          const imgHeight = (height * contentWidth) / width;

          if (imgHeight <= contentHeight) {
            // 单页能放下，居中放置
            const yOffset = margin + (contentHeight - imgHeight) / 2;
            pdf.addImage(
              dataUrl,
              'PNG',
              margin,
              yOffset,
              imgWidth,
              imgHeight,
              undefined,
              'FAST',
            );
          } else {
            // 多页：智能切片，尽量在模块间隙处切分，避免切断文字/图表
            // 估算每页在原图中的像素高度
            const pxPerMm = (width * effectivePixelRatio) / imgWidth;
            const pagePxHeight = contentHeight * pxPerMm;

            // 预加载图片获取原始尺寸用于 canvas 切片
            const img = new Image();
            img.src = dataUrl;
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('图片加载失败'));
            });

            const imgPxWidth = img.naturalWidth;
            const imgPxHeight = img.naturalHeight;
            const slicePxHeight = Math.floor(pagePxHeight);

            // 为每页找最佳切分位置：在切片底部 ±15% 范围内寻找空白行
            const sliceMarginRatio = 0.15;
            const searchRange = Math.floor(slicePxHeight * sliceMarginRatio);

            // 创建离屏 canvas 用于逐页切片
            const canvas = document.createElement('canvas');
            canvas.width = imgPxWidth;
            canvas.height = slicePxHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas 初始化失败');

            // 先通过采样判断行是否为空白（背景色），用于智能避障
            // 简化方案：均匀采样几列，检测连续空白行
            function findBestSplitY(startY: number, endY: number): number {
              if (endY >= imgPxHeight) return imgPxHeight;
              // 优先用 endY，向前搜索空白行
              const searchFrom = Math.min(endY + searchRange, imgPxHeight);
              const searchTo = Math.max(startY + searchRange, endY - searchRange);

              // 在 searchFrom ~ searchTo 区间从后往前找最佳切割点
              // 创建检测用的小 canvas
              const detectCanvas = document.createElement('canvas');
              detectCanvas.width = 1;
              detectCanvas.height = 1;
              const detectCtx = detectCanvas.getContext('2d');
              if (!detectCtx) return endY;

              // 采样点：左中右各取一列
              const sampleXs = [
                Math.floor(imgPxWidth * 0.1),
                Math.floor(imgPxWidth * 0.5),
                Math.floor(imgPxWidth * 0.9),
              ];

              let bestY = endY;
              let bestScore = -1;

              // 逐行扫描（步长 2px 提高性能）
              for (let y = searchFrom; y >= searchTo; y -= 2) {
                let blankCount = 0;
                for (const sx of sampleXs) {
                  detectCtx.clearRect(0, 0, 1, 1);
                  detectCtx.drawImage(img, sx, y, 1, 1, 0, 0, 1, 1);
                  const pixel = detectCtx.getImageData(0, 0, 1, 1).data;
                  // 判断是否接近背景色（浅色模式 #f5f5f7）
                  const isLight = pixel[0] > 230 && pixel[1] > 230 && pixel[2] > 230;
                  // 深色模式兼容：判断是否接近深色背景
                  const isDark = pixel[0] < 50 && pixel[1] < 50 && pixel[2] < 50;
                  if (isLight || isDark) blankCount++;
                }
                // 三列都接近背景色 → 这行是空白，适合切割
                const score = blankCount + (y - endY) / searchRange * 0.5;
                if (score > bestScore) {
                  bestScore = score;
                  bestY = y;
                }
                if (blankCount === 3) break; // 找到完美空白行，直接用
              }

              return bestY;
            }

            let currentY = 0;
            let pageIndex = 0;

            while (currentY < imgPxHeight) {
              const targetEndY = currentY + slicePxHeight;
              const actualEndY =
                targetEndY >= imgPxHeight
                  ? imgPxHeight
                  : findBestSplitY(currentY, targetEndY);

              const sliceHeight = actualEndY - currentY;

              // 绘制切片到 canvas
              canvas.height = sliceHeight;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              // 填充背景色
              ctx.fillStyle = bg;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(
                img,
                0,
                currentY,
                imgPxWidth,
                sliceHeight,
                0,
                0,
                imgPxWidth,
                sliceHeight,
              );

              const sliceDataUrl = canvas.toDataURL('image/png');
              const sliceMmHeight = (sliceHeight / imgPxWidth) * imgWidth;

              if (pageIndex > 0) {
                pdf.addPage();
              }

              pdf.addImage(
                sliceDataUrl,
                'PNG',
                margin,
                margin,
                imgWidth,
                sliceMmHeight,
                undefined,
                'FAST',
              );

              currentY = actualEndY;
              pageIndex += 1;
            }
          }

          pdf.save(`${baseFilename}.pdf`);
        } else {
          const ext = format === 'jpg' ? 'jpg' : 'png';
          downloadDataUrl(dataUrl, `${baseFilename}.${ext}`);
        }
      } catch (error) {
        console.error('[export] failed:', error);
        throw error;
      } finally {
        document.documentElement.classList.remove('exporting');
        document.body.classList.remove('exporting');
        setIsExporting(false);
      }
    },
    [options.filename, pixelRatio],
  );

  return { ref, isExporting, exportReport };
}
