import patch from '../../data/patches/26.16.json';
import meta from '../../data/champions.json';
const editorial = [
  { id: 'Azir', ability: 'Q', label: 'Damage', intro: 'The Emperor returns with a sharper command. Look closer at Conquering Sands.', tag: 'Damage', unit: 'base magic damage', before: [60,80,100,120,140], after: [75,95,115,135,155], headline: 'Every rank. More damage.', note: '15 more base magic damage at every rank. The ability-power ratios are unchanged. This is a recorded balance change, not a prediction of combat outcomes.' },
  { id: 'Camille', ability: 'W', label: 'Cooldown', intro: 'Precision is everything. A shorter cooldown changes the numbers behind Tactical Sweep.', tag: 'Cooldown', unit: 'seconds', before: [15,14,13,12,11], after: [12,11.5,11,10.5,10], headline: 'Less time between sweeps.', note: 'Tactical Sweep’s cooldown falls at every rank: by 3 / 2.5 / 2 / 1.5 / 1 seconds. These are base cooldowns, before ability haste.' },
  { id: 'Kennen', ability: 'R', label: 'Bonus Resistances', intro: 'Into the heart of the storm. Discover the added defenses behind Slicing Maelstrom.', tag: 'Resistances', unit: 'bonus armor & magic resistance', before: [20,40,60], after: [25,50,75], headline: 'A stronger storm defense.', note: 'Slicing Maelstrom grants 5 / 10 / 15 more bonus armor and magic resistance across its three ranks. This does not represent a fixed reduction in damage taken.' },
];
export const storyChampions = editorial.map(c => {
  const champion = patch.champions.find(row=>row.championId===c.id)!;
  const ability = champion.abilities.find(row=>row.ability===c.ability)!;
  const record = ability.changes.find(row=>row.label===c.label)!;
  if (!('before' in record) || !('after' in record)) throw new Error('Story requires a numeric record');
  const metadata = meta.champions[c.id as keyof typeof meta.champions];
  return {...c,...metadata, abilityName:ability.name, recordedBefore:record.before, recordedAfter:record.after};
});
export type StoryChampion = typeof storyChampions[number];
export const storyPatch = { id:patch.id, date:patch.releaseDate, source:patch.sourceUrl };
