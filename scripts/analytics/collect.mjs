/** Local, on-demand public-page collector. No login, paywall bypass, media or paid calls. */
import fs from 'node:fs/promises';
import '../../public/studio/data/intelligence.js';
const I=globalThis.LuxevaIntelligence;
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/analytics/collect.mjs urls.json catalog.json');
const urls=JSON.parse(await fs.readFile(input,'utf8'));if(!Array.isArray(urls)||urls.length>50)throw Error('Supply up to 50 public profile/post URLs.');urls.forEach(u=>I.publicURL(u));
let chromium;try{({chromium}=await import('playwright'))}catch{throw Error('Install Playwright in this checkout and its Chromium browser before collecting. See docs/phase-4-intelligence.md.');}
const browser=await chromium.launch({headless:true}),posts=[],errors=[];
try{
 const context=await browser.newContext();await context.route('**/*',route=>['media','image','font'].includes(route.request().resourceType())?route.abort():route.continue());
 for(const url of urls){const page=await context.newPage();try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});I.publicURL(page.url());
  // Read platform hydration/JSON-LD. Missing fields are never fabricated as zero.
  const data=await page.locator('script[type="application/json"],script[type="application/ld+json"],script#__UNIVERSAL_DATA_FOR_REHYDRATION__,script#SIGI_STATE').allTextContents();
  const candidates=[];function visit(v,depth=0){if(!v||typeof v!=='object'||depth>30)return;if(Array.isArray(v)){v.forEach(x=>visit(x,depth+1));return}
   const direct=v.webVideoUrl||v.url||v.tweetUrl||v.videoUrl||v.contentUrl;
   if(direct)candidates.push({...v,url:direct});
   if(v.id&&v.author?.uniqueId&&v.stats)candidates.push({...v,url:`https://www.tiktok.com/@${v.author.uniqueId}/video/${v.id}`});
   if(v.shortcode&&v.taken_at_timestamp)candidates.push({...v,url:`https://www.instagram.com/reel/${v.shortcode}`,publishedAt:v.taken_at_timestamp,views:v.video_view_count,caption:v.edge_media_to_caption?.edges?.[0]?.node?.text});
   if(v.rest_id&&v.legacy?.created_at)candidates.push({url:`https://x.com/i/status/${v.rest_id}`,publishedAt:v.legacy.created_at,caption:v.legacy.full_text,views:v.views?.count,likes:v.legacy.favorite_count});
   if(v['@type']==='VideoObject')candidates.push({url:page.url(),publishedAt:v.uploadDate,caption:v.description,views:v.interactionStatistic?.find?.(x=>String(x.interactionType).includes('Watch'))?.userInteractionCount});
   Object.values(v).forEach(x=>visit(x,depth+1));
  }
  for(const text of data){try{visit(JSON.parse(text))}catch{}}
  let found=0;for(const row of candidates){try{const p=I.normalize(row);if(p.platform===I.publicURL(url).platform){posts.push(p);found++}}catch{}}
  if(!found)errors.push({url,error:'No usable public metadata. Login/challenge, dynamic layout or missing publication dates may prevent collection. Use a provider export; no automatic paid fallback.'});
 }catch(e){errors.push({url,error:e.message})}finally{await page.close()}}
}finally{await browser.close()}
await fs.writeFile(output,JSON.stringify({posts:I.merge([],posts),errors},null,2));console.log(`${posts.length} parsed snapshots; ${errors.length} URLs need attention. Output: ${output}`);
