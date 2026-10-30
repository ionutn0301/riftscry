import type { Page } from '@playwright/test';
import type { Match, Memory, Review, Timeline } from '../../src/lib/player/contracts';

// Browser-only fixtures: not the tester's account, live responses, or a server gate bypass.
export const platform = 'eun1';
export const puuid = 'fixture-player-000000000000000000000000000000000';
export const otherPuuid = 'other-fixture-player-000000000000000000000000000';
export const player = `${platform}:${puuid}`;
export const query = `platform=${platform}&puuid=${puuid}`;
export const profilePath = `/players/${platform}/${puuid}`;
export const otherProfilePath = `/players/${platform}/${otherPuuid}`;
export const memoryKey = `riftscry:build-memory:v1:${player}`;
export const baseTime = 1_780_000_000_000;
export const trackingStart = baseTime + 2_000;
export const summoner = { puuid, profileIconId: 29, summonerLevel: 438 };

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

// Deliberately distinguish date, queue, outcome and score: a 2025 ranked game
// must not displace 2026 ARAM games or contaminate their descriptive averages.
function modeMatch(id: string, date: string, queueId: number, gameMode: string, mapId: number, score: {
  win: boolean; kills: number; deaths: number; assists: number; damage: number;
}): Match {
  const match = makeMatch(id, Date.parse(date));
  return { ...match, info: {
    ...match.info, queueId, gameMode, mapId,
    participants: [{ ...match.info.participants[0]!,
      teamPosition: gameMode === 'ARAM' ? '' : 'MIDDLE',
      win: score.win, kills: score.kills, deaths: score.deaths, assists: score.assists,
      totalDamageDealtToChampions: score.damage,
      // Nonzero ARAM values catch accidental Summoner's Rift macro assessments.
      totalMinionsKilled: gameMode === 'ARAM' ? 66 : 180,
      neutralMinionsKilled: gameMode === 'ARAM' ? 0 : 12,
      visionScore: gameMode === 'ARAM' ? 3 : 40,
    }],
  } };
}
export const oldRankedMatch = modeMatch('EUN1_22001', '2025-08-17T18:00:00Z', 420, 'CLASSIC', 11,
  { win: true, kills: 30, deaths: 1, assists: 3, damage: 60_000 });
oldRankedMatch.info.gameVersion = '15.16.1';
export const recentAramWin = modeMatch('EUN1_22002', '2026-10-27T18:00:00Z', 450, 'ARAM', 12,
  { win: true, kills: 18, deaths: 6, assists: 24, damage: 42_000 });
export const recentAramLoss = modeMatch('EUN1_22003', '2026-10-26T18:00:00Z', 450, 'ARAM', 12,
  { win: false, kills: 6, deaths: 4, assists: 12, damage: 18_000 });
export const swiftplayMatch = modeMatch('EUN1_22004', '2026-10-25T18:00:00Z', 480, 'SWIFTPLAY', 11,
  { win: false, kills: 2, deaths: 8, assists: 4, damage: 8_000 });
export const mayhemMatch = modeMatch('EUN1_22005', '2026-10-24T18:00:00Z', 2400, 'ARAM', 12,
  { win: false, kills: 0, deaths: 10, assists: 2, damage: 3_000 });
export const mixedModeMatches = [oldRankedMatch, recentAramLoss, swiftplayMatch, recentAramWin, mayhemMatch];

// Keep behavioral fixtures stable. These visual-only variations expose portrait
// and name layout differences while the ARAM pair remains comparable for Memory.
// Seven populated inventory slots stress the layout; these synthetic loadouts
// are neither gameplay recommendations nor a claim about mode item eligibility.
export const visualMatches = mixedModeMatches.map(match => ({
  ...match,
  info: { ...match.info, participants: match.info.participants.map(player => ({
    ...player,
    championName: match.info.queueId === 420 ? 'Urgot' : match.info.queueId === 480 ? 'Jinx'
      : match.info.queueId === 2400 ? 'Braum' : player.championName,
    item0: 3020, item1: 6655, item2: 3089, item3: 3157,
    item4: 3135, item5: 4645, item6: 3364,
  })) },
}));

