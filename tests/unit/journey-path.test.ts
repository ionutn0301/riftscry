import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createJourneyPath } from '../../src/lib/journey-path';

const stations = [[0, 0, 0], [0, 0, -28], [14, 2, -54], [14, 2, -82], [0, 4, -112]];
const radius = .6;
function assertClear(p: Vector3) {
  for (const [x = 0, y = 0, z = 0] of stations) {
    const hitsFloor = Math.abs(p.x - x) < 11 + radius && Math.abs(p.y - (y - 3.2)) < .25 + radius && Math.abs(p.z - (z - 4)) < 14 + radius;
    expect(hitsFloor, `platform at ${x},${y},${z}; position ${p.toArray()}`).toBe(false);
  }
  if (Math.abs(p.z - .4) < 1.1) expect(Math.hypot(p.x, p.y - 1.4)).toBeLessThan(2.5);
  for (let i = 0; i < 5; i++) {
    if (Math.abs(p.z - (-82 - i * 4)) < 1) {
      const distance = Math.hypot(p.x - 14, p.y - 5);
      expect(distance < 5 || distance > 6.7, `archive ring clearance at ${p.toArray()}`).toBe(true);
    }
  }
  for (const x of [-8, 8]) for (const z of [-35, -26]) {
    if (p.y > -3 - radius && p.y < 8 + radius) expect(Math.hypot(p.x - x, p.z - z)).toBeGreaterThan(1.15);
  }
  // Fully open comparison apparatus extends to x=19.3; use its conservative envelope.
  expect(p.x > 8.1 && p.x < 19.9 && p.y > -.3 && p.y < 6.3 && p.z > -57 && p.z < -51).toBe(false);
}

describe('journey clearance', () => {
  for (const portrait of [false, true]) {
    it(`keeps camera and guide clear in both directions (${portrait ? 'portrait' : 'landscape'})`, () => {
      const route = createJourneyPath(portrait);
      const p = new Vector3();
      for (let i = 0; i <= 1600; i++) {
        const position = i / 400;
        assertClear(route.sample(position, p));
        for (const destination of [0, 1, 2, 3, 4]) assertClear(route.guide(position, destination, p));
      }
    });
    it('frames the whole archive collection from its entrance', () => {
      const out = new Vector3(999, 999, 999);
      expect(createJourneyPath(portrait).sample(3, out)).toBe(out);
      expect(out.toArray()).toEqual(portrait ? [14, 5, -64] : [18, 5, -68]);
      assertClear(out);
    });
    it('never reverses forward travel within a chapter', () => {
      const route = createJourneyPath(portrait);
      let previous = Infinity;
      for (let i = 0; i <= 1600; i++) {
        const z = route.sample(i / 400, new Vector3()).z;
        expect(z).toBeLessThanOrEqual(previous + .00001);
        previous = z;
      }
    });
    it('has continuous chapter boundaries', () => {
      const route = createJourneyPath(portrait);
      for (const chapter of [1, 2, 3]) expect(route.sample(chapter - .00001, new Vector3()).distanceTo(route.sample(chapter + .00001, new Vector3()))).toBeLessThan(.01);
    });
  }
});
