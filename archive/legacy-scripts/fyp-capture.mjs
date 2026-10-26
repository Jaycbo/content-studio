// One MANUAL, visible For You session on the burner account. Saves raw item_list responses to var/fyp-capture/.
// It never solves captchas and stops at the first block.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profileDir = path.join(root, 'var/fyp-profile'); // the burner login lives here: never commit or share
const outDir = path.join(root, 'var/fyp-capture');
fs.mkdirSync(outDir, { recursive: true });
const SCROLLS = Number(process.env.FYP_SCROLLS || 25);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stop = message => { console.error('STOP: ' + message); process.exit(2); };

const context = await chromium.launchPersistentContext(profileDir, { channel: 'chrome', headless: false, viewport: { width: 1280, height: 900 } });
const page = context.pages()[0] || await context.newPage();
let saved = 0;
page.on('response', async response => {
  if (response.status() === 403 || response.status() === 429) stop('TikTok answered HTTP ' + response.status() + ' (block or rate limit). Not retrying.');
  if (!response.url().includes('/api/recommend/item_list')) return;
  try {
    fs.writeFileSync(path.join(outDir, 'item_list-' + Date.now() + '-' + (++saved) + '.json'), JSON.stringify(await response.json(), null, 2));
    console.log('Saved response #' + saved);
  } catch (error) { console.warn('Could not read one response: ' + error.message); }
});

await page.goto('https://www.tiktok.com/foryou');
if (!(await context.cookies()).some(c => c.name.startsWith('sessionid'))) {
  console.log('Log in to the BURNER account in the browser window yourself, then press Enter here.');
  await new Promise(resolve => process.stdin.once('data', resolve));
  await page.goto('https://www.tiktok.com/foryou');
}
for (let i = 0; i < SCROLLS; i++) {
  await sleep(4000 + Math.random() * 3000);
  if (await page.locator('[id*="captcha" i], iframe[src*="captcha" i]').count()) stop('a captcha or verification appeared. Nothing was solved automatically.');
  await page.keyboard.press('ArrowDown');
}
await sleep(3000);
await context.close();
console.log('Done. ' + saved + ' item_list responses saved in ' + outDir);
