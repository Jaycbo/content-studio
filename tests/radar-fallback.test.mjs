import assert from 'node:assert/strict';
import {collectRadar} from '../lib/radar-ingestion.mjs';
import store from '../public/studio/data/radar-benchmarks.json' with {type:'json'};
const targets=store.handles.map(handle=>({handle,tier:'agency',creatorId:''}));
const now=Date.parse('2026-10-23T12:00:00Z');
function verify(result){
 assert.deepEqual([...new Set(result.sources.map(p=>p.creatorHandle))].sort(),[...store.handles].sort());
 assert.equal(result.sources.length,store.handles.length);
 for(const p of result.sources){assert(p.demo && p.fallback);assert.equal(p.multiplier,p.expectedMultiplier);assert.equal(p.sampleSize,2);assert.match(p.caption,/DEMO/);assert.match(p.provenance,/Synthetic/);}
}
verify(await collectRadar({targets},{now,provider:{collect:async()=>[]}}));
verify(await collectRadar({targets},{now,provider:{collect:async()=>{throw Error('Network unavailable')}}}));
let reads=0;
verify(await collectRadar({targets},{now,fetcher:async()=>{reads++;return {status:429}}}));
assert(reads<=3,'No network requests after rate-limit batch');
const live=store.posts.filter(p=>p.creatorHandle==='@sophieraiin').map(p=>({...p,demo:false,provenance:'Public TikTok metadata',caption:'Observed caption'}));
const mixed=await collectRadar({targets},{now,provider:{collect:async url=>url.endsWith('@sophieraiin')?live:[]}});
assert.equal(mixed.sources.length,store.handles.length);assert(!mixed.sources.find(p=>p.creatorHandle==='@sophieraiin').fallback);
assert.equal(mixed.fallbackHandles.length,store.handles.length-1);
assert.equal((await collectRadar({url:'https://www.tiktok.com/@sophieraiin/video/123',targets:[]},{now,provider:{collect:async()=>[]}})).sources.length,0);
assert.equal((await collectRadar({targets:[{handle:'unknown_target',tier:'agency',creatorId:''}]},{now,provider:{collect:async()=>[]}})).sources.length,0);
verify(await collectRadar({targets},{now:now+365*864e5,provider:{collect:async()=>[]}}));
console.log('PASS: all five fallback handles, calculated multipliers, empty/failed/rate-limited scraping, circuit breaker, mixed live/sample data, fixed timestamps, unknown handles and exact-URL isolation.');
