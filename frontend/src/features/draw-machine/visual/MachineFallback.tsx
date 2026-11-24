export function MachineFallback() {
  return (
    <svg
      viewBox="0 0 600 540"
      role="img"
      aria-label="Static draw machine illustration"
      className="machine-fallback"
    >
      <defs>
        <linearGradient id="preview-base" x2="0" y2="1">
          <stop stopColor="#464d52" />
          <stop offset="1" stopColor="#2c3135" />
        </linearGradient>
        <linearGradient id="preview-ring" x2="1" y2="1">
          <stop stopColor="#e8edf0" />
          <stop offset="0.5" stopColor="#b5bfc6" />
          <stop offset="1" stopColor="#d8dfe4" />
        </linearGradient>
        <radialGradient id="preview-glass" cx="38%" cy="32%">
          <stop stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="0.7" stopColor="#d7ebef" stopOpacity="0.22" />
          <stop offset="1" stopColor="#b2cfd6" stopOpacity="0.45" />
        </radialGradient>
      </defs>
      <ellipse cx="300" cy="492" rx="220" ry="14" fill="#102b36" opacity="0.14" />
      <path
        d="M84 468 L250 434 L350 434 L516 468 L516 488 L84 488 Z"
        fill="url(#preview-base)"
        stroke="#2a2f33"
        strokeWidth="2"
      />
      <path
        d="M84 468 L256 424 L344 424 L516 468 L516 452 L346 410 L254 410 L84 452 Z"
        fill="#4f575d"
        opacity="0.7"
      />
      <rect x="272" y="388" width="56" height="46" rx="8" fill="#3a4045" />
      <circle
        cx="300"
        cy="225"
        r="176"
        fill="url(#preview-glass)"
        stroke="url(#preview-ring)"
        strokeWidth="12"
      />
      {/* Central Y-rotor */}
      <g stroke="#c8d1d7" strokeWidth="9" strokeLinecap="round">
        <line x1="300" y1="225" x2="300" y2="66" />
        <line x1="300" y1="225" x2="164" y2="305" />
        <line x1="300" y1="225" x2="436" y2="305" />
      </g>
      <circle cx="300" cy="225" r="14" fill="#d8e0e5" stroke="#8f9ba3" strokeWidth="3" />
      {Array.from({ length: 18 }, (_, index) => {
        const row = Math.floor(index / 6)
        const x = 198 + (index % 6) * 40 + (row % 2) * 10
        const y = 272 + row * 31
        return (
          <g key={index}>
            <circle cx={x} cy={y} r="18" fill="#22cc44" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#fff">
              {String(index + 1).padStart(2, '0')}
            </text>
          </g>
        )
      })}
      {/* Sample rolled ball on left chute */}
      <circle cx="130" cy="444" r="18" fill="#22cc44" />
      <text x="130" y="449" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#fff">
        07
      </text>
      <text x="300" y="476" textAnchor="middle" fill="#d5e5df" fontSize="16" fontWeight="bold">
        LOTTOSCOPE
      </text>
    </svg>
  )
}
