import { generateText, Output } from 'ai';
import { z } from 'zod';

// One gateway, model and deadline for both the coach and detailed match reviews.
export const AI_MODEL = 'google/gemini-3.8-flash';
export async function structuredAI<T extends z.ZodType>(schema: T, prompt: string, system?: string) {
  const { output } = await generateText({
    model: AI_MODEL, output: Output.object({ schema }), prompt, system,
    maxOutputTokens: 2000, maxRetries: 0, abortSignal: AbortSignal.timeout(20000),
  });
  return schema.parse(output);
}

export function validateCitations(text: string, ids: string[], facts: { id: string; text: string }[]) {
  const referenced = ids.map(id => facts.find(fact => fact.id === id));
  if (!ids.length || referenced.some(fact => !fact)) throw new Error('Unsupported evidence reference');
  const numbers = (value: string) => (value.replace(/https?:\/\/\S+/g, '').match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(value => Number(value.replaceAll(',', '')));
  const supported = new Set(numbers(referenced.map(fact => fact!.text).join(' ')));
  if (numbers(text).some(value => !supported.has(value))) throw new Error('Unsupported quantitative claim');
}
