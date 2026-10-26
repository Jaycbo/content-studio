/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c=vm.createContext({URL,Date});for(const f of ['creator-engine','profile-schema','workspace-store'])vm.runInContext(fs.readFileSync('public/studio/data/'+f+'.js','utf8'),c);
const E=c.LuxevaCreatorEngine,S=c.LuxevaProfileSchema,clone=x=>JSON.parse(JSON.stringify(x));
const legacy={name:'Olivia',dateOfBirth:'2000-04-15',languages:'English, Spanish',details:{contractStart:'2026-01-01',revenueSplit:'60'},wardrobe:'Legacy saved text',platform:'TikTok'};
assert.equal(E.slug('Olivia Hernández',['olivia-hernandez']),'olivia-hernandez-2');
const p=E.profile(legacy,'olivia-hernandez');p.archetype.primaryArchetype='Custom bookish';p.archetype.toneBadges=['Warm'];p.archetype.filmingBackdrops=['Studio'];p.paywall.chatterPersonas=['Custom persona'];p.paywall.highTicketSpecialties=['Custom'];p.paywall.hardDealbreakers=['No calls'];p.channels.tiktok='@olivia';p.nicheCompetitors=[{platform:'tiktok',handle:'@reference',nicheFocus:'Pacing'}];E.validate(p);
assert.equal(p.contract.creatorSplit,60);assert.equal(p.contract.agencySplit,40);assert.equal(legacy.wardrobe,'Legacy saved text');
assert.deepEqual(clone(E.age('2008-10-22',new Date(2026,9,21))),{years:17,months:11});assert.deepEqual(clone(E.age('2008-10-21',new Date(2026,9,21))),{years:18,months:0});assert.equal(E.age('2001-02-29'),null);assert.equal(E.age('2099-01-01'),null);
for(const change of [x=>x.contract.creatorSplit=50,x=>x.demographics.dob='2020-01-01',x=>x.archetype.toneBadges='bad',x=>x.capabilities.deliveryStyle='guess',x=>x.paywall.maxCustomDurationMins=-1]){const bad=clone(p);change(bad);assert.throws(()=>E.validate(bad))}
const r={creatorHandle:'@reference',originalVideoUrl:'https://www.tiktok.com/@reference/video/12345?lang=en',soundUrl:'https://www.tiktok.com/music/Exact-sound-12345?lang=en',soundName:'Exact sound',viewCount:4500,medianViews:1000,cameraDistance:'Tripod at 2m',physicalAction:'Turn on beat',cutTimestampSeconds:2.4,deliveryStyle:'sound_sync_only',physicalIntensity:'static_chill_only',tier:'agency',creatorId:'',reviewed:true};
assert.equal(p.capabilities.physicalIntensity,undefined);
const b=E.generate(p,r,'brief-1');E.validateBrief(b);assert.equal(b.scrapedSource.originalVideoUrl,r.originalVideoUrl);assert.equal(b.scrapedSource.soundUrl,r.soundUrl);assert.equal(b.bones.physicalAction,r.physicalAction);assert.equal(Object.keys(b.angles).length,3);
const t=E.exportBrief(b,p.name);for(const expected of [r.originalVideoUrl,r.soundUrl,'Model Creates 3 variants:'])assert(t.includes(expected));
assert.throws(()=>E.source({...r,medianViews:0}));assert.throws(()=>E.source({...r,viewCount:1799}));assert.throws(()=>E.source({...r,reviewed:false}));assert.throws(()=>E.source({...r,soundUrl:'javascript:alert(1)'}));assert.equal(E.generate(p,{...r,physicalIntensity:'high_energy_dynamic'},'b').creatorId,p.id);assert.throws(()=>E.generate({...p,capabilities:{...p.capabilities,includeAgencyBenchmarks:false}},r,'b'));assert.throws(()=>E.generate({...p,status:'Paused'},r,'b'));
const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
const validateModel=o=>{S.validate(o.model);(o.trendBriefs||[]).forEach(E.validateBrief)};
const options={storage,validateModel,uuid:()=>p.id,fresh:()=>({id:p.id,model:{...legacy,creatorProfile:p},trendBriefs:[b]})};
let store=c.LuxevaWorkspaceStore.create(options),w=store.load();w.radarSources=[r];store.save(w);store=c.LuxevaWorkspaceStore.create(options);const restored=store.load();assert.deepEqual(clone(restored.models[0].model.creatorProfile),clone(p));assert.deepEqual(clone(restored.models[0].trendBriefs[0]),clone(b));assert.equal(restored.models[0].model.wardrobe,'Legacy saved text');assert.deepEqual(clone(store.prepareImport(store.exportWorkspace(restored))),clone(restored));
assert.throws(()=>store.save({...restored,radarSources:[{...r,medianViews:0}]}));
const post={creatorId:p.id,videoUrl:r.originalVideoUrl,angleType:'mirror',views:400,followers:100,publishedAt:'2026-10-01T00:00:00Z',observedAt:'2026-10-02T00:00:00Z'};assert.equal(E.performance([post],p.id,'mirror').ratio,4);assert.equal(E.performance([post],p.id,'comment_trap'),null);assert.throws(()=>E.performancePost({...post,followers:0}));
// Exact mobile template, including demo prefix, quoted hook and optional CTA.
for(const demo of [false,true]){
 const brief={...b,demo};
 const expected='#'+(demo?'Preview · ':'')+'Reference remix\nReference: '+r.originalVideoUrl+'\nSound: '+r.soundUrl+'\n\nModel Creates 3 variants:\n- Caption #1: Same timing, my own style.\n- On screen text variant 1: my custom bookish version.\n- Caption #2: Which version would you choose — and why?\n- On screen text variant 2: Keep it simple or go all out?\n- Caption #3: More from this shoot on my profile.\n- On screen text variant 3: This is only the first look.\n\nHashtags: ';
 assert.equal(E.exportBrief(brief,'Olivia'),expected);
}
const migrated=E.profile({...legacy,creatorProfile:{...p,capabilities:{...p.capabilities,physicalIntensity:'static_chill_only'}}},p.id);E.validate(migrated);assert.equal(migrated.capabilities.physicalIntensity,undefined);

