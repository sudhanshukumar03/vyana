interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'small' | 'auth';
  inverse?: boolean;
  className?: string;
}

/** A crisp vector mark with readable type at every supported size. */
export function BrandLogo({ variant = 'compact', inverse = false, className = '' }: BrandLogoProps) {
  const small = variant === 'small';
  const full = variant === 'full';
  const auth = variant === 'auth';
  const markSize = auth ? 80 : full ? 64 : small ? 32 : 40;

  return (
    <span
      role="img"
      aria-label="Vyana — Your vitals. In sync."
      className={`inline-flex shrink-0 items-center ${auth ? 'gap-4 sm:gap-5' : full ? 'gap-4' : 'gap-2.5'} ${className}`}
    >
      <img
        src="/brand/vyana-mark.svg"
        alt=""
        width={markSize}
        height={markSize}
        className={`shrink-0 object-contain ${auth ? 'w-16 h-16 sm:w-20 sm:h-20' : ''}`}
      />
      <span aria-hidden="true" className="flex flex-col items-start whitespace-nowrap text-left">
        <span className={`font-display font-bold leading-none tracking-[-0.04em] ${inverse ? 'text-white' : 'text-ink'} ${auth ? 'text-[44px] sm:text-[56px]' : full ? 'text-[44px]' : small ? 'text-[23px]' : 'text-[30px]'}`}>
          Vyana
        </span>
        <span className={`font-medium leading-normal ${inverse ? 'text-white/70' : 'text-muted'} ${auth ? 'mt-2 text-[14px] sm:text-[18px]' : full ? 'mt-2 text-[16px]' : 'mt-1 text-[12px]'}`}>
          Your vitals. In sync.
        </span>
      </span>
    </span>
  );
}
