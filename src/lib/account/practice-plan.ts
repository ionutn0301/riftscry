import { z } from 'zod';
import { notifyPersonalChange, personalStorage } from './storage';

export const PRACTICE_PLAN_KEY = 'riftscry:practice-plan:v1';
export const roles = ['Any role', 'Top', 'Jungle', 'Mid', 'Bottom', 'Support'] as const;
const profileSchema = z.object({
  displayName: z.string().trim().max(40),
  role: z.enum(roles),
  focus: z.string().trim().max(240),
}).strict();
export const practicePlanSchema = z.object({
  version: z.literal(1),
  profile: profileSchema,
  goals: z.array(z.object({
    id: z.uuid(), text: z.string().trim().min(1).max(180), done: z.boolean(),
  }).strict()).max(8).refine(goals => new Set(goals.map(goal => goal.id)).size === goals.length),
}).strict();
export type PracticePlan = z.infer<typeof practicePlanSchema>;
export type PracticeProfile = PracticePlan['profile'];
export const emptyPracticePlan = (): PracticePlan => ({ version: 1, profile: { displayName: '', role: 'Any role', focus: '' }, goals: [] });
export function parsePracticePlan(raw: string): PracticePlan {
  const result = practicePlanSchema.safeParse(JSON.parse(raw));
  if (!result.success) throw new Error('Your practice plan could not be read. Export your workspace before making changes.');
  return result.data;
}
export function readPracticePlan(): PracticePlan {
  const raw = personalStorage.getItem(PRACTICE_PLAN_KEY);
  return raw === null ? emptyPracticePlan() : parsePracticePlan(raw);
}
export function updatePracticePlan(change: (current: PracticePlan) => PracticePlan): PracticePlan {
  const next = practicePlanSchema.safeParse(change(readPracticePlan()));
  if (!next.success) throw new Error('Use a name up to 40 characters, a focus up to 240 characters, and up to 8 goals of 180 characters each.');
  personalStorage.setItem(PRACTICE_PLAN_KEY, JSON.stringify(next.data));
  notifyPersonalChange(PRACTICE_PLAN_KEY);
  return next.data;
}
