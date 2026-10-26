import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {hijackUrl} from '../lib/radar-ingestion.mjs';
import {draftBrief,hijackAndDraft} from '../scripts/draft-brief.mjs';
import {createGeminiBriefGenerator} from '../scripts/gemini-brief.mjs';
const url='https://www.tiktok.com/@test_creator/video/123456789';
const post={id:'123456789',creatorHandle:'@test_creator',viewCount:12000,publishedAt:'2026-10-22T12:00:00Z',caption:'A proposed transition',soundName:'Reference sound',soundUrl:'https://www.tiktok.com/music/Reference-1234'};
let requests=[];
const provider={collect:async u=>{requests.push(u);return [post];}};
const video=await hijackUrl(url,{provider});assert.deepEqual(requests,[url]);assert.equal(video.demo,false);assert.equal(video.multiplier,null);
for(const collect of [async()=>[],async()=>{throw Error('429')},async()=>[{...post,id:'999'}],async()=>[{...post,viewCount:NaN}]]){
 const demo=await hijackUrl(url,{provider:{collect}});assert(demo.demo);assert.equal(demo.originalVideoUrl,url);assert.equal(demo.soundUrl,null);assert.equal(demo.viewCount,null);
}
await assert.rejects(()=>hijackUrl('https://evil.test/video/1',{provider}));
assert.equal((await hijackUrl(url,{provider:{collect:async()=>[{...post,soundUrl:'javascript:alert(1)'}]}})).soundUrl,null);
const pulse={demo:true,winningHookPatterns:[{formula:'When [X] changes but [Y] stays',angle:'Contrast'}]};
const proposal={instruction:'3 clean takes',matchedFormula:pulse.winningHookPatterns[0].formula,angles:Object.fromEntries(['mirror','commentTrap','funnelDriver'].map(key=>[key,{textHook:'When the plan changes but the look stays',screenCaption:'Same timing, my own style.'}]))};
let payload;
const generate=async p=>{payload=p;return proposal;};
const brief=await draftBrief(video,{pulse,generate});assert.equal(brief.engine,'gemini');assert.equal(payload.formulas[0].formula,proposal.matchedFormula);assert(brief.pulseDemo);
for(const generator of [null,async()=>{throw Error('429')},async()=>({...proposal,matchedFormula:'invented'})])assert.equal((await draftBrief(video,{pulse,generate:generator})).engine,'local-fallback');
assert((await draftBrief(video)).pulseUnavailable);
const generator=createGeminiBriefGenerator({apiKey:'test-only',fetcher:async(endpoint,init)=>{
 assert.match(endpoint,/generativelanguage.googleapis.com/);assert.equal(init.headers['x-goog-api-key'],'test-only');assert(JSON.parse(init.body).systemInstruction);
 return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(proposal)}]}}]})};}});
assert.equal((await draftBrief(video,{pulse,generate:generator})).engine,'gemini');
const protectedFiles=['latest-pulse.json','radar-benchmarks.json'].map(name=>new URL('../public/studio/data/'+name,import.meta.url));
const before=protectedFiles.map(p=>fs.readFileSync(p,'utf8'));
await hijackAndDraft(url,{provider,generate});assert.deepEqual(protectedFiles.map(p=>fs.readFileSync(p,'utf8')),before);
const source=fs.readFileSync(new URL('../public/studio/creator-ui.js',import.meta.url),'utf8');
const mount={innerHTML:'',querySelectorAll:()=>[]},button={},feed={innerHTML:'11-handle feed stays here'};
const roster={radarSources:[{id:'existing'}],models:[{id:'creator'}]};const original=JSON.stringify(roster);
let resolve,calls=0;
const c={URL,AbortSignal,LuxevaCreatorEngine:globalThis.LuxevaCreatorEngine,agency:roster,esc:s=>String(s??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),
 document:{getElementById:id=>id==='manual-hijack-result'?mount:id==='radar-results'?feed:null,querySelector:()=>button},
 localStorage:{setItem(){throw Error('Manual handler must not write storage')}},save(){throw Error('Must not save feed')},
 fetch:async()=>{calls++;return new Promise(r=>resolve=r)}};
