import { generateText, Output } from 'ai';
import { z } from 'zod';
import { fallbackReview, type Fact, type Review } from './contracts';
import { ITEM_ADVICE_VERSION, type AdjustmentDraft } from './advice';
import { cached, type BeforeFetch } from './server';

const model = 'google/gemini-3.8-flash';
export const reviewSchema = z.object({
  sections: z.array(z.object({
    index: z.number().int().min(0).max(3),
    text: z.string().min(20).max(700),
    evidence: z.array(z.string()).min(1).max(4),
  })).length(4),
});

function spread<T>(values: T[], count: number): T[] {
  if (values.length <= count) return values;
  if (count <= 0) return [];
  if (count === 1) return [values.at(-1)!];
  return Array.from({ length: count }, (_, i) => values[Math.round(i * (values.length - 1) / (count - 1))]!);
}

/** Preserve summary/rule facts and sample events across the whole match. */
export function selectReviewFacts(facts: Fact[], requiredIds: string[] = []): Fact[] {
  if (facts.length <= 64) return facts;
  const required = new Set(requiredIds);
  const summary = facts.filter(f => required.has(f.id) || (f.kind !== 'death' && f.kind !== 'item'));
  const deaths = spread(facts.filter(f => f.kind === 'death' && !required.has(f.id)), Math.min(12, Math.max(0, 64 - summary.length)));
  const items = spread(facts.filter(f => f.kind === 'item' && !required.has(f.id)), Math.max(0, 64 - summary.length - deaths.length));
  return [...summary, ...[...deaths, ...items].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))];
}

/** Reference validation is a useful boundary, not a proof of prose correctness. */
export function groundedSections(raw: unknown, facts: Fact[]): z.infer<typeof reviewSchema>['sections'] {
  const { sections } = reviewSchema.parse(raw);
  const allowed = new Set(facts.map(f => f.id));
  if (new Set(sections.map(s => s.index)).size !== 4 || sections.some(s => s.evidence.some(id => !allowed.has(id)))) {
    throw new Error('Unsupported review evidence');
  }
  const numbers = (text: string) => (text.replace(/https?:\/\/\S+/g, '').match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(value => Number(value.replaceAll(',', '')));
  for (const section of sections) {
    const supported = new Set(numbers(section.evidence.map(id => facts.find(f => f.id === id)!.text).join(' ')));
    if (numbers(section.text).some(value => !supported.has(value))) throw new Error('Unsupported quantitative claim');
  }
  return sections;
}

export async function review(facts: Fact[], suggestions: AdjustmentDraft[] = [], beforeGenerate?: BeforeFetch): Promise<Review> {
  const baseline = fallbackReview(facts, undefined, suggestions);
  const selected = selectReviewFacts(baseline.facts, suggestions.flatMap(s => s.evidence));
  try {
    return await cached(`review:prompt-4-mode-aware:${ITEM_ADVICE_VERSION}:evidence-4:${model}:${JSON.stringify({ facts: baseline.facts, suggestions })}`, 86400, async () => {
      await beforeGenerate?.();
      const { output } = await generateText({
        model,
        maxOutputTokens: 1600,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(20000),
        output: Output.object({ schema: reviewSchema }),
        prompt: `You write a concise post-match review for the player. Return all four indices exactly once, with existing evidence IDs and 1–3 useful sentences each.
0: What the recorded match tells us. Use relevant supported metrics. Describe a positive only when the evidence supports it; neutral observations are welcome.
1: One specific recorded moment to inspect in a replay. Ask a useful question about the player's plan. An event is not a verdict about why it happened.
2: One actual item decision, or an explicit conditional comparison from the supplied rule facts. Use item names and exact values only when present. Include the relevant tradeoff. All rule alternatives are options for the player to evaluate, not optimal-build instructions.
3: One concrete next-game observation or one of the supplied adjustment drafts that the player can choose to save. State any condition that requires player confirmation.

Keep the main report around 150–250 words. Ground every section in the referenced facts. Every number in a section must already occur in that section's referenced evidence; preserve the recorded precision rather than inventing or rounding measurements. Do not repeat a generic disclaimer in every paragraph: the interface already explains the limits. Clearly qualify tentative interpretation.
Use only supplied evidence. A final inventory is not purchase order. Raw purchases can be undone or sold. A base-stat comparison does not model passives, upgrades, abilities, swaps or affordability. Rates are match-wide, not laning-phase measurements. Support/jungle roles have different contexts; do not import rank or role benchmarks. Do not invent comparisons with other matches, enemy threats, hidden information, positioning judgments, mental state, true rank, causal outcomes, or unprovided item advice. Never claim an alternative would prevent a death or win a game. Reference checks do not independently verify your interpretation. If useful data is absent, ask a specific replay question rather than inventing an answer.
The mode-context fact is a hard applicability boundary. Keep ARAM, ARAM: Mayhem, Swiftplay, ranked, normal and other queues separate. Never apply Summoner's Rift lane, farming, vision or standard item advice to ARAM/Arena/rotating modes. Mayhem and Arena augments are not modeled, and their effects must not be invented. Swiftplay has different progression and item rules: its rates are observations for that queue only. A recorded win flag is not an Arena placement. Current rank is separate from these match facts.
Evidence (an even sample of recorded events when the timeline is long): ${JSON.stringify(selected)}
Optional adjustment drafts: ${JSON.stringify(suggestions)}`,
      });
      const sections = groundedSections(output, selected);
      return {
        ...baseline,
        mode: 'ai' as const,
        notice: 'AI interpretation with linked match evidence. Item comparisons cover only the stated reference properties; review the conditions before saving an adjustment.',
        sections: baseline.sections.map((section, index) => {
          const generated = sections.find(s => s.index === index)!;
          return { ...section, text: generated.text, evidence: generated.evidence };
        }),
      };
    });
  } catch {
    return fallbackReview(facts, 'AI is unavailable or its evidence references did not validate. Your recorded facts and supported adjustment options remain available.', suggestions);
  }
}