// Exercise the actual clipboard component handler for both permission outcomes.
const tagMap=new Map(),tagStorage={getItem:k=>tagMap.get(k)??null,setItem:(k,v)=>tagMap.set(k,v)};
const ui=vm.createContext({localStorage:tagStorage,esc:s=>String(s??'').replaceAll('<','&lt;'),LuxevaCreatorEngine:E,navigator:{clipboard:{writeText:async text=>{ui.copied=text}}}});vm.runInContext(fs.readFileSync('public/studio/creator-ui.js','utf8'),ui);
ui.rememberCreatorTag('archetype.toneBadges','Quiet confidence');ui.rememberCreatorTag('archetype.toneBadges','quiet confidence');ui.rememberCreatorTag('archetype.filmingBackdrops','Window nook');
assert.equal(JSON.parse(tagMap.get('luxeva_custom_tags'))['archetype.toneBadges'].length,1);
const another=E.profile({name:'Another creator'},'another');assert(ui.creatorChips(another,'archetype.toneBadges','Tone',[]).includes('Quiet confidence'));assert(ui.creatorChips(another,'archetype.filmingBackdrops','Backdrop',[]).includes('Window nook'));
assert(!ui.creatorChips(another,'archetype.toneBadges','Tone',[]).includes('checked'));assert.equal(another.archetype.toneBadges.length,0);
assert(ui.archetypeGuide('Athletic / Gym Baddie').includes('activewear'));
const html=ui.TrendJackingBriefCard(b,p.name);assert(html.includes('Instructions:'));assert(!html.includes('The Sacred Bones'));assert(!html.includes(r.cameraDistance));assert(html.includes(r.originalVideoUrl));assert(html.includes(r.soundUrl));
tagMap.set('luxeva_custom_tags','bad json');assert.throws(()=>ui.rememberCreatorTag('archetype.toneBadges','New'));assert.equal(tagMap.get('luxeva_custom_tags'),'bad json');assert(ui.creatorChips(another,'archetype.toneBadges','Tone',[]));tagMap.clear();

const button={},status={},fallback={hidden:true,focus(){this.focused=true},select(){this.selected=true}},card={dataset:{trendId:b.id},querySelector:s=>s==='[data-copy-trend]'?button:s==='[data-copy-status]'?status:s==='[data-copy-fallback]'?fallback:{value:'commentTrap'}};
ui.wireTrendCards({querySelectorAll:()=>[card]},[b],p.name);
(async()=>{await button.onclick();assert.equal(ui.copied,E.exportBrief(b,p.name));ui.navigator.clipboard.writeText=async()=>{throw Error('Denied')};await button.onclick();assert.equal(fallback.hidden,false);assert(fallback.selected);assert.equal(fallback.value,ui.copied);console.log('PASS: Olivia complete schema local save/load/export, adult dates, capabilities, exact links, locked bones, three angles, clipboard success/fallback and roster ratios.');})().catch(e=>{console.error(e);process.exitCode=1});
