import type { CSSProperties } from 'react';

export interface AiRobotIconProps {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
  alt?: string;
}

/** A friendly, crisp vector AI robot icon that scales cleanly from 14px to 64px. */
export function AiRobotIcon({
  size,
  className = '',
  style,
  'aria-hidden': ariaHidden = true,
  alt = 'AI Health Assistant Robot',
}: AiRobotIconProps) {
  const dimension = size ? (typeof size === 'number' ? `${size}px` : size) : undefined;

  return (
    <span
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : alt}
      aria-hidden={ariaHidden ? 'true' : undefined}
      className={`ai-robot-icon inline-flex shrink-0 items-center justify-center select-none ${className}`}
      style={{
        width: dimension,
        height: dimension,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden="true"
        focusable="false"
      >
        {/* Antenna */}
        <path d="M12 2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="2" r="1.5" fill="currentColor" />

        {/* Head chassis */}
        <rect
          x="3.5"
          y="5"
          width="17"
          height="14"
          rx="4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="currentColor"
          fillOpacity="0.08"
        />

        {/* Side ears / audio transceivers */}
        <rect x="1.5" y="9" width="2" height="6" rx="1" fill="currentColor" opacity="0.85" />
        <rect x="20.5" y="9" width="2" height="6" rx="1" fill="currentColor" opacity="0.85" />

        {/* Visor display panel */}
        <rect
          x="6.5"
          y="8"
          width="11"
          height="5.5"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="currentColor"
          fillOpacity="0.18"
        />

        {/* Expressive glowing eyes */}
        <circle cx="9.25" cy="10.75" r="1.25" fill="currentColor" />
        <circle cx="14.75" cy="10.75" r="1.25" fill="currentColor" />

        {/* Friendly speech grill / smile */}
        <path d="M9.5 15.75h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}
