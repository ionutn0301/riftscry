import type {Page} from '@playwright/test';

/** Header on desktop, persistent dock on compact viewports. */
export const mapControl=(page:Page)=>page.locator('[data-map-open]:visible,[data-dock-atlas]:visible').first();
