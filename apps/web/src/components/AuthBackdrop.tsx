/** Static decorative artwork; it does not display or represent a patient's ECG. */
export function AuthBackdrop() {
  const wave = 'M-10 615H338C352 615 352 594 365 592C380 589 379 639 392 639C405 639 401 622 417 622H438C454 622 455 583 474 577C492 570 491 635 508 638C520 640 522 627 528 635C537 646 536 681 542 681C550 681 567 567 585 512C591 493 599 580 613 611C618 623 622 627 630 624C642 619 644 601 657 605C670 610 670 622 685 622H735';
  return (
    <svg className="auth-art" viewBox="0 0 725 941" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="auth-wave-fill" x1="313" y1="600" x2="355" y2="941" gradientUnits="userSpaceOnUse">
          <stop stopColor="#27c8b6" stopOpacity=".18" />
          <stop offset="1" stopColor="#0b5d53" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="auth-wave-stroke" x1="0" y1="614" x2="725" y2="614" gradientUnits="userSpaceOnUse">
          <stop stopColor="#59c6b7" stopOpacity=".05" />
          <stop offset=".65" stopColor="#83e0d1" stopOpacity=".7" />
          <stop offset="1" stopColor="#acffeb" stopOpacity=".8" />
        </linearGradient>
        <radialGradient id="auth-orb">
          <stop stopColor="#a9ffdf" stopOpacity=".4" />
          <stop offset="1" stopColor="#75e9cc" stopOpacity="0" />
        </radialGradient>
        <filter id="auth-soft-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <path d="M527-2C685 110 724 289 627 482C570 597 481 709 418 754" stroke="#6ed3c0" strokeOpacity=".22" />
      <path d="M-64 661C155 563 265 644 421 733C552 808 641 829 767 809V941H-64Z" fill="url(#auth-wave-fill)" />
      <path d="M-64 661C155 563 265 644 421 733C552 808 641 829 767 809" stroke="#64e6d1" strokeOpacity=".55" />
      <path d="M-75 571C129 524 212 708 394 761C547 805 620 734 755 711" stroke="#63c9b9" strokeOpacity=".35" />
      <path d="M726 370C529 447 478 672 290 783" stroke="#53bfae" strokeOpacity=".2" />
      <path d={wave} stroke="#68e2c7" strokeWidth="10" opacity=".12" filter="url(#auth-soft-glow)" />
      <path d={wave} stroke="url(#auth-wave-stroke)" strokeWidth="1.2" />
      <circle cx="585" cy="512" r="50" fill="url(#auth-orb)" />
      <circle cx="585" cy="512" r="8" fill="#b5ffe6" filter="url(#auth-soft-glow)" />
      <circle cx="585" cy="512" r="4" fill="#edfff6" />
      <circle cx="630" cy="624" r="6" fill="#b5ffe6" filter="url(#auth-soft-glow)" />
      <circle cx="630" cy="624" r="3.5" fill="#edfff6" />
    </svg>
  );
}
