import {cn} from '@/lib/utils';

/**
 * The Fluely mark: a cobalt tile with a geometric "F". Drawn inline so it
 * follows the theme's accent and stays crisp at any size. The same artwork is
 * the favicon (public/assets/fluely_mark.svg).
 */
export function FluelyMark({size = 28, className}: {size?: number; className?: string}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="8" fill="var(--color-brand-blue, #2554c7)" />
      <path d="M11 8.5h11.5v3.6H15v3.4h6.5v3.6H15v5.4h-4z" fill="#ffffff" />
    </svg>
  );
}

/** Mark plus wordmark. The text inherits color, so it works on any surface. */
export function FluelyLogo({
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
      <FluelyMark size={size} />
      <span className={cn('text-[17px] font-semibold tracking-tight', textClassName)}>Fluely</span>
    </span>
  );
}
