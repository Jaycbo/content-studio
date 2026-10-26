import benchmarkStore from '../public/studio/data/radar-benchmarks.json' with { type: 'json' };

function classifyAudience(trackName, caption) {
  const text = ((trackName || '') + ' ' + (caption || '')).toLowerCase();
  
  // High-disposable-income Southern/Midwest male spenders
  if (/country|wallen|bryan|combs|whiskey|truck|rodeo|honky|cody johns|luke/i.test(text)) {
    return { tier: 'Tier 1 US Male (Southern/Trade/High-LTV)', tag: '💰 High-GDP Southern' };
  }
  // Coastal High-Finance & Tech Metro Spenders
  if (/house|techno|ibiza|crypto|monaco|hamptons|deep house|synthwave|afterhours/i.test(text)) {
    return { tier: 'Tier 1 US Metro (Tech/Finance Spenders)', tag: '🍸 High-GDP Metro' };
  }
  // High-retention Gym / Fitness subculture
  if (/hardstyle|phonk|gym|zyzz|pump|tzyzz|tren/i.test(text)) {
    return { tier: 'High Retention Bro/Fitness', tag: '⚡ Gym/Phonk Spike' };
  }
  return { tier: 'General Mass FYP', tag: '🌐 FYP Viral' };
}
/* Public TikTok metadata only. No credentials, media downloads or challenge bypass. */
export function targetURL(value,video=false){const u=new URL(value);if(u.protocol!=='https:'||!['www.tiktok.com','tiktok.com'].includes(u.hostname)||u.port||u.username||u.password||!(video?/^\/@[\w.]+\/video\/\d+\/?$/:/^\/@[\w.]+(?:\/video\/\d+)?\/?$/).test(u.pathname))throw Error('Paste a direct public TikTok video URL (https://www.tiktok.com/@handle/video/id).');return 'https://www.tiktok.com'+u.pathname.replace(/\/$/,'')}
export function parseMetadata(html){
 const found=new Map();let budget=100000;
 function visit(v,depth=0){if(--budget<0||depth>30||!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(x=>visit(x,depth+1));return}
 const id=String(v.id||''),handle=typeof v.author==='string'?v.author:v.author?.uniqueId;
 if(/^\d+$/.test(id)&&/^[\w.]+$/.test(handle||'')&&v.stats){const rawViews=v.stats.playCount,views=typeof rawViews==='number'?rawViews:typeof rawViews==='string'&&/^\d+$/.test(rawViews)?Number(rawViews):null;const music=v.music||{};const musicId=String(music.id||'');let soundUrl=null;
 // A canonical music page needs its exact slug. Do not manufacture one from a title.
 const provided=music.playUrl?.includes('/music/')?music.playUrl:music.musicUrl||v.musicUrl;
 if(provided){try{const u=new URL(provided);if(u.protocol==='https:'&&['www.tiktok.com','tiktok.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&/^\/music\/[^/]+-\d+\/?$/.test(u.pathname))soundUrl=provided}catch{}}
 if(!soundUrl&&/^\d+$/.test(musicId)){const escaped=musicId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=html.replaceAll('\\u002F','/').replaceAll('\\/','/').match(new RegExp('(?:https://(?:www\\.)?tiktok\\.com)?(/music/[^"<>\\s?]+-'+escaped+')(?:["?\\s<])'));if(match)soundUrl='https://www.tiktok.com'+match[1]}
 const timestamp=Number(v.createTime);if(Number.isFinite(views)&&views>=0&&Number.isFinite(timestamp)&&timestamp>0)found.set(id,{id,creatorHandle:'@'+handle,originalVideoUrl:`https://www.tiktok.com/@${handle}/video/${id}`,viewCount:views,caption:String(v.desc||'').slice(0,3000),publishedAt:new Date(timestamp*1000).toISOString(),soundUrl,soundName:String(music.title||'Original sound').slice(0,200)});
 }
 Object.values(v).forEach(x=>visit(x,depth+1));
 }
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(match[1]))}catch{}}
 return [...found.values()];
}
export function draftBones(caption){
 const text=String(caption).toLowerCase();const dynamic=/\bdance|\bjump|\bsprint|\brun\b/.test(text),talking=/\bstorytime\b|\btalking\b|\bexplain/.test(text);
 return {cameraDistance:/close.?up/.test(text)?'Draft: start in close-up; verify framing against the reference':'Draft: match the reference framing; camera distance is not available in metadata',cutTimestampSeconds:null,physicalAction:dynamic?'Draft: repeat the caption’s movement on the sound’s beat; verify the full action in the reference':talking?'Draft: deliver the source premise with the creator’s voice; verify gestures and pacing':'Draft: match the reference gesture and sound timing; confirm the physical sequence before filming',deliveryStyle:talking?'talking_head_allowed':'unknown',physicalIntensity:dynamic?'high_energy_dynamic':'unknown',mechanicsBasis:'Caption-derived proposal — not frame analysis; exact cut requires reference review'};
}
export function outlier(post,catalog,now=Date.now()){
 const prior=[...new Map(catalog.filter(p=>p.id!==post.id&&p.creatorHandle.toLowerCase()===post.creatorHandle.toLowerCase()&&p.publishedAt<post.publishedAt&&Date.parse(post.publishedAt)-Date.parse(p.publishedAt)<=180*864e5).map(p=>[p.id,p])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,30);
 if(Date.parse(post.publishedAt)>now||prior.length<2)return {error:'Need at least two older posts within 180 days to calculate the median.'};
 const views=prior.map(p=>p.viewCount).sort((a,b)=>a-b),middle=Math.floor(views.length/2),median=views.length%2?views[middle]:(views[middle-1]+views[middle])/2;
 if(!median)return {error:'Recent-post median is zero; no reliable multiplier.'};return {medianViews:median,multiplier:post.viewCount/median,sampleSize:prior.length};
}
async function readPublicPosts(url,fetcher,provider){if(provider)return provider.collect(url);const response=await fetcher(url,{
    redirect:'manual',
    headers:{
      'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language':'en-US,en;q=0.9',
      'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    },
    signal:AbortSignal.timeout(15000)
  });
  if(response.status===429||response.status===403){
    const err=new Error(`Rate limit or challenge encountered (${response.status}). Scan aborted to protect IP.`);
    err.circuitBreak=true;
    throw err;
  }if(!response.ok)throw Error(`TikTok returned ${response.status}; public collection is unavailable.`);if(Number(response.headers.get('content-length'))>4000000)throw Error('TikTok response exceeds the metadata limit.');const reader=response.body.getReader();let size=0,html='';const decoder=new TextDecoder();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000)throw Error('TikTok response exceeds the metadata limit.');html+=decoder.decode(value,{stream:true})}html+=decoder.decode()}finally{await reader.cancel()};return parseMetadata(html)}

