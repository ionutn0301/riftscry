import type { Page } from '@playwright/test';
import type { Match, Memory, Review, Timeline } from '../../src/lib/player/contracts';

// Browser-only fixtures: not the tester's account, live responses, or a server gate bypass.
export const platform = 'eun1';
export const puuid = 'fixture-player-000000000000000000000000000000000';
export const otherPuuid = 'other-fixture-player-000000000000000000000000000';
export const player = `${platform}:${puuid}`;
export const query = `platform=${platform}&puuid=${puuid}`;
export const memoryKey = `riftscry:build-memory:v1:${player}`;
export const baseTime = 1_780_000_000_000;
export const trackingStart = baseTime + 2_000;

const participant = {
  puuid, participantId: 1, championName: 'Ahri', teamPosition: 'MIDDLE', win: true,
  kills: 3, deaths: 2, assists: 8, totalMinionsKilled: 120, neutralMinionsKilled: 3,
  goldEarned: 9_000, totalDamageDealtToChampions: 14_000, visionScore: 15,
  item0: 1001, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0,
  perks: { styles: [{ selections: [{ perk: 8112 }] }] },
};
export function makeMatch(id: string, gameCreation: number, item = 1001): Match {
  return {
    metadata: { matchId: id },
    info: {
      gameCreation, gameDuration: 1_200, gameVersion: '16.21.1', queueId: 420,
      gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', participants: [{ ...participant, item0: item }],
    },
  };
}
export const sourceMatch = makeMatch('EUN1_12345', baseTime);
export const historicalMatch = makeMatch('EUN1_12346', baseTime + 1_000);
export const alreadyStartedMatch = makeMatch('EUN1_12347', trackingStart);
export const followUpMatch = makeMatch('EUN1_12348', trackingStart + 1_000, 3047);
export const matches = [followUpMatch, historicalMatch, sourceMatch];

export const itemMetadata = {
  version: '16.21.1',
  data: {
    1001: { name: 'Boots', plaintext: 'Movement speed', image: { full: '1001.png' } },
    3006: { name: "Berserker's Greaves", plaintext: 'Attack speed', image: { full: '3006.png' } },
    3047: { name: 'Plated Steelcaps', plaintext: 'Armor', image: { full: '3047.png' } },
  },
  runes: { 8112: { name: 'Electrocute', icon: 'perk-images/Styles/Domination/Electrocute/Electrocute.png' } },
  notice: 'Isolated browser-test metadata; not a live source.',
};
export const timeline: Timeline = {
  info: { frames: [{ timestamp: 60_000, events: [
    { type: 'ITEM_PURCHASED', timestamp: 10_000, participantId: 1, itemId: 3047 },
    { type: 'ITEM_UNDO', timestamp: 11_000, participantId: 1, beforeId: 3047, afterId: 0 },
    { type: 'CHAMPION_KILL', timestamp: 50_000, victimId: 1, killerId: 6 },
  ] }] },
};
export const suggestion = {
  id: 'fixture-boots-comparison', condition: 'Same champion, role, queue and patch',
  original: 'Compare the recorded boots purchase',
  alternative: 'Compare defensive boots in the next eligible match', targetItem: 3047,
  reason: 'Inspect the item properties and recorded timing before choosing an alternative.',
  tradeoff: 'A different purchase changes the available stats and delays another option.',
  evidence: ['inventory', 'event-0'],
  source: { label: 'Fixture item reference', url: 'https://developer.riotgames.com/docs/lol#data-dragon' },
  ruleVersion: 'browser-fixture-1',
};
export const review: Review = {
  mode: 'ai', notice: 'Isolated browser-test AI response. No live generation was performed.',
  facts: [
    { id: 'result', text: 'Ahri: win; 3/2/8; 20 minutes.', kind: 'result' },
    { id: 'inventory', text: 'Recorded final item: Boots.', kind: 'inventory' },
    { id: 'event-0', text: 'Recorded purchase: Plated Steelcaps at 10 seconds.', kind: 'item', timestamp: 10_000, itemId: 3047 },
  ],
  sections: [
    { heading: 'Recorded baseline', text: 'The recorded match ended with three kills, two deaths and eight assists.', evidence: ['result'] },
    { heading: 'Worth reviewing', text: 'Inspect the recorded purchase in its replay context.', evidence: ['event-0'] },
    { heading: 'Your build', text: 'Compare the recorded purchase with the final inventory.', evidence: ['inventory', 'event-0'] },
    { heading: 'Next game', text: 'Save a conditional item comparison and revisit the next eligible match.', evidence: ['inventory'] },
  ],
  suggestions: [suggestion],
};
export const savedNote: Memory = {
  id: 'fixture-adjustment', player, champion: 'Ahri', role: 'MIDDLE', queue: 420, patch: '16.21',
  source: sourceMatch.metadata.matchId, sourceDate: sourceMatch.info.gameCreation,
  evidence: suggestion.evidence, condition: suggestion.condition, original: suggestion.original,
  alternative: suggestion.alternative, targetItem: suggestion.targetItem,
  reason: suggestion.reason, tradeoff: suggestion.tradeoff,
  check: 'Inspect recorded purchases and undo events.', reflection: '', status: 'active', favorite: false,
  createdAt: trackingStart, trackingStartedAt: trackingStart, revisedAt: null,
};

type FixtureOptions = { matches?: Match[]; reviewFailure?: boolean; timelineFailure?: boolean };
export async function installFixtures(page: Page, options: FixtureOptions = {}) {
  const records = options.matches ?? matches;
  const requests: { action: string; url: string; method: string }[] = [];
  await page.route('**/api/player/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.pathname.split('/').at(-1) ?? '';
    requests.push({ action, url: request.url(), method: request.method() });
    let status = 200;
    let payload: unknown;
    switch (action) {
      case 'lookup': payload = { puuid, gameName: 'Fixture Player', tagLine: 'TEST' }; break;
      case 'rank': payload = [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 35 }]; break;
      case 'history': payload = records.map(record => record.metadata.matchId); break;
      case 'match': {
        const record = records.find(record => record.metadata.matchId === url.searchParams.get('id'));
        status = record ? 200 : 404;
        payload = record && url.searchParams.get('puuid') === otherPuuid
          ? { ...record, info: { ...record.info, participants: record.info.participants.map(p => ({ ...p, puuid: otherPuuid })) } }
          : record ?? { error: 'Fixture match not found.' };
        break;
      }
      case 'items': payload = itemMetadata; break;
      case 'timeline':
        status = options.timelineFailure ? 503 : 200;
        payload = options.timelineFailure ? { error: 'Fixture timeline unavailable.' } : timeline;
        break;
      case 'review':
        status = options.reviewFailure ? 503 : 200;
        payload = options.reviewFailure ? { error: 'Fixture AI unavailable.' } : review;
        break;
      default: status = 501; payload = { error: `Unimplemented fixture endpoint: ${action}` };
    }
    await route.fulfill({ status, json: payload });
  });
  return requests;
}
export async function seedNotes(page: Page, notes: unknown[]) {
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }, { key: memoryKey, value: JSON.stringify(notes) });
}
export async function readNotes(page: Page): Promise<Memory[]> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]'), memoryKey);
}
