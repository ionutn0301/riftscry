import {expect,type Page} from '@playwright/test';

export async function navigateStation(page:Page,station:string){
  const direct=page.locator(`.journey-dock [data-spine-station="${station}"]`);
  if(await direct.count()){await direct.click();return;}
  await page.locator('[data-dock-atlas]').click();
  const map=page.locator('#rift-map-dialog');await expect(map).toBeVisible();
  await map.locator(`[data-passage-stop][data-station-link="${station}"]`).click();
}
