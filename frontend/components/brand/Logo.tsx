import {cn} from '@/lib/utils';
import {BRAND} from '@/lib/brand';

/**
 * The product mark: a cobalt tile with three rising bars — a steady rhythm,
 * which is what "cadence" means. Drawn inline so it follows the theme's accent
 * and stays crisp at any size. The favicon (public/assets/brand_mark.svg) is
 * the same artwork.
 *
 * `animated` draws the bars in one after another (used by the loading curtain).
 */
export function BrandMark({
  size = 28,
  className,
  animated = false
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  const bars = [
    {x: 8.5, y: 17, h: 7},
    {x: 14.25, y: 12, h: 12},
    {x: 20, y: 7.5, h: 16.5}
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="8" fill="var(--color-brand-blue, #2554c7)" />
      {bars.map((bar, i) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width="3.5"
          height={bar.h}
          rx="1.75"
          fill="#ffffff"
          style={
            animated
              ? {
                  transformBox: 'fill-box',
                  transformOrigin: 'bottom',
                  animation: `bar-rise 520ms var(--ease-out) ${120 + i * 90}ms both`
                }
              : undefined
          }
        />
      ))}
    </svg>
  );
}

/** Mark plus wordmark. The text inherits color, so it works on any surface. */
export function BrandLogo({
  size = 28,
  className,
  textClassName
}: {
  size?: number;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={size} />
      <span className={cn('text-[17px] font-semibold tracking-tight', textClassName)}>
        {BRAND.name}
      </span>
    </span>
  );
}
