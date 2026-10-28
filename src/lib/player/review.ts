import { generateText, Output } from 'ai';
import { z } from 'zod';
import { fallbackReview, type Fact, type Review } from './contracts';
import { cached } from './server';
const model = 'google/gemini-3.8-flash';
export async function review(facts: Fact[]): Promise<Review> {
  const baseline = fallbackReview(facts);
  try {
    return await cached(`review:prompt-2:rules-none:evidence-2:${model}:${JSON.stringify(facts)}`, 86400, async () => {
      const { output } = await generateText({ model, maxOutputTokens: 1600, maxRetries: 0, abortSignal: AbortSignal.timeout(20000), output: Output.object({ schema: z.object({ sections: z.array(z.object({ index: z.number().int().min(0).max(3), text: z.string().min(20).max(700), evidence: z.array(z.string()).min(1).max(4) })).length(4) }) }), prompt: `Write four short match-specific interpretations with evidence references: 0 neutral recorded baseline (do not invent praise), 1 a specific replay moment worth inspecting, 2 an observed item decision including undo/sale limitations, 3 one next-game observation task. Return each index once. Separate recorded facts from tentative interpretation. Use only supplied facts. No invented item names or alternatives, causal outcomes, hidden information, positioning verdicts, opponent threats, affordability claims, role benchmarks or comparison samples. No specialist itemization rules are approved. Suggest inspecting a replay or tracking one personal hypothesis, not an optimal build. Choose relevant evidence across the match, not only early events. If evidence is missing say so. Evidence: ${JSON.stringify(facts)}` });
      if (new Set(output.sections.map((s) => s.index)).size !== 4 || output.sections.some((s) => s.evidence.some((id) => !facts.some((f) => f.id === id)))) throw new Error('Unsupported evidence');
      return { ...baseline, mode: 'ai' as const, notice: 'AI interpretation, not verified fact or specialist item advice. References are validated; read the underlying records to check the interpretation.', sections: baseline.sections.map((s, index) => { const generated=output.sections.find(s=>s.index===index)!;return {...s,text:generated.text,evidence:generated.evidence}; }) };
    });
  } catch { return fallbackReview(facts, 'AI unavailable or its evidence references failed validation. Showing the deterministic review.'); }
}
