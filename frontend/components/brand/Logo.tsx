import {cn} from '@/lib/utils';
import {BRAND} from '@/lib/brand';

/**
 * The product mark: a rounded line calendar with its two rings and a slanted
 * cobalt F inside -- Fluely plans and schedules. The outline uses
 * `currentColor`, so it is dark on light surfaces and white on dark ones (set
 * the text color on the mark or its parent). The favicon
 * (public/assets/brand_mark.svg) is the same artwork.
 *
 * `animated` draws the calendar in and then slides the F into place (used by
 * the loading curtain).
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
  const draw = (delay: number) =>
    animated
      ? {
          strokeDasharray: 100,
          animation: `mark-draw 640ms var(--ease-out) ${delay}ms both`
        }
      : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <rect x="4.5" y="7" width="23" height="21.5" rx="6.5" pathLength={100} style={draw(80)} />
        <path d="M11 3.5V9M21 3.5V9" pathLength={100} style={draw(260)} />
      </g>
      <g
        fill="#2563eb"
        style={animated ? {animation: 'mark-f-in 520ms var(--ease-out) 420ms both'} : undefined}
      >
        <path d="M9 24.5 13.6 15.2C14.6 13.2 16.2 12 18.6 12H25L23.4 14.8H18.8C17.6 14.8 16.8 15.4 16.2 16.6L12.3 24.5Z" />
        <path d="M15.2 17.6H22.4L21 20.3H13.9Z" />
      </g>
    </svg>
  );
}

/**
 * Mark plus wordmark. The wordmark is set in lowercase, as in the logo. Mark
 * outline and text inherit color, so it works on any surface.
 */
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
      <BrandMark size={size} className={textClassName} />
      <span className={cn('text-[17px] font-semibold lowercase tracking-tight', textClassName)}>
        {BRAND.name}
      </span>
    </span>
  );
}
