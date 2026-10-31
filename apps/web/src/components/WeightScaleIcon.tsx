import type { SVGProps } from 'react';

/**
 * High-fidelity vector bathroom / clinical weight scale icon.
 * Replaces legal balance scales with a dedicated body mass scale.
 */
export function WeightScaleIcon({
  className = 'w-6 h-6',
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Outer scale body platform */}
      <rect x="3" y="3" width="18" height="18" rx="4.5" />
      {/* Top dial / measurement window */}
      <path d="M8.5 7.5a3.5 3.5 0 0 1 7 0Z" />
      {/* Dial calibration pointer */}
      <path d="M12 5v2.5" />
      {/* Foot standing platform dividers */}
      <path d="M7 14.5h10" />
      <path d="M12 14.5v3" />
    </svg>
  );
}

