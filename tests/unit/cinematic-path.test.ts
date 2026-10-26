import {describe,it,expect} from 'vitest';
import {cameraPose} from '../../src/components/home/cinematic-path';
import {parseCinema,cinemaBranch,cinemaUrl} from '../../src/components/home/cinematic-data';
describe('cinematic production contracts',()=>{
 it('has a pure reversible camera path and bounded continuous positions',()=>{for(const aspect of [.46,1,1.7,2.5])for(let i=0;i<=100;i++){const p=i/100;expect(cameraPose(p,aspect)).toEqual(cameraPose(p,aspect));const a=cameraPose(p,aspect).position,b=cameraPose(Math.min(1,p+.001),aspect).position;expect(Math.hypot(...a.map((v,j)=>v-b[j]!))).toBeLessThan(.2);}});
 it('keeps exact archived numerical arrays',()=>{expect(cinemaBranch('Azir','26.16').records[0]?.after).toBe('75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)');});
 it('does not substitute featured records for a different patch',()=>{expect(cinemaBranch('Camille','26.15').records).toHaveLength(0);});
 it('round-trips direct record URLs and rejects unknown records',()=>{const state=parseCinema('?champion=Camille&patch=26.16&change=W-0');expect(parseCinema(cinemaUrl(state).split('?')[1]!)).toEqual(state);expect(parseCinema('?champion=Azir&change=invalid').change).toBeNull();});
});
