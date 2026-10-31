import type { ReactNode } from 'react';

/* Original inline-SVG artwork for the app chrome. All decorative: callers always show a text label. */

const svgProps = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;

/** The app logo: a gold five-point star on a red badge with a gold rim. Original design. */
export function StarBadge({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M24 2 29 7l7-1 2 7 6 4-3 6 3 6-6 4-2 7-7-1-5 5-5-5-7 1-2-7-6-4 3-6-3-6 6-4 2-7 7 1Z" fill="#ffcc33" />
      <circle cx="24" cy="24" r="15.5" fill="#b3122a" stroke="#5c0712" strokeWidth="1.5" />
      <path
        d="M24 12.5l3.4 7 7.6 1-5.5 5.3 1.3 7.6L24 29.8l-6.8 3.6 1.3-7.6-5.5-5.3 7.6-1Z"
        fill="#ffe27a"
        stroke="#7a4b00"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SmallStar({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9Z" fill="currentColor" />
    </svg>
  );
}

const icon = (body: ReactNode) =>
  function Icon() {
    return (
      <svg className="tab-icon" {...svgProps}>
        {body}
      </svg>
    );
  };

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const TAB_ICONS = {
  /** A lightning bolt in a circle: battle now. */
  play: icon(
    <>
      <circle cx="12" cy="12" r="9.5" {...stroke} />
      <path d="M13 5.5 8 13h3.5l-1 5.5L16 11h-3.5l.5-5.5Z" fill="currentColor" />
    </>,
  ),
  /** A flag on a path: plan ahead. */
  plan: icon(
    <>
      <path d="M6 21V4" {...stroke} />
      <path d="M6 4h11l-2.5 4L17 12H6" fill="currentColor" />
    </>,
  ),
  /** A grid of four cards. */
  collection: icon(
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="2" {...stroke} />
      <rect x="3" y="13" width="8" height="8" rx="2" {...stroke} />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" />
    </>,
  ),
  /** An open book. */
  guide: icon(
    <>
      <path d="M12 6c-2-1.5-5-2-9-1.5v14c4-.5 7 0 9 1.5c2-1.5 5-2 9-1.5v-14C17 4 14 4.5 12 6Z" {...stroke} />
      <path d="M12 6v14" {...stroke} />
    </>,
  ),
  /** Three rising bars. */
  stats: icon(
    <>
      <rect x="3.5" y="13" width="4" height="8" rx="1" fill="currentColor" />
      <rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor" />
      <rect x="16.5" y="3" width="4" height="18" rx="1" fill="currentColor" />
    </>,
  ),
};
