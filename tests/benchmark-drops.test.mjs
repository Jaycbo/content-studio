import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(__dirname,'../public/studio/creator-ui.js'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/drop-pulse.json'),'utf8'));
let saved=JSON.stringify(['jellybeanxooo','sophieraiin']),writes=0,confirmed=false,input=null,failSave=false,scrolled=false,focused=false;
const mount={innerHTML:'',querySelectorAll:()=>[]};
const nodes={'benchmark-manager-mount':{},'benchmark-settings':{},'benchmark-editor-ui':mount,'manage-flagged-benchmarks':{},'benchmark-manager-heading':{scrollIntoView(){scrolled=true},focus(){focused=true}}};
const c={URL,Date,LuxevaCreatorEngine:{},setTimeout,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
 document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[],querySelector:()=>({})},
 localStorage:{getItem:()=>saved,setItem(k,v){if(failSave)throw Error('quota');saved=v;writes++}},
 prompt:()=>input,confirm:()=>confirmed,alert:message=>{c.message=message},
 fetch:async()=>({ok:true,status:200,json:async()=>fixture})};
vm.createContext(c);vm.runInContext(source,c);
(async()=>{
 await c.loadLatestPulse();
 assert.equal(writes,0,'Audit loading cannot change roster');
 assert.match(mount.innerHTML,/1 Benchmark Model Flagged for Removal: @jellybeanxooo/);
 assert.match(mount.innerHTML,/Suggested DROP · Preview/);assert.match(mount.innerHTML,/Remove &amp; Replace/);
 nodes['manage-flagged-benchmarks'].onclick();assert(scrolled&&focused);
 const payload=c.getBenchmarkDropNotifications(fixture,['jellybeanxooo']);assert.equal(payload[0].handle,'jellybeanxooo');assert.equal(payload[0].demo,true);
 assert.equal(c.getBenchmarkDropNotifications({benchmarkAudits:[null,{handle:'@nobody',action:'DROP'}]},['jellybeanxooo']).length,0);
 assert.equal(c.getBenchmarkDropNotifications({...fixture,benchmarkAudits:[...fixture.benchmarkAudits,...fixture.benchmarkAudits]},['jellybeanxooo']).length,1);
 c.replaceFlaggedBenchmark('jellybeanxooo');assert.equal(writes,0,'Prompt cancellation');
 input='https://www.tiktok.com/@replacement_test';c.replaceFlaggedBenchmark('jellybeanxooo');assert.equal(writes,0,'Confirmation cancellation');
 confirmed=true;input='https://evil.test/@replacement';c.replaceFlaggedBenchmark('jellybeanxooo');assert.equal(writes,0);
 input='@sophieraiin';c.replaceFlaggedBenchmark('jellybeanxooo');assert.equal(writes,0,'Duplicate cannot remove old target');
 input='@replacement_test';failSave=true;c.replaceFlaggedBenchmark('jellybeanxooo');assert.equal(writes,0);assert.match(c.message,/No removal/);assert(saved.includes('jellybeanxooo'));
 failSave=false;c.replaceFlaggedBenchmark('jellybeanxooo');assert.equal(writes,1);assert.deepEqual(JSON.parse(saved).map(t=>t.handle),['@replacement_test','@sophieraiin']);assert(!mount.innerHTML.includes('benchmark-drop-alert'));
 saved=JSON.stringify(['jellybeanxooo']);confirmed=false;c.removeBenchmarkHandle('jellybeanxooo');assert.equal(writes,1);
 confirmed=true;c.removeBenchmarkHandle('jellybeanxooo');assert.equal(saved,'[]');assert.equal(c.getActiveBenchmarkHandles().length,0,'Empty roster stays empty on reload');
 saved=JSON.stringify(['jellybeanxooo']);c.fetch=async()=>({ok:true,status:200,json:async()=>({...fixture,benchmarkAudits:[]})});await c.handleRunSynthesis();assert(!mount.innerHTML.includes('benchmark-drop-alert'),'New synthesis clears old alert');
 console.log('PASS: JSON audit → GET state → banner/tag/CTA; POST clears alert; no silent writes; cancel/invalid/duplicate/storage-failure safety; confirmed replacement; empty-roster persistence.');
})().catch(e=>{console.error(e);process.exitCode=1});
