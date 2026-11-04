import type { CoachReport } from '../../src/lib/player/coach-contracts';

// Isolated UI fixture, never represented as a live model evaluation.
export const coachReport: CoachReport = {
  mode: 'ai', champion: 'Ahri', queue: 'Ranked Solo/Duo', matchId: 'EUN1_12348', patchId: '26.22', patchDate: '2026-11-03',
  notice: 'Fixture AI interpretation. Check the linked evidence.',
  focus: { title: 'Notice your recall timing', explanation: 'Your recorded purchase gives you a specific decision to revisit. The event does not tell us whether the timing was good.', next: 'Before your next recall, notice which information you used to choose the moment.', evidence: ['match-event-0'] },
  patch: { title: 'Check your champion’s recorded changes', explanation: 'The available archive does not record a direct Ahri change. That does not mean item or opponent changes cannot affect her.', next: 'Read the source notes for your champion and items before drawing a conclusion.', evidence: ['patch-champion-none'] },
  review: { title: 'Revisit the recorded purchase', explanation: 'The timeline records a purchase. Open the replay around that event to inspect what information was available.', next: 'Ask what you expected the purchase to help you do when you returned.', evidence: ['match-event-0'] },
  answer: null,
  facts: [
    { id: 'match-event-0', kind: 'match', text: 'Recorded item purchase in the selected game.', href: '/matches/EUN1_12348?platform=eun1&puuid=fixture-player-000000000000000000000000000000000#fact-event-0' },
    { id: 'patch-champion-none', kind: 'patch', text: 'No direct Ahri change is recorded in this archived patch.', href: 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-22-notes/' },
  ],
};
