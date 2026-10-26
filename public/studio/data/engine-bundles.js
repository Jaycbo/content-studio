/* Lean import boundary: retain no media, file paths, or dense OCR frame arrays. */
(function(root){
'use strict';
const stages=()=>({top_of_funnel:['Rated R Tease','High-Glamour / Visual Tease','Hook Sequence'],mid_funnel:['Rated X Tease Bridge','4-Photo / 5s Teaser Clip'],bottom_of_funnel:['OnlyFans Vault Link','[PPV_COPY_PLACEHOLDER]']});
function parse(payload){
 const rows=Array.isArray(payload)?payload:payload?.schema_version==='2.0.0'?payload.outliers:null;
 if(!Array.isArray(rows)||rows.length>500)throw Error('Use a Studio engine catalog with at most 500 entries.');
 return rows.map(e=>{
  const m=e?.outlier_metadata,b=e?.baseline;
  if(!m||typeof m.url!=='string')throw Error('Missing source URL.');
  const u=new URL(m.url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!['tiktok.com','www.tiktok.com','instagram.com','www.instagram.com'].includes(u.hostname))throw Error('Only public TikTok and Instagram sources are supported.');
  if(!/^\/@[\w.-]+\/video\/\d+\/?$/.test(u.pathname)&&!/^\/(p|reel|reels)\/[\w-]+\/?$/.test(u.pathname))throw Error('Use a direct video reference.');
  if(!Number.isSafeInteger(m.views)||m.views<0||!Number.isFinite(b?.median_views)||b.median_views<=0||!Number.isFinite(b?.mad_views)||b.mad_views<=0||!Number.isInteger(b?.sample_size)||b.sample_size<5)throw Error('Missing valid baseline evidence.');
  const multiplier=m.views/b.median_views,z=0.6745*(m.views-b.median_views)/b.mad_views;
  if(multiplier<3||z<3)throw Error('A catalog entry fails the dual-gate test.');
  const routing=['blocked','needs_review','matched_requires_review'].includes(e.routing?.status)?e.routing.status:'needs_review';
  const text=(v,n)=>typeof v==='string'?v.slice(0,n):'';
  const brief=e.olivia_script_brief||{};
  return {key:u.origin+u.pathname.replace(/\/$/,''),source:u.origin+u.pathname,views:m.views,multiplier,z,
   creator:text(m.competitor_handle||m.creator_handle,100),targetModelId:text(e.target_model_id,100),targetModel:text(e.target_model||e.target_model_name,100),
   title:text(brief.title||m.title,200)||'Imported outlier',hook:text(brief.on_screen_text_sequence?.[0]?.text,500),
   synthetic:e.synthetic===true,routing,stages:stages()};
 });
}
function merge(previous,incoming){const records=new Map(previous.map(e=>[e.key,e]));for(const e of incoming)records.set(e.key,e);if(records.size>100)throw Error('Keep at most 100 bundles per model. Remove old bundles before importing more.');return [...records.values()];}
function sample(){return parse({schema_version:'2.0.0',outliers:[{synthetic:true,target_model:'Demo creator',outlier_metadata:{url:'https://www.tiktok.com/@luxeva_synthetic_fixture/video/1000000000000000001',views:90000,title:'Sample: golden-hour outfit transition',competitor_handle:'SYNTHETIC SAMPLE'},baseline:{median_views:12500,mad_views:1500,sample_size:18},routing:{status:'matched_requires_review'},olivia_script_brief:{title:'Sample: golden-hour outfit transition',on_screen_text_sequence:[{text:'Coffee-date era or golden-hour glam?'}]}}]})[0];}
root.LuxevaEngineBundles={parse,merge,sample,stages};
if(typeof module!=='undefined')module.exports=root.LuxevaEngineBundles;
})(globalThis);
