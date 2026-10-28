import { useId, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from './client';
import type { ItemMetadata } from '../../lib/player/advice';

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
  const { data: fetched, error, isLoading } = useSWR<ItemMetadata>(
    metadata ? null : api('items', { platform, puuid, id }), fetcher, { shouldRetryOnError: false },
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
    <label htmlFor={`${uid}-search`}>Search patch items</label>
    <input id={`${uid}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by item name" />
    <label htmlFor={`${uid}-item`}>Tracked item</label>
    <select id={`${uid}-item`} name="item" required value={selected || ''} onChange={event => choose(Number(event.target.value))} aria-describedby={`${uid}-help`}>
      <option value="">{isLoading ? 'Loading patch items…' : 'Choose an item'}</option>
      {selected > 0 && !data?.data[selected] && <option value={selected}>Item {selected} — metadata unavailable</option>}
      {options.map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
    </select>
    {selected > 0 && data?.data[selected] && <p className="item-picker-selection"><ItemLabel id={selected} metadata={data} /></p>}
    {error && <p role="status">Item details are unavailable. Your existing target is preserved.</p>}
    {!isLoading && data && !Object.keys(data.data).length && <p role="status">No compatible item catalogue is available for this match.</p>}
    {!!query && !options.length && <p role="status">No items match this search.</p>}
    <p id={`${uid}-help`} className="player-help">Choose the item you want to observe in future games. Eligibility and purchase budget depend on the game.</p>
  </div>;
}

export function RuneLabel({ id, metadata }: { id: number; metadata?: ItemMetadata }) {
  const rune = metadata?.runes?.[id];
  return <span className="rune-label">
    {rune && <img loading="lazy" width="24" height="24" alt="" src={`https://ddragon.leagueoflegends.com/cdn/img/${rune.icon.split('/').map(encodeURIComponent).join('/')}`} />}
    <span>{rune?.name ?? `Rune ${id}`}</span>
  </span>;
}

export function ItemLabel({ id, metadata, compact = false }: { id: number; metadata?: ItemMetadata; compact?: boolean }) {
  const item = metadata?.data[id];
  return <span className="item-label">
    {metadata?.version && item?.image?.full && <img width="32" height="32" loading="lazy" src={`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(metadata.version)}/img/item/${encodeURIComponent(item.image.full)}`} alt="" />}
    <span>{item?.name ?? `Item ${id}`}{!compact && item?.plaintext && <small> — {item.plaintext}</small>}</span>
  </span>;
}
