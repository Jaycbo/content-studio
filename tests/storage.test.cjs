const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('public/studio/data/workspace-store.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const {create, KEY, RECOVERY_KEY} = context.LuxevaWorkspaceStore;
const record = () => ({version:1, id:'existing-model', model:{name:'Creator'},
  research:[{id:'research-1'}], ideas:[{id:'idea-1', libraryReferenceId:'1234567890123456'}]});
const workspace = () => ({version:2, activeId:'existing-model', models:[record()]});
function fixture(initial = {}) {
  const map = new Map(Object.entries(initial));
  let failKey = null, counter = 0;
  const storage = {getItem:key => map.get(key) ?? null, setItem(key, value) {
    if (key === failKey) throw Error('Quota exceeded');
    map.set(key, value);
  }};
  const open = () => create({storage, fresh:record, uuid:()=>`generated-${++counter}`,
    validateModel:model=>{if(model.version!==1 || !model.model?.name) throw Error('Invalid model');}});
  return {map, open, fail:key=>failKey=key};
}
const plain = value => JSON.parse(JSON.stringify(value));

// One-time migration preserves every ID, reference and unknown forward field.
const original = workspace(); original.models[0].futureData = {assetId:'asset-1'};
const legacy = JSON.stringify(original);
const f = fixture({'content-studio-v2':legacy});
const store = f.open(); const loaded = store.load();
assert.deepEqual(plain(loaded), original);
assert.equal(f.map.get('content-studio-v2'), legacy);
assert.deepEqual(plain(f.open().load()), original);
assert.equal(JSON.parse(f.map.get(KEY)).revision, 1);
loaded.models[0].model.name = 'Edited';
store.save(loaded);
assert.equal(JSON.parse(f.map.get(RECOVERY_KEY)).workspace.models[0].model.name,'Creator');
assert.equal(plain(store.recover()).models[0].model.name,'Creator');

// v1 preserves an existing ID; ID-less v1 receives one only on successful migration.
const v1 = record(); delete v1.id;
const old = fixture({'content-studio-v1':JSON.stringify(v1)});
const migrated = old.open().load();
assert.equal(migrated.models[0].id,'generated-1');
assert.equal(old.open().load().models[0].id,'generated-1');
assert.equal(fixture({'content-studio-v1':JSON.stringify(record())}).open().load().models[0].id,'existing-model');

// Failed migration does not remove, replace or duplicate legacy records.
const interrupted = fixture({'content-studio-v2':legacy}); interrupted.fail(KEY);
assert.throws(()=>interrupted.open().load(), /Quota/);
assert.equal(interrupted.map.get('content-studio-v2'),legacy);
assert.equal(interrupted.map.has(KEY),false);
interrupted.fail(null); assert.equal(interrupted.open().load().models.length,1);

// Import is replacement, detached from caller input, and repeated imports do not append.
const incoming = workspace(); incoming.models[0].model.name='Imported';
store.restore(incoming); incoming.models[0].model.name='Not saved';
assert.equal(f.open().load().models[0].model.name,'Imported');
store.restore(store.prepareImport(store.exportWorkspace(workspace())));
store.restore(store.prepareImport(store.exportWorkspace(workspace())));
assert.equal(f.open().load().models.length,1);

for (const bad of ['{broken', JSON.stringify({...workspace(),version:99}),
  JSON.stringify({...workspace(),models:[record(),record()]}),
  JSON.stringify({...workspace(),activeId:'missing'}),
  JSON.stringify({format:'luxeva-workspace',schemaVersion:2,revision:1,workspace:workspace()})]) {
  const before=f.map.get(KEY);
  assert.throws(()=>store.prepareImport(bad));
  assert.equal(f.map.get(KEY),before);
}
// Either snapshot failure or authoritative-write failure leaves current data intact.
for (const key of [RECOVERY_KEY, KEY]) {
  const before=f.map.get(KEY); f.fail(key);
  assert.throws(()=>store.restore(incoming),/Quota/);
  assert.equal(f.map.get(KEY),before);
  f.fail(null);
}

// Stale tabs must reload/export rather than silently overwrite another tab's work.
const tabA=f.open(), tabB=f.open(), a=tabA.load(), b=tabB.load();
a.models[0].model.name='Tab A'; tabA.save(a);
assert.throws(()=>tabB.save(b),/another tab/);
assert.throws(()=>tabB.restore(b),/another tab/);
assert.equal(f.open().load().models[0].model.name,'Tab A');

// Corruption never falls back to the old legacy key and overwrites newer data.
const corrupt = fixture({[KEY]:'broken', [RECOVERY_KEY]:store.exportWorkspace(workspace()),
  'content-studio-v2':legacy});
const recovery=corrupt.open(); assert.throws(()=>recovery.load());
assert.throws(()=>recovery.save(workspace()),/could not be read/);
assert.equal(recovery.exportUnreadable(),'broken');
assert.equal(recovery.recover().models[0].id,'existing-model');
assert.equal(corrupt.map.get(RECOVERY_KEY),'broken');

// An intentionally empty workspace must stay empty on reload.
const empty={version:2,activeId:null,models:[]};
const emptyStore=corrupt.open(); emptyStore.load(); emptyStore.restore(empty);
assert.deepEqual(plain(corrupt.open().load()),empty);
console.log('PASS: storage migrations, stable IDs/links, validation, replacement imports, quota failures, explicit recovery, stale-tab conflicts and empty workspaces.');

// Exercise the actual restore event handler: no false success or in-memory replacement.
const app=fs.readFileSync('public/studio/app.js','utf8').split('if(state&&!state.ideas.length&&state.demo)')[0];
const nodes={}, uiMap=new Map(); let fail=false;
const ui=vm.createContext({console,URL,Date,Set,crypto:require('node:crypto').webcrypto,
  document:{querySelector:key=>nodes[key]??={},querySelectorAll:()=>[]},
  window:{addEventListener(){}},confirm:()=>true,
  localStorage:{getItem:key=>uiMap.get(key)??null,setItem(key,value){if(fail)throw Error('Quota');uiMap.set(key,value);}}});
vm.runInContext(source,ui);vm.runInContext(fs.readFileSync('public/studio/data/operations.js','utf8'),ui);for(const name of ['data/taxonomy.js','data/profile-schema.js','profile-ui.js'])vm.runInContext(fs.readFileSync('public/studio/'+name,'utf8'),ui);vm.runInContext(app,ui);vm.runInContext('render=()=>{}',ui);
(async()=>{
  const prior=uiMap.get(KEY);
  const backup=vm.runInContext("workspaceStore.exportWorkspace({...agency,models:agency.models.map(m=>({...m,model:{...m.model,name:'Restored'}}))})",ui);
  const event={target:{files:[{text:async()=>backup}],value:'file'}};
  fail=true;await nodes['#restore'].onchange(event);
  assert.equal(uiMap.get(KEY),prior);
  assert.notEqual(vm.runInContext('state.model.name',ui),'Restored');
  assert.match(nodes['#notice'].textContent,/Could not restore/);
  fail=false;await nodes['#restore'].onchange(event);
  assert.equal(vm.runInContext('state.model.name',ui),'Restored');
  assert.equal(JSON.parse(uiMap.get(KEY)).workspace.models[0].model.name,'Restored');
  assert.equal(nodes['#notice'].textContent,'Model workspace restored.');
  console.log('PASS: real UI restore handler preserves memory and disk on failure and reports success only after saving.');
})().catch(error=>{console.error(error);process.exitCode=1;});