export const itemMetadata = {
  version: '16.21.1',
  data: {
    1001: { name: 'Boots', plaintext: 'Movement speed', image: { full: '1001.png' } },
    3006: { name: "Berserker's Greaves", plaintext: 'Attack speed', image: { full: '3006.png' } },
    3047: { name: 'Plated Steelcaps', plaintext: 'Armor', image: { full: '3047.png' } },
    // Names/asset IDs checked against Riot's official 16.21.1 item catalogue.
    3020: { name: "Sorcerer's Shoes", plaintext: '', image: { full: '3020.png' } },
    3089: { name: "Rabadon's Deathcap", plaintext: '', image: { full: '3089.png' } },
    3135: { name: 'Void Staff', plaintext: '', image: { full: '3135.png' } },
    3157: { name: "Zhonya's Hourglass", plaintext: '', image: { full: '3157.png' } },
    6655: { name: "Luden's Echo", plaintext: '', image: { full: '6655.png' } },
    4645: { name: 'Shadowflame', plaintext: '', image: { full: '4645.png' } },
    3364: { name: 'Oracle Lens', plaintext: '', image: { full: '3364.png' } },
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

export type FixtureRequest = { action: string; url: string; method: string };
type FixtureResponse = { status: number; json: unknown; headers?: Record<string, string> };
type FixtureOptions = {
  matches?: Match[];
  reviewFailure?: boolean;
  timelineFailure?: boolean;
  accountFailure?: boolean;
  summonerFailure?: boolean;
  matchFailures?: string[];
  historyIds?: (queue: string | null) => string[] | Promise<string[]>;
  beforeMatch?: (id: string) => Promise<void>;
  response?: (request: FixtureRequest) => FixtureResponse | undefined | Promise<FixtureResponse | undefined>;
};
export async function installFixtures(page: Page, options: FixtureOptions = {}) {
  const records = options.matches ?? matches;
  const requests: FixtureRequest[] = [];
  // Identity assertions test the verified icon URL and fallback behavior, not
  // availability of the external image CDN. Individual artwork-failure tests
  // can still override this route with an explicit abort after installation.
  await page.route('**/img/profileicon/29.png', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88"><rect width="88" height="88" fill="#142e3b"/><circle cx="44" cy="34" r="13" fill="#acd7dd"/><path d="M20 77c0-18 10-27 24-27s24 9 24 27" fill="#6eabbc"/></svg>',
  }));
  await page.route('**/api/player/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.pathname.split('/').at(-1) ?? '';
    const recorded = { action, url: request.url(), method: request.method() };
    requests.push(recorded);
    const response = await options.response?.(recorded);
    if (response) {
      await route.fulfill(response);
      return;
    }
    let status = 200;
    let payload: unknown;
    switch (action) {
      case 'lookup': payload = { puuid, gameName: 'Fixture Player', tagLine: 'TEST' }; break;
      case 'account':
        status = options.accountFailure ? 503 : 200;
        payload = options.accountFailure
          ? { error: 'Fixture account identity is temporarily unavailable.' }
          : { puuid: url.searchParams.get('puuid') ?? puuid, gameName: url.searchParams.get('puuid') === otherPuuid ? 'Other Fixture Player' : 'Fixture Player', tagLine: 'TEST' };
        break;
      case 'rank': payload = [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 35 }]; break;
      case 'summoner':
        status = options.summonerFailure ? 503 : 200;
        payload = options.summonerFailure
          ? { error: 'Fixture summoner profile is temporarily unavailable.' }
          : { ...summoner, puuid: url.searchParams.get('puuid') ?? puuid };
        break;
      case 'history': {
        const queue = url.searchParams.get('queue');
        payload = options.historyIds ? await options.historyIds(queue) : records
          .filter(record => !queue || queue === 'all' || record.info.queueId === Number(queue))
          .sort((a, b) => b.info.gameCreation - a.info.gameCreation)
          .map(record => record.metadata.matchId);
        break;
      }
      case 'match': {
        const id = url.searchParams.get('id') ?? '';
        if (options.beforeMatch) await options.beforeMatch(id);
        if (options.matchFailures?.includes(id)) {
          status = 503;
          payload = { error: 'Fixture match summary is temporarily unavailable.' };
          break;
        }
        const record = records.find(record => record.metadata.matchId === id);
        status = record ? 200 : 404;
        payload = record && url.searchParams.get('puuid') === otherPuuid
          ? { ...record, info: { ...record.info, participants: record.info.participants.map(p => ({ ...p, puuid: otherPuuid })) } }
          : record ?? { error: 'Fixture match not found.' };
        break;
      }
      case 'items': {
        const record = records.find(record => record.metadata.matchId === url.searchParams.get('id'));
        payload = { ...itemMetadata, version: record?.info.gameVersion ?? itemMetadata.version };
        break;
      }
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