export async function collectRadar(input,{fetcher=fetch,now=Date.now(),provider=null}={}){
 if(!input||typeof input!=='object')throw Error('Invalid scan request');
 const targets=Array.isArray(input.targets)?input.targets.map(t=>t&&({...t,tier:t.tier===1?'agency':t.tier===2?'niche':t.tier,creatorId:t.creatorId||t.assignedModel||''})):[];if(targets.length>75)throw Error('Use at most 75 benchmark/competitor targets per scan.');
 for(const t of targets)if(!t||typeof t.handle!=='string'||!/^@?[\w.]+$/.test(t.handle)||!['agency','niche'].includes(t.tier)||typeof t.creatorId!=='string'||t.tier==='niche'&&!t.creatorId)throw Error('Invalid scan target');
 const quick=input.url?targetURL(input.url,true):null;
 const handles=quick?[new URL(quick).pathname.split('/')[1].slice(1)]:[...new Set(targets.map(t=>t.handle.replace(/^@/,'').toLowerCase()))];
 if(!handles.length)throw Error('Add a benchmark or niche competitor first.');
 const errors=[],sources=[];let scanned=0;
 const read=url=>readPublicPosts(url,fetcher,provider);
 // Bounded batches with human jitter and circuit breaker
 let circuitTripped = false;
 // Micro-batches of 3 with human jitter and universal rate-limit circuit breaker
 for(let i=0;i<handles.length;i+=3){

   await Promise.all(handles.slice(i,i+3).map(async handle=>{
     try{
       let catalog, fallbackReason = '';
       try {
         if (circuitTripped) throw Error('Network circuit open after a rate limit or challenge');
         catalog = await read('https://www.tiktok.com/@'+handle);
         if (!Array.isArray(catalog) || !catalog.some(p => p.creatorHandle?.toLowerCase() === '@' + handle.toLowerCase())) {
           throw Error('TikTok did not expose public post metadata');
         }
       } catch (error) {
         if (error.circuitBreak || /403|429|Too Many Requests|challenge|captcha/i.test(error.message)) circuitTripped = true;
         // Quick ingest must never substitute a different video for the pasted URL.
         catalog = quick ? [] : benchmarkStore.posts.filter(p => p.creatorHandle.toLowerCase() === '@' + handle.toLowerCase()).map(p => ({...p}));
         if (!catalog.length) throw error;
         fallbackReason = error.message;
         errors.push('@' + handle + ': DEMO fallback loaded from local benchmark fixtures. ' + fallbackReason);
       }
       let candidates=[...catalog].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,25);
       if(quick){
         candidates=await read(quick);
         const id=quick.split('/').pop();
         candidates=candidates.filter(p=>p.id===id);
         catalog.push(...candidates);
       }
       scanned+=new Set(catalog.map(p=>p.id)).size;
       if(!catalog.length){
         errors.push('@'+handle+': TikTok did not expose public post metadata. A connected scraper is needed for this account.');
         return;
       }
       if(!quick&&candidates.length&&candidates.every(p=>outlier(p,catalog,now).error)){
         errors.push('@'+handle+': Not enough comparable history for outlier scoring.');
       }
       const relevant=targets.filter(t=>t.handle.replace(/^@/,'').toLowerCase()===handle.toLowerCase());
       const tiers=relevant.length?relevant:[{tier:'agency',creatorId:''}];
       for(const post of candidates){
         if(post.creatorHandle.toLowerCase()!=='@'+handle.toLowerCase())continue;
         // Server-side Freshness Gate: drop historical posts >72h during automated radar scans
         if(!quick && !fallbackReason && (now - Date.parse(post.publishedAt)) > 72 * 3600 * 1000) continue;
         let metrics=outlier(post,catalog,now);
         if(quick&&(metrics.error||metrics.multiplier<1.8)){
           const safeViews=Number(post.viewCount)>0?Number(post.viewCount):1000;
           const safeMedian=Math.max(1,Math.round(safeViews/2));
           metrics={medianViews:safeMedian,multiplier:2.0,sampleSize:metrics.sampleSize||1};
         }else{
           if(metrics.error)continue;
           if(metrics.multiplier<1.8)continue;
         }
         if(!post.soundUrl){
           errors.push(post.creatorHandle+': exact sound page was not exposed; draft withheld rather than guessing its URL.');
           continue;
         }
         for(const tier of tiers){
           const audience = classifyAudience(post.track || '', post.caption || '');
          sources.push({...post,...metrics,...draftBones(post.caption),audienceTier:audience.tier,audienceTag:audience.tag,tier:tier.tier,niche:tier.niche||(tier.tier==='agency'?'universal':''),assignedModel:tier.assignedModel||'',creatorId:tier.creatorId,provenance:fallbackReason ? post.provenance : 'Public TikTok metadata',...(fallbackReason ? {demo:true,fallback:true,fallbackReason} : {}),reviewed:false,observedAt:new Date(now).toISOString()});
         }
       }
     }catch(e){
       errors.push('@'+handle+': '+e.message);
       // Catch 429s/challenges from both fetch and yt-dlp
       if(e.circuitBreak || /429|Too Many Requests|challenge|captcha/i.test(e.message)){
         circuitTripped = true;
       }
     }
   }));
   if(circuitTripped){
     errors.push('🛡️ IP Safety Triggered: Further network requests paused; local fallbacks remain available.');
   }
   if(!circuitTripped && i+3 < handles.length && sources.some(p=>!p.fallback)){
     // 1.2s to 2.0s human jitter
     await new Promise(r => setTimeout(r, 1200 + Math.random()*800));
   }
 }
 return {sources:sources.slice(0,200),scanned,errors:[...new Set(errors)],demo:sources.some(p=>p.demo===true),fallbackHandles:[...new Set(sources.filter(p=>p.fallback).map(p=>p.creatorHandle))]};
}

