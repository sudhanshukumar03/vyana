interface BrandLogoProps {
  variant?: 'compact' | 'small' | 'auth';
  inverse?: boolean;
  className?: string;
}

/** A crisp vector mark with readable type at every supported size matching official theme. */
export function BrandLogo({ variant = 'compact', inverse = false, className = '' }: BrandLogoProps) {
  const small = variant === 'small';
  const auth = variant === 'auth';
  const markSize = auth ? 48 : small ? 38 : 42;

  return (
    <span
      role="img"
      aria-label="Vyana — SMART IOT TRIAGE"
      className={`inline-flex shrink-0 items-center ${auth ? 'gap-3' : 'gap-2.5'} ${className}`}
    >
      <img
        src="/brand/vyana-mark.svg"
        alt="Vyana Logo"
        width={markSize}
        height={markSize}
        className="shrink-0 object-contain rounded-xl"
      />
      <span aria-hidden="true" className="flex flex-col items-start whitespace-nowrap text-left justify-center">
        <span
          className={`font-display font-bold leading-none tracking-tight ${
            inverse ? 'text-white' : 'text-[#0F172B]'
          } ${auth ? 'text-[28px]' : small ? 'text-[22px]' : 'text-[24px]'}`}
        >
          Vyana
        </span>
        <span
          className={`font-mono font-medium uppercase tracking-[0.14em] leading-none ${
            inverse ? 'text-blue-200/90' : 'text-[#4A5D6E]'
          } mt-1.5 ${auth ? 'text-[11px]' : small ? 'text-[9.5px]' : 'text-[10px]'}`}
        >
          SMART IOT TRIAGE
        </span>
      </span>
    </span>
  );
}
