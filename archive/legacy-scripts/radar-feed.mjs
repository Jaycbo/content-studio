import fs from 'node:fs';
import {collectRadar} from '../lib/radar-ingestion.mjs';
import {draftBrief} from './draft-brief.mjs';
import store from '../public/studio/data/radar-benchmarks.json' with {type:'json'};
export async function readRadarFeed(targets=store.targets) {
 let pulse={};try{pulse=JSON.parse(fs.readFileSync(new URL('../public/studio/data/latest-pulse.json',import.meta.url),'utf8'));}catch{}
 let cache=[];try{cache=JSON.parse(fs.readFileSync(new URL('../public/studio/data/radar-cache.json',import.meta.url),'utf8')).sources||[];}catch{}
 const available=[...cache,...(pulse.sources||[])];
 const result=targets.length?await collectRadar({targets},{provider:{collect:async()=>[]}}):{sources:[],errors:[]};
 for(const t of targets){
  const tier=t.tier===2||t.tier==='niche'?'niche':'agency';
  const cached=available.filter(p=>p.creatorHandle?.toLowerCase()===t.handle.toLowerCase()&&!p.demo&&Number.isFinite(p.medianViews)&&p.medianViews>0&&p.viewCount/p.medianViews>=1.8);
  if(cached.length){result.sources=result.sources.filter(p=>!(p.creatorHandle.toLowerCase()===t.handle.toLowerCase()&&p.tier===tier&&p.creatorId===(t.creatorId||t.assignedModel||'')));result.sources.push(...cached.map(p=>({...p,tier,niche:t.niche,assignedModel:t.assignedModel,creatorId:t.creatorId||t.assignedModel||''})));}
 }
 const briefs=await Promise.all(result.sources.map(async source=>{
  const b=await draftBrief(source,{pulse,generate:null});
  b.id='radar-'+source.id+'-'+source.tier+'-'+source.creatorId;
  b.manualHijack=false;delete b.badge;b.feedPreview=true;
  Object.assign(b.scrapedSource,{tier:source.tier,niche:source.niche,assignedModel:source.assignedModel,creatorId:source.creatorId});
  return b;
 }));
 return {briefs,targets,errors:result.errors};
}
