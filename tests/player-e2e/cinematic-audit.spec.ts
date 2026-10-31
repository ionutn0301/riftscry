import { test,expect } from '@playwright/test';
import { installFixtures,profilePath,query,sourceMatch,visualMatches,puuid } from './fixtures';

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
  test(`${viewport.width}px: long profile names, queue controls and match labels never overlap`,async({page})=>{
    await page.setViewportSize(viewport);
    const records=visualMatches.map(match=>({...match,info:{...match.info,participants:match.info.participants.map(player=>({...player,championName:'Nunu'}))}}));
    await installFixtures(page,{matches:records,response:request=>request.action==='account'?{status:200,json:{puuid,gameName:'SixteenCharNameX',tagLine:'LONG5'}}:undefined});
    await page.goto(profilePath);await expect(page.locator('.match-row')).toHaveCount(records.length);await page.evaluate(()=>document.fonts.ready);
    const overlaps=await page.locator('.match-row').evaluateAll(rows=>rows.filter(row=>{
      const a=row.querySelector('.match-identity')!.getBoundingClientRect(),b=row.querySelector('.match-status')!.getBoundingClientRect();
      return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    }).length);
    expect(overlaps).toBe(0);
    const nested=await page.locator('main').evaluate(main=>[...main.querySelectorAll('*')].filter(node=>{
      const box=node.getBoundingClientRect();return box.width>0&&box.height>0&&/^(auto|scroll)$/.test(getComputedStyle(node).overflowY)&&node.scrollHeight>node.clientHeight+2;
    }).map(node=>node.className));
    expect(nested).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}
test('the match overview reaches AI analysis in one deliberate action',async({page})=>{
  const requests=await installFixtures(page);
  await page.goto(`/matches/${sourceMatch.metadata.matchId}?${query}`);
  await expect(page.locator('[data-match-ai-entry]')).toBeVisible();
  expect(requests.filter(request=>request.action==='review')).toEqual([]);
  await page.locator('[data-match-ai-entry]').click();
  await expect(page.locator('#match-review')).toBeVisible();
  await expect(page.locator('.review-mode')).toContainText('AI-assisted interpretation');
  await expect(page.locator('.review-full')).toHaveJSProperty('open',true);
  expect(requests.filter(request=>request.action==='review').map(request=>request.method)).toEqual(['POST']);
});
