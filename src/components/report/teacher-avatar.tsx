import { cn } from "@/lib/utils";

/**
 * 老师头像：透明背景的扁平轻插画人物（head & shoulders），
 * 圆形裁切 + 细白边（深色模式半透明白）+ 极轻阴影，人物自然铺满圆形容器，
 * 便于在主题色卡片底色上形成清晰质感与层次。
 */
export function TeacherAvatar({
  src,
  alt,
  size = 92,
  className,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full ring-2 ring-white/90 shadow-[0_2px_10px_rgba(15,23,42,0.12)] dark:ring-white/20",
        className,
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </span>
  );
}
