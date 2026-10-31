import { describe,it,expect } from 'vitest';
import { advancePassage,passagePose,passageColor,passagePosition } from '../../src/lib/passage-camera';
describe('continuous Rift camera',()=>{
  it('retains its current pose when a visitor reverses travel',()=>{
    let position=0;
    for(let i=0;i<10;i++)position=advancePassage(position,4,1/60);
    const before=position;
    position=advancePassage(position,0,1/60);
    expect(position).toBeGreaterThan(0);expect(position).toBeLessThan(before);
    expect(before-position).toBeLessThan(.5);
  });
  it('converges without overshooting or allocating an endless idle journey',()=>{
    let position=0;
    for(let i=0;i<300;i++){const next=advancePassage(position,4,1/60);expect(next).toBeGreaterThanOrEqual(position);expect(next).toBeLessThanOrEqual(4);position=next;}
    expect(position).toBe(4);expect(advancePassage(position,4,1/60)).toBe(4);
  });
  it('makes reduced motion immediate while keeping every destination',()=>{
    for(let i=0;i<5;i++)expect(advancePassage(2.2,i,1/60,true)).toBe(i);
  });
  it('keeps the camera and material continuous at every boundary',()=>{
    for(let i=1;i<4;i++){
      const a=passagePose(i-.00001),b=passagePose(i+.00001);
      for(let j=0;j<3;j++)expect(Math.abs(a.rotation[j]!-b.rotation[j]!)).toBeLessThan(.001);
      expect(Math.abs(a.focal-b.focal)).toBeLessThan(.001);
      expect(passageColor(i-.00001)).toBe(passageColor(i+.00001));
    }
    expect(new Set([0,1,2,3,4].map(i=>JSON.stringify(passagePose(i).rotation))).size).toBe(5);
  });
  it('bounds invalid inputs and long frame gaps',()=>{
    expect(passagePosition(NaN)).toBe(0);expect(passagePosition(-9)).toBe(0);expect(passagePosition(10)).toBe(4);
    expect(advancePassage(0,4,100)).toBe(advancePassage(0,4,.05));
    expect(advancePassage(0,4,-2)).toBe(0);
  });
});
