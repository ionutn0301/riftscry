export type Exhibit = { id: string; name: string; title: string; patch: string; classification: string; changes: { label: string; before?: string; after?: string; text?: string }[] };
export type ObservatoryData = { assetVersion?: string; latest: string; date: string; source: string; champions: Exhibit[]; patches: { id: string; date: string; count: number }[] };
export const chapters = ['Awakening', 'Constellation', 'The fracture', 'The archive', 'A new perspective'];
export function chapterAt(progress: number) { return Math.min(4, Math.max(0, Math.floor(progress + .5))); }
