interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'small';
  className?: string;
}

/** A crisp vector mark with readable type at every supported size. */
export function BrandLogo({ variant = 'compact', className = '' }: BrandLogoProps) {
  const small = variant === 'small';
  const full = variant === 'full';
  const markSize = full ? 64 : small ? 32 : 40;

  return (
    <span
      role="img"
      aria-label="Vyana — Your vitals. In sync."
      className={`inline-flex shrink-0 items-center ${full ? 'gap-4' : 'gap-2.5'} ${className}`}
    >
      <img
        src="/brand/vyana-mark.svg"
        alt=""
        width={markSize}
        height={markSize}
        className="shrink-0 object-contain"
      />
      <span aria-hidden="true" className="flex flex-col items-start whitespace-nowrap text-left">
        <span className={`font-display font-bold leading-none tracking-[-0.04em] text-ink ${full ? 'text-[44px]' : small ? 'text-[23px]' : 'text-[30px]'}`}>
          Vyana
        </span>
        <span className={`font-medium leading-normal text-muted ${full ? 'mt-2 text-[14px]' : 'mt-1 text-[12px]'}`}>
          Your vitals. In sync.
        </span>
      </span>
    </span>
  );
}
