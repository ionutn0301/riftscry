import {describe,it,expect} from 'vitest';
import {filmCamera,homeWorld,projectHomePoint,projectHomeWorld,type Vec3} from '../../src/lib/home-world';
describe('a continuous home world',()=>{
  it('moves the camera through space without mutating the world, including reverse travel',()=>{
    const geometry=JSON.stringify(homeWorld),poses=[0,1,2,3].map(p=>filmCamera(p));
    expect(new Set(poses.map(p=>p.position.join(','))).size).toBe(4);
    expect(poses[0]!.position[2]-poses[3]!.position[2]).toBeGreaterThan(100);
    for(const p of [0,.4,.8,1,1.7,2,2.8,3,2.6,1.1,0])projectHomeWorld(filmCamera(p),390,600);
    expect(JSON.stringify(homeWorld)).toBe(geometry);
    expect(filmCamera(-1)).toEqual(poses[0]);expect(filmCamera(8)).toEqual(poses[3]);
  });
  it('keeps projection finite while crossing the arches and changing aspect ratio',()=>{
    for(const size of [[1440,700],[390,590],[568,132]])for(let p=0;p<=3;p+=.12){
      const faces=projectHomeWorld(filmCamera(p),size[0]!,size[1]!);
      expect(faces.length).toBeGreaterThan(30);
      expect(faces.every(f=>f.points.length>=3&&f.points.every(point=>point.every(Number.isFinite)))).toBe(true);
      expect(faces.every((f,i)=>!i||faces[i-1]!.depth>=f.depth)).toBe(true);
    }
  });
  it('uses perspective parallax, with larger motion in nearby scenery',()=>{
    const camera={position:[0,0,0] as Vec3,target:[0,0,-1] as Vec3,lens:50,roll:0};
    const moved={...camera,position:[1,0,0] as Vec3,target:[1,0,-1] as Vec3};
    const displacement=(point:Vec3)=>Math.abs(projectHomePoint(point,camera,1000,700)!.x-projectHomePoint(point,moved,1000,700)!.x);
    expect(displacement([2,0,-5])).toBeGreaterThan(displacement([2,0,-50])*9);
    expect(projectHomePoint([0,0,1],camera,1000,700)).toBeNull();
  });
});
