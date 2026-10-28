import type { ReactNode } from 'react';

export type PlayerIconName = 'search' | 'history' | 'build' | 'layers' | 'bookmark' | 'refresh' |
  'arrow-right' | 'arrow-left' | 'arrow-down' | 'chevron-right' | 'info' | 'trophy' | 'clock' |
  'check' | 'close' | 'x' | 'swords' | 'snowflake' | 'sparkles' | 'coins' | 'eye' | 'target' |
  'star' | 'trash' | 'plus';

const check = <path d="m5 12 4 4L19 6" />;
const close = <path d="m6 6 12 12M18 6 6 18" />;
const layers = <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>;
const glyphs: Record<PlayerIconName, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  history: <><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7" /><path d="M12 7v5l3 2" /></>,
  build: layers, layers,
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
  refresh: <><path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" /></>,
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  'arrow-left': <path d="M20 12H4m6-6-6 6 6 6" />,
  'arrow-down': <path d="M12 4v16m-6-6 6 6 6-6" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.5" /></>,
  trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM12 13v6m-4 2h8M7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  check, close, x: close,
  swords: <><path d="m14 4 6-1-1 6L6 22M10 4 4 3l1 6 13 13M3 16l5 5m8-5 5 5" /></>,
  snowflake: <><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7m-12-3 3.3 3 3.3-3m-6.6 16 3.3-3 3.3 3M4 10l4-1-1-4m10 14-1-4 4-1M4 14l4 1-1 4m10-14-1 4 4 1" /></>,
  sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4" /></>,
  coins: <><ellipse cx="9" cy="6" rx="6" ry="3" /><path d="M3 6v5c0 1.7 2.7 3 6 3m6-8v5M3 11v5c0 1.7 2.7 3 6 3" /><ellipse cx="16" cy="14" rx="5" ry="3" /><path d="M11 14v5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" />,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
};

/** Decorative glyph: its adjacent label or control supplies the accessible name. */
export default function PlayerIcon({ name, size = 20, className = '' }: {
  name: PlayerIconName; size?: number; className?: string;
}) {
  return <svg className={`player-icon ${className}`} width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">{glyphs[name]}</svg>;
}
