import { generateText, Output } from 'ai';
import { z } from 'zod';
import { fallbackReview, type Fact, type Review } from './contracts';
import { cached } from './server';
const model = 'google/gemini-3.8-flash';
export async function review(facts: Fact[]): Promise<Review> {
  const baseline = fallbackReview(facts);
  try {
    return await cached(`review:prompt-1:rules-none:evidence-1:${model}:${JSON.stringify(facts)}`, 86400, async () => {
      // Select approved phrasing only: valid evidence IDs alone cannot validate novel claims.
      const { output } = await generateText({ model, maxOutputTokens: 350, maxRetries: 0, abortSignal: AbortSignal.timeout(20000), output: Output.object({ schema: z.object({ sections: z.array(z.object({ index: z.number().int().min(0).max(3), evidence: z.array(z.string()).min(1).max(3) })).length(4) }) }), prompt: `Select supporting evidence IDs for each of these four reviewed statements. Do not invent facts or advice. Return every index 0 through 3 exactly once. Statements: ${JSON.stringify(baseline.sections)}. Available evidence: ${JSON.stringify(facts)}` });
      if (new Set(output.sections.map((s) => s.index)).size !== 4 || output.sections.some((s) => s.evidence.some((id) => !baseline.sections[s.index]!.evidence.includes(id) || !facts.some((f) => f.id === id)))) throw new Error('Unsupported evidence');
      return { ...baseline, mode: 'ai' as const, notice: 'AI selected evidence references for reviewed, constrained wording. No novel specialist recommendation is generated.', sections: baseline.sections.map((s, index) => ({ ...s, evidence: output.sections.find((s) => s.index === index)!.evidence })) };
    });
  } catch { return fallbackReview(facts, 'AI unavailable or its evidence references failed validation. Showing the deterministic review.'); }
}