vm.createContext(c);vm.runInContext(source,c);
const pending=c.handleManualHijack(url);assert(button.disabled);await c.handleManualHijack(url);assert.equal(calls,1);
resolve({ok:true,json:async()=>({video,brief:{...brief,bones:{...brief.bones,instructions:'<script>bad</script>'}}})});await pending;
assert.equal(button.disabled,false);assert.match(mount.innerHTML,/&lt;script>/);assert.match(mount.innerHTML,/panel trend-card/);assert.match(mount.innerHTML,/🎯 Manual Hijack/);assert(!mount.innerHTML.includes('<h3>'));assert.equal(mount.innerHTML.split('<article').length,2);assert(!mount.innerHTML.includes('href="javascript:'));
assert.equal(feed.innerHTML,'11-handle feed stays here');assert.equal(JSON.stringify(roster),original);
for(const fetcher of [async()=>({ok:false,json:async()=>({error:'Server failed'})}),async()=>{throw Error('Network failed')},async()=>({ok:true,json:async()=>({brief:{}})})]){
 c.fetch=fetcher;await c.handleManualHijack(url);assert.equal(button.disabled,false);assert(vm.runInContext('manualHijackError.length > 0',c));assert(vm.runInContext('manualHijackResult !== null',c));
}
assert(source.includes("handleManualHijack(new FormData(e.target).get('url'))"));
console.log('PASS: single-URL fetch, blocked/demo fallback, unknown audio, Gemini contract, local fallback, pulse/feed non-mutation, UI loading/errors/duplicate guard and safe rendering.');

// Same structural contract as automated briefs, with explicit manual metadata.
const E=globalThis.LuxevaCreatorEngine;
E.validateBrief(brief);
for(const key of ['id','creatorId','status','createdAt','scrapedSource','bones','skin','angles'])assert(key in brief);
assert.equal(brief.scrapedSource.medianOutlierMultiplier,null);
assert.equal(brief.scrapedSource.multiplierBasis,'unavailable');
assert(Number.isFinite(brief.apexHijackScore));
const demoVideo=await hijackUrl(url,{provider:{collect:async()=>[]}});
const demoBrief=await draftBrief(demoVideo,{pulse});E.validateBrief(demoBrief);
assert.equal(demoBrief.scrapedSource.medianOutlierMultiplier,2);assert.equal(demoBrief.scrapedSource.multiplierBasis,'demo');
assert.equal(demoBrief.scrapedSource.soundUrl,null);
assert.equal((await draftBrief(video,{pulse,generate:async()=>({...proposal,instruction:'x'.repeat(101)})})).engine,'local-fallback');
assert.equal((await draftBrief(video,{pulse,generate:async()=>({...proposal,instruction:'one\ntwo'})})).engine,'local-fallback');
const demoMarkup=c.TrendJackingBriefCard(demoBrief,'Test');assert.match(demoMarkup,/2.0× Preview/);assert.match(demoMarkup,/Sound unavailable/);
const automatic={...brief,manualHijack:false,scrapedSource:{...brief.scrapedSource,medianOutlierMultiplier:2}};
const autoMarkup=c.TrendJackingBriefCard(automatic,'Test');
assert.equal(mount.innerHTML.match(/<article class="([^"]+)"/)[1],autoMarkup.match(/<article class="([^"]+)"/)[1]);
assert.equal(mount.innerHTML.match(/<article[^>]+style="([^"]+)"/)[1],autoMarkup.match(/<article[^>]+style="([^"]+)"/)[1]);
// Copy stays ephemeral and retains the manual card; permission failures expose text.
let copied='',removed=false;
const copyButton={},copyStatus={},fallback={hidden:true,focus(){},select(){}};
const card={dataset:{trendId:brief.id},style:{},remove(){removed=true},querySelector:q=>({'[data-copy-trend]':copyButton,'[data-copy-status]':copyStatus,'[data-copy-fallback]':fallback}[q])};
c.navigator={clipboard:{writeText:async text=>{copied=text}}};
c.wireTrendCards({querySelectorAll:()=>[card]},[brief],'Test');await copyButton.onclick();
assert.match(copied,/Model Creates 3 variants:/);assert.match(copied,/- Caption #3:/);assert.match(copied,/When the plan changes/);
assert.equal(brief.status,'queued');assert(!removed);assert.equal(JSON.stringify(roster),original);
c.navigator.clipboard.writeText=async()=>{throw Error('permission')};await copyButton.onclick();assert.equal(fallback.hidden,false);assert.equal(fallback.value,copied);
assert.throws(()=>E.validateBrief({...brief,scrapedSource:{...brief.scrapedSource,soundUrl:'javascript:bad'}}));
console.log('PASS: shared card structure/styles, nested schema, short fields, calculated scoring, honest metric labels, manual copy/no-save and clipboard fallback.');

assert.equal(vm.runInContext('manualHijackResult.brief.apexHijackScore',c), E.computeSleeperScore(brief,[],null,0).score);
