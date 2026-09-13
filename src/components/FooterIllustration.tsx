// A flat-illustration hero for the footer, in the same spirit as the reference design (a
// big centered scene on a light background, before a wave divider into a colour block) —
// but food/ratings-themed rather than shipping-themed: a plate of food with a floating
// star-rating badge, tying the illustration directly to what this site actually does.
// Hand-drawn with basic shapes (no external illustration library/asset) so it exactly
// matches the site's own brand colours (the indigo/blue gradient, the amber rating star).
export function FooterIllustration() {
  return (
    <svg viewBox="0 0 400 220" className="mx-auto h-40 w-auto sm:h-48" aria-hidden>
      {/* soft ground shadow */}
      <ellipse cx="200" cy="192" rx="120" ry="12" fill="#e0e7ff" />

      {/* steam wisps */}
      <path
        d="M162 70c-6-10 6-14 0-24M182 62c-6-10 6-14 0-24M202 70c-6-10 6-14 0-24"
        stroke="#c7d2fe"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {/* plate */}
      <ellipse cx="182" cy="150" rx="95" ry="34" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="3" />
      <ellipse cx="182" cy="146" rx="70" ry="23" fill="#ffffff" stroke="#e0e7ff" strokeWidth="2" />

      {/* food on the plate */}
      <circle cx="155" cy="142" r="14" fill="#fbbf24" />
      <circle cx="188" cy="138" r="11" fill="#f87171" />
      <circle cx="205" cy="150" r="9" fill="#4ade80" />
      <circle cx="168" cy="155" r="7" fill="#4ade80" />

      {/* fork */}
      <g stroke="#6366f1" strokeWidth="4" strokeLinecap="round">
        <line x1="72" y1="110" x2="80" y2="160" />
        <line x1="64" y1="108" x2="68" y2="128" />
        <line x1="72" y1="106" x2="72" y2="128" />
        <line x1="80" y1="108" x2="76" y2="128" />
      </g>

      {/* knife */}
      <g stroke="#6366f1" strokeWidth="4" strokeLinecap="round">
        <line x1="296" y1="112" x2="288" y2="160" />
        <path d="M292 106c8 2 10 10 4 16l-4 2" fill="none" />
      </g>

      {/* floating star-rating badge */}
      <g transform="translate(262 60)">
        <circle r="26" fill="#22c55e" />
        <path
          d="M0 -12l3.5 7.2 8 1.1-5.8 5.6 1.4 8-7.1-3.7-7.1 3.7 1.4-8-5.8-5.6 8-1.1z"
          fill="#ffffff"
        />
      </g>

      {/* small decorative dots, echoing the scattered shapes around the reference ship */}
      <circle cx="60" cy="60" r="5" fill="#c7d2fe" />
      <circle cx="330" cy="140" r="6" fill="#fde68a" />
      <circle cx="100" cy="190" r="4" fill="#bbf7d0" />
    </svg>
  );
}
