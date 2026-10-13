import { env } from 'cloudflare:workers';
import { canonicalVideo, cleanText, audioLink, REASONS, RETENTION } from '../../../lib/reference-input';
export const dynamic='force-dynamic';
function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
function authorize(req:Request,write=false){
 if(!req.headers.get('oai-authenticated-user-id')) return json({error:'Sign in to Content Studio to use the shared library.'},401);
 if(write && (req.headers.get('Origin')!==new URL(req.url).origin || req.headers.get('X-Luxeva-Request')!=='library')) return json({error:'Open Content Studio to make this change.'},403);
 if(!env.DB) return json({error:'Shared storage is unavailable. Your reference has not been saved.'},503);
}
async function body(req:Request){if(Number(req.headers.get('content-length')||0)>20000)throw Error('Request is too large.');const text=await req.text();if(text.length>20000)throw Error('Request is too large.');return JSON.parse(text)}
export async function GET(req:Request){
 const denied=authorize(req);if(denied)return denied;
 const db=env.DB!;
 try{
 await db.prepare('DELETE FROM reference_library WHERE expires_at < ? AND NOT EXISTS (SELECT 1 FROM reference_assignments a WHERE a.reference_id=reference_library.id)').bind(Date.now()).run();
 const u=new URL(req.url),scope=u.searchParams.get('scope')||'inbox',query=cleanText(u.searchParams.get('q'),100),model=cleanText(u.searchParams.get('model'),100),page=Math.min(100000,Math.max(0,Number(u.searchParams.get('page'))||0));
 const conditions:string[]=[],args:(string|number)[]=[];
 if(scope==='inbox')conditions.push('NOT EXISTS (SELECT 1 FROM reference_assignments a WHERE a.reference_id=r.id)');
 if(scope==='assigned')conditions.push('EXISTS (SELECT 1 FROM reference_assignments a WHERE a.reference_id=r.id AND a.used=0)');
 if(scope==='used')conditions.push('EXISTS (SELECT 1 FROM reference_assignments a WHERE a.reference_id=r.id AND a.used=1)');
 if(query){conditions.push("(r.creator LIKE ? ESCAPE '\\' OR r.caption LIKE ? ESCAPE '\\' OR r.note LIKE ? ESCAPE '\\')");const q='%'+query.replace(/[\\%_]/g,'\\$&')+'%';args.push(q,q,q)}
 if(model){conditions.push('EXISTS (SELECT 1 FROM reference_assignments a WHERE a.reference_id=r.id AND a.model_id=?)');args.push(model)}
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const rows=await db.prepare('SELECT r.id,r.url,r.creator,r.caption,r.note,r.reason,r.audio,r.saved_at,r.expires_at FROM reference_library r'+where+' ORDER BY r.saved_at DESC,r.id DESC LIMIT 20 OFFSET ?').bind(...args,Math.floor(page)*20).all();
 const total=await db.prepare('SELECT count(*) AS n FROM reference_library r'+where).bind(...args).first<{n:number}>();
 const ids=rows.results.map(r=>String(r.id));
 const assigned=ids.length?(await db.prepare('SELECT reference_id,model_id,model_name,used FROM reference_assignments WHERE reference_id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all()).results:[];
 return json({items:rows.results.map(r=>({...r,assignments:assigned.filter(a=>a.reference_id===r.id)})),total:total?.n||0,page:Math.floor(page)});
 }catch{return json({error:'Could not load the shared library. Please try again.'},503)}
}
export async function POST(req:Request){
 const denied=authorize(req,true);if(denied)return denied;
 const db=env.DB!;
 try{
 const b=await body(req);
 if(b.action==='removeModel'){
 if(typeof b.modelId!=='string'||!/^[A-Za-z0-9-]{1,100}$/.test(b.modelId))throw Error('Invalid model.');
 await db.batch([db.prepare('UPDATE reference_library SET expires_at=? WHERE id IN (SELECT reference_id FROM reference_assignments WHERE model_id=?)').bind(Date.now()+RETENTION,b.modelId),db.prepare('DELETE FROM reference_assignments WHERE model_id=?').bind(b.modelId)]);
 return json({ok:true});
 }
 if(b.action==='save'){
 const v=canonicalVideo(b.url),caption=cleanText(b.caption,1000),note=cleanText(b.note,500),reason=REASONS.includes(b.reason)?b.reason:'',audio=audioLink(b.audio);
 const now=Date.now();
 const result=await db.prepare('INSERT INTO reference_library (id,url,creator,caption,note,reason,audio,saved_at,expires_at,saved_by) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(v.id,v.url,v.creator,caption,note,reason,audio,now,now+RETENTION,req.headers.get('oai-authenticated-user-id')!).run();
 return json({id:v.id,duplicate:result.meta.changes===0});
 }
 if(typeof b.id!=='string'||!/^\d{10,25}$/.test(b.id))throw Error('Invalid reference.');
 if(!await db.prepare('SELECT id FROM reference_library WHERE id=?').bind(b.id).first())return json({error:'This reference is no longer in the library.'},404);
 if(b.action==='assign'){
 if(!Array.isArray(b.models)||!b.models.length||b.models.length>100)throw Error('Select at least one model.');
 const models=b.models.map((m:any)=>{if(typeof m.id!=='string'||! /^[A-Za-z0-9-]{1,100}$/.test(m.id)||!cleanText(m.name,100))throw Error('Invalid model.');return {id:m.id,name:cleanText(m.name,100)}});
 await db.batch(models.map((m:any)=>db.prepare('INSERT INTO reference_assignments (reference_id,model_id,model_name,used) VALUES (?,?,?,0) ON CONFLICT(reference_id,model_id) DO UPDATE SET model_name=excluded.model_name').bind(b.id,m.id,m.name)));
 return json({ok:true});
 }
 if(b.action==='unassign'||b.action==='used'){
 if(typeof b.modelId!=='string'||!/^[A-Za-z0-9-]{1,100}$/.test(b.modelId))throw Error('Invalid model.');
 if(b.action==='used')await db.prepare('UPDATE reference_assignments SET used=? WHERE reference_id=? AND model_id=?').bind(b.used===true?1:0,b.id,b.modelId).run();
 else await db.batch([db.prepare('DELETE FROM reference_assignments WHERE reference_id=? AND model_id=?').bind(b.id,b.modelId),db.prepare('UPDATE reference_library SET expires_at=? WHERE id=?').bind(Date.now()+RETENTION,b.id)]);
 return json({ok:true});
 }
 if(b.action==='delete'){
 const result=await db.prepare('DELETE FROM reference_library WHERE id=? AND NOT EXISTS (SELECT 1 FROM reference_assignments a WHERE a.reference_id=reference_library.id)').bind(b.id).run();
 return result.meta.changes?json({ok:true}):json({error:'Remove model assignments before deleting this reference.'},409);
 }
 throw Error('Unknown action.');
 }catch(e){return json({error:e instanceof Error&&!/SQL|D1|database/i.test(e.message)?e.message:'Could not save this change. Please try again.'},400)}
}
