/** Small authored pilot. Mechanics are sourced; practice prompts are editorial
 * suggestions, not matchup verdicts or automated diagnoses. Review after every
 * direct champion change before promoting a card as current. */
export const practiceGuides = [
  {
    champion: 'Garen', theme: 'Make space to recover.', role: 'Top lane practice',
    reviewedAt: '2026-11-04', reviewedThrough: '26.22',
    source: 'https://www.leagueoflegends.com/en-us/champions/garen/',
    mechanic: 'Perseverance restores health after Garen avoids damage for a while. Courage offers a brief shield and tenacity, followed by damage reduction.',
    cue: 'After a trade, check whether I can safely disengage and recover.',
    steps: [
      'In Practice Tool, read Perseverance and Courage in the client. Notice the passive indicator and the timing of Courage’s effects.',
      'In a game, choose one trade to observe. Before stepping forward, name your route back and the enemy threat you need to respect.',
      'Afterward, review the setup and exit. Did you have a safe recovery window, or did staying expose you to another trade?',
    ],
    question: 'What visible cue would tell me to end that trade sooner?',
  },
  {
    champion: 'Lux', theme: 'Choose a safe follow-up.', role: 'Mid or support practice',
    reviewedAt: '2026-11-04', reviewedThrough: '26.22',
    source: 'https://www.leagueoflegends.com/en-us/champions/lux/',
    mechanic: 'Lux’s damaging spells mark targets with Illumination. Her next attack can consume the mark for bonus damage. Final Spark also interacts with that mark.',
    cue: 'After landing a spell, check the threat before stepping into attack range.',
    steps: [
      'In Practice Tool, read Illumination in the client. Apply a mark to a dummy, then attack it and watch the mark disappear.',
      'In a game, notice one marked target. Compare your escape space and nearby enemy threats before deciding whether to follow up.',
      'Review that decision afterward. A mark is an opportunity to consider, not an obligation to walk forward.',
    ],
    question: 'Which threat made following up safe or unsafe?',
  },
  {
    champion: 'Ashe', theme: 'Keep a safe attack rhythm.', role: 'Bot lane practice',
    reviewedAt: '2026-11-04', reviewedThrough: '26.22',
    source: 'https://www.leagueoflegends.com/en-us/champions/ashe/',
    mechanic: 'Frost Shot makes Ashe’s attacks slow targets. Her critical strikes strengthen that slow instead of dealing bonus critical-strike damage.',
    cue: 'Between attacks, move toward safe space instead of automatically chasing.',
    steps: [
      'In Practice Tool, read Frost Shot in the client. Practice alternating an attack on a dummy with a short movement command.',
      'In a game, choose one fight to observe. Identify the nearest threat and a safe direction to move between attacks.',
      'Review whether your movement preserved space or drew you toward danger. A slowed opponent can still have a way to reach you.',
    ],
    question: 'Where could I have moved after that attack to keep more space?',
  },
] as const;
