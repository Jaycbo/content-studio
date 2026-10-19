// Run the real async file-input handler without opening a browser or file picker.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const now=Date.now(),posts=[80,90,100,110,120,500].map((views,i)=>({url:`https://www.tiktok.com/@fixture/video/${i+1}`,views,publishedAt:new Date(now-(8-i)*864e5).toISOString(),observedAt:new Date(now).toISOString(),caption:'Car Storytime GRWM'}));
const payload=JSON.stringify({posts});const elements={'#signal-competitor':{value:'creator'},'#signal-provider':{value:'local'},'#signal-file':{},'#content':{prepend(){}}};let saved,fail=false;
const state={id:'model',competitors:[{id:'creator',name:'Fixture'}],ideas:[],model:{name:'Fixture'}};
const c=vm.createContext({URL,Date,crypto:require('node:crypto').webcrypto,state,agency:{taxonomy:{terms:[]}},Ops:{locked:()=>false},competitorProfiles:x=>x,esc:String,$:s=>elements[s],document:{createElement:()=>({})},render(){},notice(){},save(){if(fail)return false;saved=JSON.stringify(state);return true}});
for(const file of ['data/intelligence.js','intelligence-ui.js'])vm.runInContext(fs.readFileSync('public/studio/'+file,'utf8'),c);
vm.runInContext('renderIntelligenceImport()',c);
const event=text=>({target:{files:[{size:text.length,text:async()=>text}],value:'fixture.json'}});
(async()=>{await elements['#signal-file'].onchange(event(payload));assert.equal(state.competitorCatalogs[0].posts.length,6);const restored=JSON.parse(saved),catalog=restored.competitorCatalogs[0].posts,p=catalog.find(p=>p.views===500);const result=c.LuxevaIntelligence.evaluate(p,catalog,now);assert.equal(result.pass,true);assert.equal(result.multiplier,5);assert.ok(Math.abs(result.z-26.97959)<.00001);
await elements['#signal-file'].onchange(event(payload));assert.equal(state.competitorCatalogs[0].posts.length,6);const before=JSON.stringify(state);await elements['#signal-file'].onchange(event('{invalid'));assert.equal(JSON.stringify(state),before);fail=true;await elements['#signal-file'].onchange(event(JSON.stringify({posts:[{...posts[0],views:999}]})));assert.equal(JSON.stringify(state),before);
console.log('PASS: real file import handler, reloadable snapshots, deduplication, invalid JSON and failed-save rollback; outlier = 5x median, modified Z = 26.97959.');})().catch(e=>{console.error(e);process.exitCode=1});
