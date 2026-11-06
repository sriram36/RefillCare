import React from 'react';

/** The mark: a capsule resting on a green tile. */
export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#2D6A4F" />
      <g transform="rotate(-38 20 20)">
        <rect x="7" y="14.5" width="26" height="11" rx="5.5" fill="#FFFDF8" />
        <path d="M20 14.5h7.5a5.5 5.5 0 0 1 0 11H20z" fill="#C6DDC9" />
      </g>
    </svg>
  );
}

/**
 * A blister strip: the thing a patient actually holds. Used on the sign-in page as the one picture.
 * Some wells are still full, some are already empty.
 */
export function StripArt({ className = '' }: { className?: string }) {
  const full = new Set([0, 1, 2, 3, 5, 6, 7]); // which of the 10 wells still hold a capsule
  const tone = ['#2D6A4F', '#78AB86', '#2D6A4F', '#E3A12F', '#2D6A4F', '#78AB86', '#2D6A4F'];
  return (
    <svg viewBox="0 0 360 230" className={className} role="img" aria-label="">
      {/* a leaf behind the strip */}
      <g transform="translate(250 6) rotate(18)">
        <path d="M0 70C0 28 30 2 76 0c0 44-30 76-76 70Z" fill="#C6DDC9" />
        <path d="M4 66C24 44 44 26 70 8" stroke="#78AB86" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      <rect x="18" y="52" width="300" height="150" rx="30" fill="#FFFDF8" stroke="#E2DCC8" strokeWidth="2" />
      <rect x="30" y="64" width="276" height="126" rx="22" fill="#F5F1E6" />
      {Array.from({ length: 10 }).map((_, i) => {
        const cx = 66 + (i % 5) * 58;
        const cy = 106 + Math.floor(i / 5) * 62;
        const has = full.has(i);
        const colour = tone[i % tone.length];
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="21" fill="#E7E1CE" />
            <circle cx={cx} cy={cy + 1.5} r="17" fill="#DCD5BF" />
            {has && (
              <g transform={`rotate(-35 ${cx} ${cy})`}>
                <rect x={cx - 15} y={cy - 7} width="30" height="14" rx="7" fill={colour} />
                <path d={`M${cx} ${cy - 7}h8a7 7 0 0 1 0 14h-8z`} fill="#FFFDF8" opacity="0.85" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
