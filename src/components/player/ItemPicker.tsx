import { useId, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from './client';
import type { ItemMetadata } from '../../lib/player/advice';
import { usePlayerCooldown } from './usePlayerCooldown';
import PlayerIcon from './PlayerIcon';

export type { ItemMetadata } from '../../lib/player/advice';

type ItemPickerProps = {
  platform: string;
  puuid: string;
  id: string;
  initial?: number;
  value?: number;
  onChange?: (item: number) => void;
  metadata?: ItemMetadata;
};

export default function ItemPicker({ platform, puuid, id, initial = 0, value, onChange, metadata }: ItemPickerProps) {
  const uid = useId();
  const [search, setSearch] = useState('');
  const [localSelection, setLocalSelection] = useState(initial);
  const selected = value ?? localSelection;
  const retrySeconds = usePlayerCooldown();
  const { data: fetched, error, isLoading, isValidating, mutate: retryItems } = useSWR<ItemMetadata>(
    metadata ? null : api('items', { platform, puuid, id }), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const data = metadata ?? fetched;
  const query = search.trim().toLocaleLowerCase();
  const options = Object.entries(data?.data ?? {})
    .filter(([key, item]) => key === String(selected) || item.name.toLocaleLowerCase().includes(query) || key === query)
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  function choose(item: number) {
    setLocalSelection(item);
    onChange?.(item);
  }

  return <div className="item-picker">
    <label htmlFor={`${uid}-search`}><PlayerIcon name="search" /> Search patch items</label>
    <input id={`${uid}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by item name" />
    <label htmlFor={`${uid}-item`}>Tracked item</label>
    <select id={`${uid}-item`} name="item" required value={selected || ''} onChange={event => choose(Number(event.target.value))} aria-describedby={`${uid}-help`}>
      <option value="">{isLoading ? 'Loading patch items…' : 'Choose an item'}</option>
      {selected > 0 && !data?.data[selected] && <option value={selected}>Item {selected} — metadata unavailable</option>}
      {options.map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
    </select>
    {selected > 0 && data?.data[selected] && <p className="item-picker-selection"><ItemLabel id={selected} metadata={data} /></p>}
    {error && <div><p role="status">Items unavailable. Your selection is kept.</p><button type="button" disabled={isValidating || retrySeconds > 0} onClick={() => void retryItems().catch(() => {})}><PlayerIcon name="refresh" />{retrySeconds ? `Retry in ${retrySeconds}s` : 'Retry item details'}</button></div>}
    {!isLoading && data && !Object.keys(data.data).length && <p role="status">No items available for this patch.</p>}
    {!!query && !options.length && <p role="status">No items match this search.</p>}
    <p id={`${uid}-help`} className="player-help">The item to track in later games.</p>
  </div>;
}

/** Metadata and CDN failures replace the picture, never its reserved slot. */
export function LoadoutIcon({ id, src = '', rune = false }: { id: number; src?: string; rune?: boolean }) {
  const [failedSource, setFailedSource] = useState('');
  const hasImage = !!src && failedSource !== src;
  return <span className={`loadout-icon${rune ? ' loadout-icon--rune' : ''}`} aria-hidden="true" data-image-missing={!hasImage || undefined}>
    <span className="loadout-icon-fallback">{id}</span>
    {hasImage && <img width={rune ? 24 : 32} height={rune ? 24 : 32} loading="lazy" decoding="async" alt="" src={src} onError={() => setFailedSource(src)} />}
  </span>;
}

export function RuneLabel({ id, metadata, compact = false }: { id: number; metadata?: ItemMetadata; compact?: boolean }) {
  const rune = metadata?.runes?.[id];
  const src = rune ? `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon.split('/').map(encodeURIComponent).join('/')}` : '';
  const name = rune?.name ?? `Rune ${id}`;
  return <span className={`rune-label${compact ? ' rune-label--compact' : ''}`} title={name}>
    <LoadoutIcon id={id} src={src} rune />
    <span className="loadout-label">{name}</span>
  </span>;
}

export function ItemLabel({ id, metadata, compact = false }: { id: number; metadata?: ItemMetadata; compact?: boolean }) {
  const item = metadata?.data[id];
  const src = metadata?.version && item?.image?.full ? `https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(metadata.version)}/img/item/${encodeURIComponent(item.image.full)}` : '';
  return <span className={`item-label${compact ? ' item-label--compact' : ''}`} title={item?.name ?? `Item ${id}`}>
    <LoadoutIcon id={id} src={src} />
    <span className="loadout-label">{item?.name ?? `Item ${id}`}{!compact && item?.plaintext && <small> — {item.plaintext}</small>}</span>
  </span>;
}
