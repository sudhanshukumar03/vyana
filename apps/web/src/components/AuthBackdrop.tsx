/** Static brand illustration, not a recording or representation of patient data. */
export function AuthBackdrop() {
  const pulse = 'M-20 625H272C287 625 290 607 300 607C314 607 316 645 327 645C339 645 341 625 352 625H379C392 625 398 592 410 592C427 592 427 646 443 646C454 646 455 636 461 636C469 636 474 684 482 684C492 684 510 562 523 538C534 517 548 621 560 629C571 637 580 613 591 613C601 613 607 625 618 625H745';
  return (
    <svg className="auth-art" viewBox="0 0 725 941" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="auth-forest" x1="60" y1="0" x2="700" y2="941" gradientUnits="userSpaceOnUse">
          <stop stopColor="#084c40" /><stop offset=".55" stopColor="#033b32" /><stop offset="1" stopColor="#032d27" />
        </linearGradient>
        <radialGradient id="auth-light" cx="0" cy="0" r="1" gradientTransform="translate(375 680) rotate(90) scale(300 540)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4a9e78" stopOpacity=".4" /><stop offset="1" stopColor="#125d48" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="auth-ribbon" x1="180" y1="570" x2="320" y2="930" gradientUnits="userSpaceOnUse">
          <stop stopColor="#73c49b" stopOpacity=".26" /><stop offset="1" stopColor="#0b4a39" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="auth-ribbon-edge" x1="0" y1="650" x2="725" y2="850" gradientUnits="userSpaceOnUse">
          <stop stopColor="#98d7af" stopOpacity=".05" /><stop offset=".48" stopColor="#a8e4c1" stopOpacity=".65" /><stop offset="1" stopColor="#82b99c" stopOpacity=".05" />
        </linearGradient>
        <linearGradient id="auth-pulse" x1="0" y1="625" x2="725" y2="625" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bdeedb" stopOpacity="0" /><stop offset=".45" stopColor="#a6ddc2" stopOpacity=".45" /><stop offset=".72" stopColor="#d4ffe5" /><stop offset="1" stopColor="#bdeedb" stopOpacity="0" />
        </linearGradient>
        <pattern id="auth-grain" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".55" fill="#d8f5dd" fillOpacity=".1" />
        </pattern>
        <filter id="auth-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <path fill="url(#auth-forest)" d="M0 0h725v941H0z" />
      <path fill="url(#auth-light)" d="M0 0h725v941H0z" />
      <path fill="url(#auth-grain)" opacity=".35" d="M0 0h725v941H0z" />
      <path d="M465-100C768 119 732 377 517 552" stroke="#d3ebc3" strokeOpacity=".1" />
      <path d="M528-100C831 119 795 377 580 552" stroke="#d3ebc3" strokeOpacity=".06" />
      <path d="M-110 718C77 505 264 564 434 691C576 797 669 828 820 714V1050H-110Z" fill="url(#auth-ribbon)" />
      <path d="M-110 718C77 505 264 564 434 691C576 797 669 828 820 714" stroke="url(#auth-ribbon-edge)" />
      <path d="M-132 761C55 548 242 607 412 734C554 840 647 871 798 757" stroke="url(#auth-ribbon-edge)" strokeOpacity=".35" />
      <path d="M-154 804C33 591 220 650 390 777C532 883 625 914 776 800" stroke="url(#auth-ribbon-edge)" strokeOpacity=".18" />
      <path d="M-60 588C114 557 185 712 380 784C531 840 650 770 790 783" stroke="#b4d4a7" strokeOpacity=".13" />
      <path d={pulse} stroke="#a5edc2" strokeWidth="7" opacity=".2" filter="url(#auth-glow)" />
      <path d={pulse} stroke="url(#auth-pulse)" strokeWidth="1.25" />
      <circle cx="523" cy="538" r="10" fill="#b6ffce" opacity=".5" filter="url(#auth-glow)" />
      <circle cx="523" cy="538" r="3" fill="#e8ffec" />
    </svg>
  );
}