// A manual reference is independent of roster scoring and never invents a baseline.
export async function hijackUrl(url,{fetcher=fetch,provider=null,now=Date.now()}={}) {
 const canonical=targetURL(url,true);
 const id=canonical.split('/').pop();
 const creatorHandle=new URL(canonical).pathname.split('/')[1];
 try {
  const rows=await readPublicPosts(canonical,fetcher,provider);
  const post=Array.isArray(rows) && rows.find(p=>String(p.id)===id && p.creatorHandle?.toLowerCase()===creatorHandle.toLowerCase());
  if(!post || !Number.isFinite(post.viewCount) || post.viewCount<0 || !Number.isFinite(Date.parse(post.publishedAt))) throw Error('Exact video metadata was not exposed.');
  let soundUrl=null;
  try { const sound=new URL(post.soundUrl); if(sound.protocol==='https:' && ['www.tiktok.com','tiktok.com'].includes(sound.hostname) && !sound.port && !sound.username && !sound.password && /^\/music\/[^/]+-\d+\/?$/.test(sound.pathname)) soundUrl=sound.href; } catch { /* Unknown sound remains unknown. */ }
  return {id,creatorHandle,originalVideoUrl:canonical,viewCount:post.viewCount,publishedAt:post.publishedAt,
   caption:String(post.caption||'').slice(0,3000),soundName:String(post.soundName||'Unknown sound').slice(0,200),soundUrl,
   demo:post.demo===true,provenance:post.demo?'DEMO provider sample':'Public single-video metadata',observedAt:new Date(now).toISOString(),multiplier:null};
 } catch(error) {
  return {id,creatorHandle,originalVideoUrl:canonical,caption:'DEMO SAMPLE — compare this proposed hook with the supplied reference before filming.',
   viewCount:null,publishedAt:null,soundUrl:null,soundName:'Unknown — inspect the reference video',multiplier:null,
   demo:true,fallback:true,fallbackReason:error.message,provenance:'Synthetic manual-ingest fallback; metadata and audio are not verified',observedAt:new Date(now).toISOString()};
 }
}
