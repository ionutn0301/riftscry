import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/g)].map(match => [match[1], match[2]]));
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(value => { const channel = parseInt(value, 16) / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
  return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
}
describe('stone palette WCAG AA text contrast', () => {
  for (const background of ['ink', 'ink-2', 'ink-3']) {
    for (const foreground of ['cream', 'cream-dim', 'cream-faint', 'gold', 'gold-bright', 'buff', 'nerf', 'neutral']) {
      it(`${foreground} on ${background} is at least 4.5:1`, () => {
        const a = luminance(tokens[background]!); const b = luminance(tokens[foreground]!);
        expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
