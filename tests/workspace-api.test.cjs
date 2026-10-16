const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const sqlite=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
function prepare(sql){let args=[];return{bind(...a){args=a;return this},async all(){return{results:sqlite.prepare(sql).all(...args)}},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}}}
const DB={prepare,async batch(ss){sqlite.exec('BEGIN');try{const r=[];for(const s of ss)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/workspace/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:()=>({env:{DB}}),Response,Request,URL,Date,TextEncoder,crypto:require('node:crypto').webcrypto});
const origin='https://studio.test';function req(method='GET',body,headers={}){return new Request(origin+'/api/workspace',{method,headers:{'oai-authenticated-user-id':'owner',Origin:origin,'X-Luxeva-Request':'workspace',...headers},...(body?{body:JSON.stringify(body)}:{})})}
const workspace={version:2,activeId:'one',models:[{id:'one',version:1,model:{name:'One',notes:'x'.repeat(199950)+'😀'.repeat(5000)},research:[],ideas:[{libraryReferenceId:'ref'}]}],taxonomy:{version:1,terms:[]}};
(async()=>{
 assert.equal((await out.GET(req('GET',null,{'oai-authenticated-user-id':''}))).status,401);
 assert.equal((await out.PUT(req('PUT',{revision:0,workspace},{Origin:'https://bad.test'}))).status,403);
 assert.equal((await (await out.GET(req())).json()).revision,0);
 let result=await out.PUT(req('PUT',{revision:0,workspace}));assert.equal(result.status,200);
 assert.deepEqual((await (await out.GET(req())).json()).workspace,workspace);
 assert.equal((await out.PUT(req('PUT',{revision:0,workspace:{...workspace,models:[]}}))).status,400);
 assert.equal((await out.PUT(req('PUT',{revision:0,workspace}))).status,409);
 const updated={...workspace,activeId:null,models:[]};assert.equal((await out.PUT(req('PUT',{revision:1,workspace:updated}))).status,200);
 assert.equal((await out.PUT(req('PUT',{revision:1,workspace}))).status,409);
 assert.deepEqual((await (await out.GET(req())).json()).workspace,updated);
 console.log('PASS: workspace auth/CSRF, SQLite roundtrip, Unicode chunks, identity validation, revision conflicts and atomic replacement.');
})().catch(e=>{console.error(e);process.exitCode=1});
