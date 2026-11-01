import {describe,it,expect} from 'vitest';
import {filmCamera,frameHomeArt} from '../../src/lib/home-world';
describe('the painted home camera',()=>{
  it('visits distinct framings, supports reverse travel and clamps scene bounds',()=>{
    const poses=[0,1,2,3].map(p=>filmCamera(p));
    expect(new Set(poses.map(p=>JSON.stringify(p))).size).toBe(4);
    expect(filmCamera(-1)).toEqual(poses[0]);expect(filmCamera(8)).toEqual(poses[3]);
    for(const p of [0,.4,.8,1,1.7,2,2.8,3,2.6,1.1,0]){
      const camera=filmCamera(p);
      expect(camera.zoom).toBeGreaterThanOrEqual(1);expect(camera.zoom).toBeLessThanOrEqual(1.2);
    }
  });
  it('covers every viewport throughout travel and rotation without revealing an image edge',()=>{
    for(const [width,height] of [[1440,700],[390,590],[568,132],[320,480],[1920,250]])for(let p=0;p<=3;p+=.08){
      for(const look of [-.5,0,.5]){
        const frame=frameHomeArt(filmCamera(p,look,look),width!,height!);
        expect(Object.values(frame).every(Number.isFinite)).toBe(true);
        expect(frame.x).toBeLessThanOrEqual(0);expect(frame.y).toBeLessThanOrEqual(0);
        expect(frame.x+frame.width).toBeGreaterThanOrEqual(width!-1e-8);
        expect(frame.y+frame.height).toBeGreaterThanOrEqual(height!-1e-8);
      }
    }
  });
  it('keeps framing continuous across scene boundaries in either direction',()=>{
    for(const p of [1,2]){
      const before=filmCamera(p-.0001),after=filmCamera(p+.0001);
      for(const key of ['x','y','zoom'] as const)expect(Math.abs(before[key]-after[key])).toBeLessThan(.00001);
    }
  });
  it('preserves the original artwork proportions and bounds pointer movement',()=>{
    const frame=frameHomeArt(filmCamera(2),390,660,1920,967);
    expect(frame.width/frame.height).toBeCloseTo(1920/967,10);
    expect(filmCamera(1,100,-100)).toEqual(filmCamera(1,.5,-.5));
    const still=filmCamera(1),look=filmCamera(1,.5,.5);
    expect(Math.abs(look.x-still.x)).toBeLessThan(.005);
    expect(Math.abs(look.y-still.y)).toBeLessThan(.003);
  });
});
