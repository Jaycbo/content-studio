const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(fs.readFileSync('drizzle/0000_luxuriant_warhawk.sql','utf8'));
function prepare(sql){let args=[];return {bind(...a){args=a;return this},async all(){return {results:sqlite.prepare(sql).all(...args)}},async first(){return sqlite.prepare(sql).get(...args)||null},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}}};
const DB={prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const modCache={};function load(file){if(modCache[file])return modCache[file];const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:name=>name==='cloudflare:workers'?{env:{DB}}:load('lib/reference-input.ts'),Response,Request,URL,Date,console});return modCache[file]=exports}
const {GET,POST}=load('app/api/library/route.ts'),input=load('lib/reference-input.ts');const base='https://studio.test';
function req(data,opts={}){const headers={'oai-authenticated-user-id':'test-user',...data&&{'Origin':base,'X-Luxeva-Request':'library','Content-Type':'application/json'},...opts.headers};if(opts.anonymous)delete headers['oai-authenticated-user-id'];return new Request(base+'/api/library'+(opts.query||''),{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined})}
async function post(data){const res=await POST(req(data));const body=await res.json();assert.equal(res.status,200,JSON.stringify(body));return body}
async function get(query=''){const res=await GET(req(null,{query}));const body=await res.json();assert.equal(res.status,200,JSON.stringify(body));return body}
(async()=>{
 assert.equal((await GET(req(null,{anonymous:true}))).status,401);
 assert.equal((await POST(req({action:'save'},{headers:{Origin:'https://attacker.test'}}))).status,403);
 assert.equal((await POST(req({action:'save'},{headers:{'X-Luxeva-Request':''}}))).status,403);
 for(const url of ['javascript:alert(1)','https://tiktok.com.evil.test/@a/video/1234567890123456789','https://www.tiktok.com@evil.test/@a/video/1234567890123456789','https://www.tiktok.com:8080/@a/video/1234567890123456789','https://vm.tiktok.com/abc/'])assert.throws(()=>input.canonicalVideo(url));
 const url='https://www.tiktok.com/@demo/video/1234567890123456789?tracking=discard';
 const first=await post({action:'save',url,caption:'100%_ exact <script>bad</script>',note:'a'.repeat(900),reason:'Hook'});assert.equal(first.duplicate,false);
 assert.equal((await post({action:'save',url:url.replace('demo','renamed'),caption:'do not overwrite'})).duplicate,true);
 let data=await get();assert.equal(data.total,1);assert.equal(data.items[0].url,url.split('?')[0]);assert.equal(data.items[0].note.length,500);assert.equal(data.items[0].caption,'100%_ exact <script>bad</script>');
 assert.equal((await get('?q=100%25_')).total,1);assert.equal((await get('?q=100x')).total,0);
 await post({action:'assign',id:first.id,models:[{id:'model-a',name:'A'},{id:'model-b',name:'B'}]});
 assert.equal((await get()).total,0);assert.equal((await get('?scope=assigned')).items[0].assignments.length,2);
 assert.equal((await POST(req({action:'delete',id:first.id}))).status,409);
 await post({action:'used',id:first.id,modelId:'model-a',used:true});assert.equal((await get('?scope=used&model=model-a')).total,1);
 await post({action:'assign',id:first.id,models:[{id:'model-a',name:'Updated'}]});assert.equal((await get('?scope=used')).items[0].assignments.find(a=>a.model_id==='model-a').used,1);
 sqlite.prepare('UPDATE reference_library SET expires_at=0 WHERE id=?').run(first.id);await get();assert.equal((await get('?scope=all')).total,1);
 await post({action:'unassign',id:first.id,modelId:'model-a'});await post({action:'unassign',id:first.id,modelId:'model-b'});
 assert((await get()).items[0].expires_at>Date.now()+59*86400000);
 sqlite.prepare('UPDATE reference_library SET expires_at=0 WHERE id=?').run(first.id);assert.equal((await get()).total,0);
 for(let i=0;i<23;i++)await post({action:'save',url:'https://www.tiktok.com/@test/video/'+String(2234567890123456700n+BigInt(i))});
 assert.equal((await get()).items.length,20);assert.equal((await get('?page=1')).items.length,3);
 const item=(await get()).items[0];await post({action:'delete',id:item.id});assert.equal((await get()).total,22);
 assert.equal((await POST(req({action:'assign',id:item.id,models:[{id:'x',name:'X'}]}))).status,404);
 console.log('PASS: authentication, CSRF, URL validation, tracking removal, duplicates, text limits, escaped search, assignments, used state, protected deletion, retention, expiry cleanup, pagination.');
})();
