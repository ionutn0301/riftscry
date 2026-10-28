import { useState, type CSSProperties } from 'react';
import { championDisplayName, championIconSource } from './championArtwork';

/** Official square icon, with a stable initials fallback when an asset is unavailable. */
export default function ChampionPortrait({ champion, size = 48, className = '' }: {
  champion: string; size?: number; className?: string;
}) {
  const [failedSource, setFailedSource] = useState('');
  const source = championIconSource(champion);
  return <span className={`champion-portrait ${className}`} aria-hidden="true"
    data-image-missing={failedSource === source || undefined}
    style={{ '--portrait-size': `${size}px` } as CSSProperties}>
    <span className="champion-portrait-fallback">{championDisplayName(champion).slice(0, 2).toUpperCase() || '?'}</span>
    {failedSource !== source && <img src={source} width={size} height={size} alt="" loading="lazy" decoding="async" onError={() => setFailedSource(source)} />}
  </span>;
}
