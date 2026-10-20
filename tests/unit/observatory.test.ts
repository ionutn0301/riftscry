import { describe, expect, it } from 'vitest';
import { chapterAt } from '../../src/lib/observatory';
describe('observatory chapter mapping', () => {
  it('clamps endpoints', () => { expect(chapterAt(-1)).toBe(0); expect(chapterAt(8)).toBe(4); });
  it('changes at camera midpoint', () => { expect(chapterAt(.49)).toBe(0); expect(chapterAt(.5)).toBe(1); expect(chapterAt(2.6)).toBe(3); });
});
