import {readPlatformTrends} from './platform-trends.mjs';
import '../public/studio/data/creator-engine.js';
import {randomUUID} from 'node:crypto';
import {createGeminiBriefGenerator} from './gemini-brief.mjs';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {hijackUrl} from '../lib/radar-ingestion.mjs';
import {createScraperProvider} from './analytics/radar-provider.mjs';
const pulsePath=new URL('../public/studio/data/latest-pulse.json',import.meta.url);
function readPulse() {
 try {const pulse=JSON.parse(fs.readFileSync(pulsePath,'utf8'));if(!Array.isArray(pulse.winningHookPatterns))throw Error('Missing formulas');return pulse;}
 catch {return {winningHookPatterns:[],unavailable:true};}
}
// Isolated drafting boundary: inputs in, brief out, no file writes.
export async function draftBrief(video,{pulse={},generate=null,trends=readPlatformTrends()}={}) {
 const formulas=(Array.isArray(pulse.winningHookPatterns)?pulse.winningHookPatterns:[]).slice(0,10)
  .filter(h=>h && typeof h.formula==='string').map(h=>({formula:h.formula.slice(0,1200),angle:String(h.angle||'').slice(0,200)}));
 const angleSpecs=[['mirror','mirror','The Mirror','Baseline reach'],['commentTrap','comment_trap','The Comment Trap','Conversation'],['funnelDriver','funnel_driver','The Funnel Driver','Profile visits']];
 let proposal={instruction:'3 clean takes',matchedFormula:'',angles:{
  mirror:{textHook:'One detail you might have missed…',screenCaption:'Same timing, my own style.'},
  commentTrap:{textHook:'Keep it simple or go all out?',screenCaption:'Which version would you choose?'},
  funnelDriver:{textHook:'This is only the first look.',screenCaption:'More from this shoot on my profile.'}}};
 let engine='local-fallback',warning='Local template — review before use.';
 const short=(v,max)=>typeof v==='string' && v.trim().length>0 && v.length<=max && !/[\r\n]/.test(v);
 if(generate) {
  try {
   let result=await generate({video,pulseDemo:pulse.demo===true,formulas,trends});
   if(result?.briefPayload){
    const p=result.briefPayload;
    if(!short(p.title,100)||!Array.isArray(p.variants)||p.variants.length!==3||p.variants.some(v=>!short(v.caption,160)||!short(v.onScreenText,160))||typeof p.hashtags!=='string')throw Error('Invalid dual brief');
    const dual=result;
    result={instruction:dual.bones?.instructions,matchedFormula:dual.bones?.hookMatch,briefPayload:p,angles:Object.fromEntries(angleSpecs.map(([key],i)=>[key,{textHook:p.variants[i].onScreenText,screenCaption:p.variants[i].caption}]))};
   }
   if(!short(result?.instruction,100)||typeof result.matchedFormula!=='string'||
    (result.matchedFormula&&!formulas.some(f=>f.formula===result.matchedFormula)) ||
    angleSpecs.some(([key])=>!short(result.angles?.[key]?.textHook,160)||!short(result.angles?.[key]?.screenCaption,160)))throw Error('Invalid compact brief');
   proposal=result;engine='gemini';warning='';
  } catch {warning='Gemini unavailable or returned an invalid card. Local template shown.';}
 }
 const calculated=Number.isFinite(video.viewCount)&&video.viewCount>=0&&Number.isFinite(video.medianViews)&&video.medianViews>0;
 const multiplier=calculated?video.viewCount/video.medianViews:video.demo?2:null;
 const brief={id:'manual-'+randomUUID(),creatorId:'manual-preview',status:'queued',createdAt:Date.now(),
  manualHijack:true,demo:video.demo===true,reviewRequired:true,reviewed:false,engine,warning,pulseDemo:pulse.demo===true,pulseUnavailable:!formulas.length,
  instruction:proposal.instruction,matchedFormula:proposal.matchedFormula,
  scrapedSource:{creatorHandle:video.creatorHandle,platform:'tiktok',originalVideoUrl:video.originalVideoUrl,soundUrl:video.soundUrl??null,soundName:video.soundName||'Unknown sound',
   viewCount:video.viewCount,medianOutlierMultiplier:multiplier,multiplierBasis:video.demo?'demo':calculated?'calculated':'unavailable',
   provenance:video.provenance,caption:video.caption||'',publishedAt:video.publishedAt,duration:video.duration??null,mechanicsBasis:'Metadata-derived proposal; reference review required'},
  bones:{cameraDistance:'Match reference after review',cutTimestampSeconds:null,physicalAction:proposal.instruction},
  skin:{wardrobe:'Confirm outfit with creator',props:[],filmingLocation:'Confirm backdrop with creator'},
  angles:Object.fromEntries(angleSpecs.map(([key,angleType,label,objective])=>[key,{angleType,label,objective,textHook:proposal.angles[key].textHook,screenCaption:proposal.angles[key].screenCaption}]))};
 const age=video.demo||!Number.isFinite(Date.parse(video.publishedAt))?null:Math.max(0,(Date.now()-Date.parse(video.publishedAt))/3600000);
 const score=globalThis.LuxevaCreatorEngine.computeSleeperScore(brief,[],age,0);
 brief.apexHijackScore=score.score;
 brief.scoreBasis=(video.demo?'Preview metadata heuristic. ':'Metadata heuristic; no roster audio-cluster context. ')+score.reasons;
 globalThis.LuxevaCreatorEngine.validateBrief(brief);
 const dual=globalThis.LuxevaCreatorEngine.toDualBrief(brief);
 // Preserve validated Gemini text after normalization.
 if (engine === 'gemini') {
  dual.bones.instructions = proposal.instruction;
  dual.bones.hookMatch = proposal.matchedFormula;
 }

 if(proposal.briefPayload)dual.briefPayload=proposal.briefPayload;
 else if(trends.activeThemes.length){
  dual.briefPayload.title=trends.activeThemes[0]+' remix';
  dual.briefPayload.variants=dual.briefPayload.variants.map((v,i)=>({...v,onScreenText:trends.activeThemes[i%trends.activeThemes.length]+': '+v.onScreenText}));
 }
 dual.briefPayload.hashtags=[...new Set([...(video.caption?.match(/#[\p{L}\p{N}_]+/gu)||[]),...(dual.briefPayload.hashtags.match(/#[\p{L}\p{N}_]+/gu)||[]),...trends.trendingHashtags])].join(' ');
 return dual;
}

export async function hijackAndDraft(url,options={}) {
 const video=await hijackUrl(url,{provider:options.provider,fetcher:options.fetcher});
 const brief=await draftBrief(video,{pulse:options.pulse ?? readPulse(),generate:options.generate === undefined ? createGeminiBriefGenerator() : options.generate});
 return {video,brief};
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
 const url=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
 if(!url){console.error('Usage: node scripts/draft-brief.mjs https://www.tiktok.com/@handle/video/id [--demo] [--offline]');process.exitCode=1;}
 else {
  const provider=process.argv.includes('--demo')?{collect:async()=>{throw Error('Forced DEMO for verification');}}:createScraperProvider();
  hijackAndDraft(url,{provider,...(process.argv.includes('--offline')?{generate:null}:{})}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
 }
}
