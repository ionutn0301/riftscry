import { ASSOCIATED_PLAYER_KEY as RIOT_ACCOUNT_KEY, parseRecentPlayer, RECENT_PLAYER_EVENT, type RecentPlayer } from '../player/identity';
import { getAccountScope, notifyPersonalChange, personalStorage } from './storage';

export { RIOT_ACCOUNT_KEY };
export type RiotAssociation = { version: 1; player: RecentPlayer | null };
export function parseRiotAssociation(raw: string): RiotAssociation {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('player' in value)) throw new Error('Your saved Riot ID could not be read. Export your workspace before replacing it.');
  const player = value.player === null ? null : parseRecentPlayer(value.player);
  if (value.player !== null && (!player || !player.name.includes('#'))) throw new Error('Your saved Riot ID could not be read. Export your workspace before replacing it.');
  return { version: 1, player };
}
export function readRiotAssociation(): RecentPlayer | null {
  const value = personalStorage.getItem(RIOT_ACCOUNT_KEY);
  return value === null ? null : parseRiotAssociation(value).player;
}
export function saveRiotAssociation(owner: string, player: RecentPlayer | null, expected: RecentPlayer | null) {
  if (getAccountScope() !== owner) throw new Error('Your account changed. Reopen your profile before continuing.');
  if (JSON.stringify(readRiotAssociation()) !== JSON.stringify(expected)) throw new Error('Your Riot ID changed on another device. Review the saved ID before trying again.');
  const record = parseRiotAssociation(JSON.stringify({ version: 1, player }));
  personalStorage.setItem(RIOT_ACCOUNT_KEY, JSON.stringify(record));
  notifyPersonalChange(RIOT_ACCOUNT_KEY);
  window.dispatchEvent(new Event(RECENT_PLAYER_EVENT));
}
