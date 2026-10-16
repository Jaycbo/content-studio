import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function authorize(req:Request,write=false){
 if(!req.headers.get('oai-authenticated-user-id'))return json({error:'Sign in to the private studio.'},401);
 if(write&&(req.headers.get('Origin')!==new URL(req.url).origin||req.headers.get('X-Luxeva-Request')!=='workspace'))return json({error:'Open the studio to save.'},403);
 if(!env.DB)return json({error:'Online storage is unavailable. Local data is retained.'},503);
}
export async function GET(req:Request){
 const denied=authorize(req);if(denied)return denied;
 try{
 const rows=await env.DB!.prepare("SELECT w.revision,w.updated_at,c.id,c.payload FROM studio_workspace w LEFT JOIN studio_workspace_chunks c ON 1=1 WHERE w.id='studio' ORDER BY c.id").all();
 if(!rows.results.length)return json({revision:0,workspace:null});
 return json({revision:rows.results[0].revision,updatedAt:rows.results[0].updated_at,workspace:JSON.parse(rows.results.map(r=>r.payload||'').join(''))});
 }catch{return json({error:'Could not read the online workspace. Your local copy is safe.'},503)}
}
export async function PUT(req:Request){
 const denied=authorize(req,true);if(denied)return denied;
 try{
 if(Number(req.headers.get('content-length'))>6000000)return json({error:'Workspace exceeds the 6 MB sync limit. Export a backup and reduce profile photos.'},413);
 const raw=await req.text();if(new TextEncoder().encode(raw).length>6000000)return json({error:'Workspace exceeds the 6 MB sync limit.'},413);
 const {workspace:w,revision}=JSON.parse(raw);
 if(!Number.isSafeInteger(revision)||revision<0||w?.version!==2||!Array.isArray(w.models))return json({error:'Invalid workspace.'},400);
 const ids=w.models.map((m:any)=>m?.id);
 if(ids.some((id:any)=>typeof id!=='string'||!/^[A-Za-z0-9-]+$/.test(id))||new Set(ids).size!==ids.length||(ids.length?!ids.includes(w.activeId):w.activeId!==null))return json({error:'Invalid model identities.'},400);
 if(w.models.some((m:any)=>m.version!==1||!m.model||typeof m.model.name!=='string'||!Array.isArray(m.research)||!Array.isArray(m.ideas)||(m.status==='pending'&&!m.pending_reason?.trim())))return json({error:'Invalid model records.'},400);
 const payload=JSON.stringify(w),token=crypto.randomUUID(),db=env.DB!,now=Date.now();
 const head=revision===0?db.prepare("INSERT INTO studio_workspace(id,revision,payload,updated_at) VALUES('studio',1,?,?) ON CONFLICT(id) DO NOTHING").bind(token,now):db.prepare("UPDATE studio_workspace SET revision=revision+1,payload=?,updated_at=? WHERE id='studio' AND revision=?").bind(token,now,revision);
 const writes=[head,db.prepare("DELETE FROM studio_workspace_chunks WHERE EXISTS(SELECT 1 FROM studio_workspace WHERE id='studio' AND payload=?)").bind(token)];
 // D1 has a per-row size limit. Bound each chunk, while committing the set atomically.
 for(let i=0,index=0;i<payload.length;index++){let end=Math.min(i+200000,payload.length);if(end<payload.length&&/[\uD800-\uDBFF]/.test(payload[end-1]))end--;writes.push(db.prepare("INSERT INTO studio_workspace_chunks(id,payload) SELECT ?,? WHERE EXISTS(SELECT 1 FROM studio_workspace WHERE id='studio' AND payload=?)").bind(index,payload.slice(i,end),token));i=end;}
 const result=await db.batch(writes);
 if(!result[0].meta.changes)return json({error:'The online workspace changed. Load it or explicitly replace it after exporting your local copy.'},409);
 return json({revision:revision+1,updatedAt:now});
 }catch{return json({error:'Online save failed. Your local copy is retained.'},400)}
}
