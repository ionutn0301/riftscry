import { z } from 'zod';

export const coachBlockSchema = z.object({
  title: z.string().min(5).max(100),
  explanation: z.string().min(20).max(600),
  next: z.string().min(10).max(260),
  evidence: z.array(z.string().min(1).max(80)).min(1).max(5),
}).strict();
export const coachOutputSchema = z.object({
  focus: coachBlockSchema,
  patch: coachBlockSchema,
  review: coachBlockSchema,
  answer: z.object({ text: z.string().min(10).max(1000), evidence: z.array(z.string().min(1).max(80)).min(1).max(5) }).strict().nullable(),
}).strict();
export type CoachOutput = z.infer<typeof coachOutputSchema>;
const coachFactSchema = z.object({ id: z.string(), text: z.string(), href: z.string().refine(value => value.startsWith('/matches/') || /^https:\/\/www\.leagueoflegends\.com\//.test(value)), kind: z.enum(['match', 'patch', 'context']) });
export const coachReportSchema = coachOutputSchema.extend({
  mode: z.enum(['ai', 'recorded']), champion: z.string(), queue: z.string(), matchId: z.string(),
  patchId: z.string(), patchDate: z.string(), notice: z.string(), facts: z.array(coachFactSchema),
});
export type CoachFact = z.infer<typeof coachFactSchema>;
export type CoachReport = z.infer<typeof coachReportSchema>;
