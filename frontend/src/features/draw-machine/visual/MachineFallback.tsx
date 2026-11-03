export function MachineFallback() {
  return (
    <svg
      viewBox="0 0 600 540"
      role="img"
      aria-label="Minh họa lồng cầu tĩnh"
      className="machine-fallback"
    >
      <defs>
        <linearGradient id="preview-metal" x2="0" y2="1">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#c5d0d6" />
        </linearGradient>
        <radialGradient id="preview-glass">
          <stop stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#b7d6df" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <ellipse cx="300" cy="497" rx="213" ry="15" fill="#a5b2bb" opacity="0.2" />
      <path
        d="M120 427L97 481Q300 505 503 481L480 427Z"
        fill="url(#preview-metal)"
        stroke="#9cabb4"
      />
      <path
        d="M115 229Q76 347 165 431M485 229Q524 347 435 431"
        fill="none"
        stroke="#c2ced4"
        strokeWidth="16"
      />
      <circle
        cx="300"
        cy="225"
        r="179"
        fill="url(#preview-glass)"
        stroke="#e5edef"
        strokeWidth="9"
      />
      {Array.from({ length: 22 }, (_, index) => {
        const row = Math.floor(index / 6)
        const x = 198 + (index % 6) * 38 + (row % 2) * 12
        const y = 273 + row * 31
        return (
          <g key={index}>
            <circle cx={x} cy={y} r="19" fill="#008c82" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">
              {String(index + 1).padStart(2, '0')}
            </text>
          </g>
        )
      })}
      <ellipse cx="300" cy="225" rx="179" ry="42" fill="none" stroke="#f7fafb" strokeWidth="7" />
      <ellipse cx="300" cy="225" rx="70" ry="179" fill="none" stroke="#f7fafb" strokeWidth="7" />
      <path d="M300 46V391M112 225H488" stroke="#eef3f5" strokeWidth="8" />
      <rect
        x="260"
        y="346"
        width="80"
        height="72"
        rx="17"
        fill="#d2dde2"
        stroke="#fff"
        strokeWidth="6"
      />
      <path d="M268 408L335 446L414 446L333 408Z" fill="#dceef3" stroke="#f7fafb" strokeWidth="5" />
      <text
        x="300"
        y="471"
        textAnchor="middle"
        fill="#007c75"
        fontSize="29"
        fontWeight="bold"
        fontStyle="italic"
      >
        LottoScope
      </text>
    </svg>
  )
}
