const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('public/studio/data/operations.js','utf8'),ctx);
const O=ctx.LuxevaOperations;
const model=(id,status='active',extra={})=>({id,status,model:{name:id},...extra});
const w={models:[model('active'),model('pending','pending',{pending_reason:'Contract unsigned'}),model('frozen','frozen'),model('cancelled','cancelled'),model('archived-active','active',{archived:true}),model('archived-pending','pending',{archived:true,pending_reason:'Access'})]};
assert.equal(O.attention(w).active.length,1);assert.equal(O.attention(w).pending.length,1);
assert.equal(O.attention(w).content.length,0);assert.equal(O.attention(w).plans.length,0);
assert.throws(()=>O.transition(w.models[0],'pending','   '),/required/);
assert.throws(()=>O.transition(w.models[0],'unknown'),/Invalid/);
for(const status of O.statuses){const result=O.transition(w.models[4],status,'  Awaiting access  ');assert.equal(result.status,status);assert.equal(result.archived,true);assert.equal(result.pending_reason,status==='pending'?'Awaiting access':'');}
assert.equal(O.roster(w,{status:'pending',archived:true})[0].id,'archived-pending');
assert.equal(O.roster(w,{status:'cancelled'})[0].id,'cancelled');
assert.equal(O.roster(w,{status:'frozen',archived:true}).length,0);
const legacy=O.normalizeWorkspace({models:[{id:'old',status:'archived'},{id:'old-active'}]});
assert.equal(legacy.models[0].status,'active');assert.equal(legacy.models[0].archived,true);assert.equal(legacy.models[1].status,'active');
assert.equal(O.locked(model('p','pending',{pending_reason:'Access'})),false);
assert.equal(O.locked(model('c','cancelled')),true);
assert.throws(()=>O.validate(model('bad','pending')),/reason/);
assert.throws(()=>O.validate(model('bad','active',{archived:'yes'})),/archive/);
w.models[0].assets=[{id:'a',reviewStatus:'unreviewed'},{id:'b',reviewStatus:'unreviewed'},{id:'c',reviewStatus:'approved'}];
w.models[0].plans=[{id:'p1',status:'ready_for_review'},{id:'p2',status:'ready_for_review'},{id:'draft',status:'draft'}];
w.models[2].assets=[{id:'d',reviewStatus:'unreviewed'}];
w.models[4].assets=[{id:'e',reviewStatus:'unreviewed'}];
w.models[4].plans=[{id:'p3',status:'ready_for_review'}];
assert.equal(O.attention(w).content.length,2);assert.equal(O.unreviewed(w.models[0]).length,2);
assert.equal(O.attention(w).plans.length,1);assert.equal(O.reviewPlans(w.models[0]).length,2);
w.models[0].ideas=[{approved:true}];w.models[0].plans=[];assert.equal(O.attention(w).plans.length,0);
console.log('PASS: status transitions, reasons, legacy archive normalization, independent filters and model-based counters.');

// Real application handlers with a minimal DOM, not duplicate implementations.
const map=new Map(),nodes={},listeners={};let fail=false;
const ui=vm.createContext({console,Date,Set,URL,crypto:require('node:crypto').webcrypto,confirm:()=>true,
 document:{querySelector:k=>nodes[k]??={},querySelectorAll:()=>[]},window:{addEventListener:(event,fn)=>listeners[event]=fn},
 localStorage:{getItem:k=>map.get(k)??null,setItem(k,v){if(fail)throw Error('Quota');map.set(k,v)}}});
for(const f of ['data/workspace-store.js','data/operations.js','data/taxonomy.js','data/profile-schema.js','profile-ui.js'])vm.runInContext(fs.readFileSync('public/studio/'+f,'utf8'),ui);
let app=fs.readFileSync('public/studio/app.js','utf8');app=app.slice(0,app.lastIndexOf('if(state&&!state.ideas.length&&state.demo)'));vm.runInContext(app,ui);
vm.runInContext(`render=()=>{};const second=fresh();second.id='second';second.demo=false;agency.models.push(second);save();`,ui);
assert.equal(vm.runInContext("changeModelStatus('pending','')",ui),false);
assert.equal(vm.runInContext("changeModelStatus('pending','Awaiting contract')",ui),true);
assert.equal(vm.runInContext('state.pending_reason',ui),'Awaiting contract');
vm.runInContext('changeArchive(true)',ui);assert.equal(vm.runInContext('state.status',ui),'pending');
vm.runInContext('changeArchive(false)',ui);assert.equal(vm.runInContext('state.pending_reason',ui),'Awaiting contract');
fail=true;assert.equal(vm.runInContext("changeModelStatus('cancelled')",ui),false);assert.equal(vm.runInContext('state.status',ui),'pending');
const oldId=vm.runInContext('agency.activeId',ui);assert.equal(vm.runInContext("switchModel('second','ideas')",ui),false);assert.equal(vm.runInContext('agency.activeId',ui),oldId);
fail=false;assert.equal(vm.runInContext("switchModel('second','ideas')",ui),true);assert.equal(vm.runInContext('view',ui),'ideas');assert.equal(vm.runInContext('state.id',ui),'second');
assert.equal(JSON.parse(map.get('luxeva-workspace-v1')).workspace.activeId,'second');
// Simulate an actual external storage event and ensure unsaved changes are preserved.
const data=JSON.parse(map.get('luxeva-workspace-v1'));data.workspace.activeId=oldId;data.revision++;map.set('luxeva-workspace-v1',JSON.stringify(data));
vm.runInContext('dirty=true',ui);listeners.storage({key:'luxeva-workspace-v1'});assert.equal(vm.runInContext('state.id',ui),'second');
vm.runInContext('dirty=false',ui);listeners.storage({key:'luxeva-workspace-v1'});assert.equal(vm.runInContext('state.id',ui),oldId);assert.equal(vm.runInContext('view',ui),'ideas');
vm.runInContext('renderDashboard()',ui);assert.match(nodes['#content'].innerHTML,/Pending Models/);assert.match(nodes['#content'].innerHTML,/Awaiting contract/);assert.match(nodes['#content'].innerHTML,/No models with unreviewed content/);
assert.equal(typeof nodes['#dashboard-models'].onclick,'function');
console.log('PASS: real status persistence/rollback, model switch failure/success, cross-tab context and honest dashboard markup.');
