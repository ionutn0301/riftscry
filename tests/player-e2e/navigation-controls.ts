import {expect,type Page} from '@playwright/test';
import {openCinemaNavigation} from '../e2e/cinema-test-helpers';

export async function navigateStation(page:Page,station:string){
  if(await page.locator('[data-rift-cinema]').count()){
    const menu=await openCinemaNavigation(page);
    const href=station==='home'?'/':station==='pool'?'/pool#findings':`/${station}`;
    const link=menu.locator(`a[href="${href}"]`);
    await link.last().click();return;
  }
  const direct=page.locator(`.journey-dock [data-spine-station="${station}"]`);
  if(await direct.count()){await direct.click();return;}
  await page.locator('[data-dock-atlas]').click();
  const map=page.locator('#rift-map-dialog');await expect(map).toBeVisible();
  await map.locator(`[data-passage-stop][data-station-link="${station}"]`).click();
}
