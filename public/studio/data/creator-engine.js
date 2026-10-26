/* Pure four-box profile and reviewed trend adapter. No network or media storage. */
(function(root){
'use strict';
const archetypes=['Athletic / Gym Baddie','Girl Next Door (GND)','Glamour / High-Maintenance','Clean Girl / Aesthetic Wellness','Sun-Kissed / Coastal Beach','Alt / Gamer / Subculture','Tomboy / Streetwear','Classic / Sophisticated'];
const energy=['High-Energy & Rapid-Fire','Casual & Conversational','Sultry & Low-Tempo','Deadpan & Unbothered'];
const clone=x=>JSON.parse(JSON.stringify(x));
const list=x=>Array.isArray(x)?x:typeof x==='string'?x.split(',').map(s=>s.trim()).filter(Boolean):[];
function age(dob,now=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dob))return null;
 const [y,m,d]=dob.split('-').map(Number),date=new Date(y,m-1,d);
 if(date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d||date>now)return null;
 let months=(now.getFullYear()-y)*12+now.getMonth()-m+1;if(now.getDate()<d)months--;
 return {years:Math.floor(months/12),months:months%12};
}
function slug(name,ids=[]){const base=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'creator';let id=base,n=2;while(ids.includes(id))id=base+'-'+n++;return id}
function profile(m,id){
 const d=m.details||{};
 const defaults={id:id||m.id||'',name:m.name||'',status:'Active',avatarUrl:m.photo||'',contract:{startDate:d.contractStart||'',endDate:d.contractEnd||'',autoRenew:false,agencySplit:d.revenueSplit?100-Number(d.revenueSplit):50,creatorSplit:d.revenueSplit?Number(d.revenueSplit):50},demographics:{dob:m.dateOfBirth||'',heritage:m.nationality||'',location:m.homeLocation||'',languages:list(m.languages)},channels:{tiktok:(m.accountEntries||[]).find(a=>a.platform==='TikTok')?.handle||'',instagram:'',twitter:'',telegramChannel:'',onlyFansVip:'',onlyFansFree:'',emergencyContact:m.preferredContact||d.preferredContact||''},archetype:{primaryArchetype:m.niche||'',secondaryArchetype:'None',energyPace:energy[1],toneBadges:list(m.preferred_tones),filmingBackdrops:list(d.locations||m.locations),signatureAesthetic:''},capabilities:{deliveryStyle:'sound_sync_only',includeAgencyBenchmarks:true},paywall:{pageModel:'Paid VIP',customsAllowed:false,customsSla:'48-72 Hours',saysFanName:false,maxCustomDurationMins:10,chatterPersonas:[],bilingualChattingAllowed:false,textingQuirks:'',highTicketSpecialties:[],hardDealbreakers:list(m.filming_boundaries),dealbreakerNotes:''},nicheCompetitors:[]};
 const saved=m.creatorProfile||{};const out={...defaults,...saved};for(const k of ['contract','demographics','channels','archetype','capabilities','paywall'])out[k]={...defaults[k],...saved[k]};out.id=id||out.id;delete out.paywall.subscriptionPrice;delete out.capabilities.physicalIntensity;if(out.paywall.maxCustomDurationMins===0)out.paywall.maxCustomDurationMins=10;if(out.paywall.dealbreakerNotes==='Fully clothed public content. No identifying locations.'||out.paywall.dealbreakerNotes==='Fully clothed public content')out.paywall.dealbreakerNotes='';return clone(out);
}
function validate(p){
 const fail=s=>{throw Error(s)};const str=(v,k)=>{if(typeof v!=='string')fail('Invalid '+k)};
 const nums=(v,k,max=Infinity)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)fail('Invalid '+k)};
 const enums=(v,x,k)=>{if(!x.includes(v))fail('Invalid '+k)};
 if(!p||typeof p!=='object')fail('Invalid creator profile');
 for(const k of ['id','name','avatarUrl'])str(p[k],k);if(!p.name.trim()||!p.id)fail('Name and stable creator ID are required');
 enums(p.status,['Active','Paused','Offboarding'],'status');
 const groups={contract:['startDate','endDate'],demographics:['dob','heritage','location'],channels:['tiktok','instagram','twitter','telegramChannel','onlyFansVip','onlyFansFree','emergencyContact'],archetype:['primaryArchetype','secondaryArchetype','energyPace','signatureAesthetic'],paywall:['pageModel','customsSla','textingQuirks','dealbreakerNotes']};
 for(const [g,keys] of Object.entries(groups)){if(!p[g]||typeof p[g]!=='object')fail('Missing '+g);for(const k of keys)str(p[g][k],g+'.'+k)}
 for(const [g,k] of [['demographics','languages'],['archetype','toneBadges'],['archetype','filmingBackdrops'],['paywall','chatterPersonas'],['paywall','highTicketSpecialties'],['paywall','hardDealbreakers']])if(!Array.isArray(p[g][k])||p[g][k].some(x=>typeof x!=='string'))fail('Invalid '+k);
 for(const [g,k] of [['contract','autoRenew'],['capabilities','includeAgencyBenchmarks'],['paywall','customsAllowed'],['paywall','saysFanName'],['paywall','bilingualChattingAllowed']])if(typeof p[g]?.[k]!=='boolean')fail('Invalid '+k);
 for(const key of ['startDate','endDate']){const v=p.contract[key];if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))fail('Invalid contract date')}
 if(p.contract.startDate&&p.contract.endDate&&p.contract.endDate<p.contract.startDate)fail('Contract end must follow start');
 nums(p.contract.agencySplit,'agency split',100);nums(p.contract.creatorSplit,'creator split',100);if(Math.abs(p.contract.agencySplit+p.contract.creatorSplit-100)>.001)fail('Agency and creator splits must total 100%');
 if(p.demographics.dob&&(!age(p.demographics.dob)||age(p.demographics.dob).years<18))fail('Date of birth must identify an adult (18+)');
 enums(p.archetype.energyPace,energy,'energy');enums(p.capabilities.deliveryStyle,['sound_sync_only','talking_head_allowed'],'delivery');
 enums(p.paywall.pageModel,['Paid VIP','Free Page + PPV','Dual Funnel'],'page model');enums(p.paywall.customsSla,['24-48 Hours','48-72 Hours','5-7 Days'],'SLA');nums(p.paywall.maxCustomDurationMins,'custom duration');
 if(!Array.isArray(p.nicheCompetitors)||p.nicheCompetitors.some(c=>!c||c.platform!=='tiktok'||typeof c.handle!=='string'||!/^@?[\w.]+$/.test(c.handle)||typeof c.nicheFocus!=='string'))fail('Use TikTok handles for niche competitors');
 if(p.avatarUrl&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.avatarUrl))fail('Use an uploaded profile image');if(p.avatarUrl.length>700000)fail('Profile image is too large');
}
function direct(value,kind){const u=new URL(value);if(u.protocol!=='https:'||!['tiktok.com','www.tiktok.com'].includes(u.hostname)||u.username||u.password||u.port||!(kind==='video'?/^\/@[^/]+\/video\/\d+\/?$/:/^\/music\/[^/]+-\d+\/?$/).test(u.pathname))throw Error('Use the exact TikTok '+kind+' URL');return value}
function source(row){
 const r=clone(row);direct(r.originalVideoUrl,'video');direct(r.soundUrl,'sound');
 if(!/^@?[\w.]+$/.test(r.creatorHandle)||new URL(r.originalVideoUrl).pathname.split('/')[1].slice(1).toLowerCase()!==r.creatorHandle.replace(/^@/,'').toLowerCase())throw Error('Competitor handle must match the exact video URL');
 for(const k of ['creatorHandle','soundName','cameraDistance','physicalAction'])if(typeof r[k]!=='string'||!r[k].trim())throw Error('Missing '+k);
 for(const k of ['viewCount','medianViews'])if(!Number.isFinite(r[k])||r[k]<0)throw Error('Invalid '+k);
 if(!r.medianViews||r.viewCount/r.medianViews<1.8)throw Error('An outlier must reach at least 1.8× median views');
 if(!['unknown','sound_sync_only','talking_head_allowed'].includes(r.deliveryStyle))throw Error('Review delivery requirements');
 if(!['agency','niche'].includes(r.tier)||r.tier==='niche'&&!r.creatorId)throw Error('Choose a target creator for Tier 2');
 if(r.reviewed!==true&&r.demo!==true&&!['Public TikTok metadata','Demo fixture'].includes(r.provenance))throw Error('Unknown source provenance');return r;
}
function eligible(p,r){return p.status==='Active'&&(r.tier==='agency'?p.capabilities.includeAgencyBenchmarks:r.creatorId===p.id)&&!(r.deliveryStyle==='talking_head_allowed'&&p.capabilities.deliveryStyle==='sound_sync_only')}
function generate(p,row,id){validate(p);const r=source(row);if(!eligible(p,r))throw Error('Creator status, tier preference or capabilities exclude this source');
 const lens=p.archetype.primaryArchetype||'everyday style';return toDualBrief({id,creatorId:p.id,status:'queued',createdAt:Date.now(),demo:r.demo===true,reviewRequired:true,scrapedSource:{tier:r.tier,niche:r.niche||'universal',assignedModel:r.assignedModel||'',creatorId:r.creatorId,creatorHandle:r.creatorHandle,platform:'tiktok',originalVideoUrl:r.originalVideoUrl,soundUrl:r.soundUrl,soundName:r.soundName,viewCount:r.viewCount,medianOutlierMultiplier:r.viewCount/r.medianViews,provenance:r.provenance||'Human-reviewed input',caption:r.caption||'',mechanicsBasis:r.mechanicsBasis||'Reviewed reference'},bones:{cameraDistance:r.cameraDistance,cutTimestampSeconds:r.cutTimestampSeconds??null,physicalAction:r.physicalAction},skin:{wardrobe:p.archetype.signatureAesthetic||'Confirm outfit with creator',props:[],filmingLocation:p.archetype.filmingBackdrops[0]||'Confirm backdrop with creator'},angles:{mirror:{angleType:'mirror',label:'The Mirror',textHook:`${r.caption?.trim()?r.caption.trim().slice(0,100).replace(/#\S+/g,'').trim()+' — ':''}my ${lens.toLowerCase()} version.`,screenCaption:'Same timing, my own style.',objective:'Baseline reach'},commentTrap:{angleType:'comment_trap',label:'The Comment Trap',textHook:'Keep it simple or go all out?',screenCaption:'Which version would you choose — and why?',objective:'Conversation'},funnelDriver:{angleType:'funnel_driver',label:'The Funnel Driver',textHook:'This is only the first look.',screenCaption:'More from this shoot on my profile.',callToAction:'Visit my profile for more.',objective:'Profile visits'}}},r.platformTrends);
}
const SIGNAL={MIN_MULTIPLIER:2.5,SLEEPER_MAX_VIEWS:1000000,SATURATED_VIEWS:5000000,WINDOW_H:72};
function classifySignal(p){
  if(p.demo||p.fallback)return {light:'PURPLE',badge:'Preview',action:'DO NOT SHOOT',reason:'Demo or fallback data'};
  const m=Number(p.multiplier),v=Number(p.viewCount),pub=Date.parse(p.publishedAt);
  const ageH=Number.isFinite(p.ageHours)?p.ageHours:Number.isFinite(pub)?((p.now??Date.now())-pub)/36e5:null;
  if(!Number.isFinite(m)||!Number.isFinite(v)||m<SIGNAL.MIN_MULTIPLIER)return {light:'NONE',badge:'',action:'IGNORE',reason:'Under '+SIGNAL.MIN_MULTIPLIER+'x or no calculated multiplier',ageH};
  const reason=m.toFixed(1)+'x · '+(v>=1e6?(v/1e6).toFixed(1)+'M':Math.round(v/1e3)+'K')+' views'+(ageH===null?'':' · '+Math.round(ageH)+'h old');
  if(v>=SIGNAL.SATURATED_VIEWS||(ageH!==null&&ageH>SIGNAL.WINDOW_H))return {light:'RED',badge:'Apex',action:'SKIP',reason,ageH};
  if(v<SIGNAL.SLEEPER_MAX_VIEWS)return {light:'GREEN',badge:'Sleeper',action:'COPY NOW',reason,ageH};
  return {light:'YELLOW',badge:'Breakout',action:'FAST FOLLOW',reason,ageH};
}
function computeSleeperScore(b, radarMatches, realAgeH, totalClusterCount) {
  let score = 0;
  const reasons = [];

  // 1. Radar Cluster Match (+40 pts)
  if (radarMatches.length > 0) {
    score += 40;
    reasons.push('Morning Radar Audio Match (+40)');
  } else if (totalClusterCount > 1) {
    score += 25;
    reasons.push('Internal Sound Overlap (+25)');
  }

  // 2. Audio / Video Freshness (+25 pts)
  if (realAgeH !== null) {
    if (realAgeH <= 24) { score += 25; reasons.push('<24h Breakout (+25)'); }
    else if (realAgeH <= 48) { score += 20; reasons.push('<48h Fresh (+20)'); }
    else if (realAgeH <= 72) { score += 12; reasons.push('<72h Active (+12)'); }
    else { score += 0; reasons.push('Stale Audio (+0)'); }
  } else {
    score += 15;
  }

  // 3. High-GDP Audio Tag (+20 pts)
  const tier = (b.scrapedSource?.audienceTier || '').toLowerCase();
  const tag = (b.scrapedSource?.audienceTag || '').toLowerCase();
  const caption = (b.scrapedSource?.caption || '').toLowerCase();
  if (tier.includes('high gdp') || tier.includes('tier 1') || tag.includes('high gdp') || /\b(southern|country|gym|fitness|finance|tech|money|miami|nyc)\b/.test(caption)) {
    score += 20;
    reasons.push('High-GDP Audio Tag (+20)');
  } else {
    score += 10;
    reasons.push('General Mass FYP (+10)');
  }

  // 4. Hook Velocity / Optimal Duration (+15 pts)
  const dur = Number(b.scrapedSource?.duration || 0);
  if (dur >= 3 && dur <= 9) {
    score += 15;
    reasons.push('Optimal 4-8s Loop Length (+15)');
  } else if (dur > 9 && dur <= 16) {
    score += 10;
    reasons.push('Standard 10-15s Hook (+10)');
  } else {
    score += 5;
  }

  return { score: Math.min(100, Math.max(0, score)), reasons: reasons.join(' · ') };
}
function toDualBrief(b,trends){
 const s=b.scrapedSource||{}, keys=['mirror','commentTrap','funnelDriver'];
 const text=v=>String(v||'').replace(/[\r\n]+/g,' ').trim();
 const payload=b.briefPayload||{title:'Reference remix',variants:keys.map(k=>({caption:text(b.angles?.[k]?.screenCaption),onScreenText:text(b.angles?.[k]?.textHook)})),hashtags:(s.caption?.match(/#[\p{L}\p{N}_]+/gu)||[]).join(' ')};
 if(!b.briefPayload&&trends){
  const themes=Array.isArray(trends.activeThemes)?trends.activeThemes:[];
  if(themes.length){payload.title=themes[0]+' remix';payload.variants=payload.variants.map((v,i)=>({...v,onScreenText:themes[i%themes.length]+': '+v.onScreenText}));}
  payload.hashtags=[...new Set([...(payload.hashtags.match(/#[\p{L}\p{N}_]+/gu)||[]),...(trends.trendingHashtags||[])])].join(' ');
 }
 if(typeof payload.title!=='string'||!payload.title.trim()||!Array.isArray(payload.variants)||payload.variants.length!==3||payload.variants.some(v=>typeof v?.caption!=='string'||typeof v?.onScreenText!=='string')||typeof payload.hashtags!=='string')throw Error('A brief needs a title and exactly three caption/text variants');
 return {...b,scrapedSource:{...s,handle:s.creatorHandle||s.handle,videoUrl:s.originalVideoUrl||s.videoUrl,audioUrl:s.soundUrl||s.audioUrl||s.soundName||'Unavailable — check reference'},bones:{...b.bones,hookMatch:b.bones?.hookMatch||b.matchedFormula||'',instructions:b.bones?.instructions||'Shoot all 3 variants back to back, matching the original pacing and sound.'},briefPayload:payload,...(b.manualHijack?{badge:'🎯 Manual Hijack'}:{})};
}
function exportBrief(b){
 const d=toDualBrief(b),p=d.briefPayload,s=d.scrapedSource;
 direct(s.videoUrl,'video');
 if(/^https?:/.test(s.audioUrl))direct(s.audioUrl,'sound');
 return `#${b.demo?'Preview · ':''}${p.title}\nReference: ${s.videoUrl}\nSound: ${s.audioUrl}\n\nModel Creates 3 variants:\n${p.variants.map((v,i)=>`- Caption #${i+1}: ${v.caption}\n- On screen text variant ${i+1}: ${v.onScreenText}`).join('\n')}\n\nHashtags: ${p.hashtags}`;
}
function performancePost(row){
 const r=clone(row);direct(r.videoUrl,'video');
 if(typeof r.creatorId!=='string'||!r.creatorId||!['mirror','comment_trap','funnel_driver'].includes(r.angleType)||!Number.isFinite(r.views)||r.views<0||!Number.isFinite(r.followers)||r.followers<=0||!Number.isFinite(Date.parse(r.publishedAt))||!Number.isFinite(Date.parse(r.observedAt))||r.publishedAt>r.observedAt)throw Error('Invalid reviewed performance post');
 return r;
}
function performance(rows,id,angle){const posts=rows.filter(p=>p.creatorId===id&&p.angleType===angle).map(performancePost);return posts.length?{count:posts.length,ratio:posts.reduce((s,p)=>s+p.views/p.followers,0)/posts.length}:null}
function validateBrief(b){if(b?.briefPayload)toDualBrief(b);if(!b||typeof b.id!=='string'||typeof b.creatorId!=='string'||!['queued','filmed','approved','rejected'].includes(b.status))throw Error('Invalid trend brief');direct(b.scrapedSource.originalVideoUrl,'video');if(!(b.manualHijack===true&&b.scrapedSource.soundUrl===null))direct(b.scrapedSource.soundUrl,'sound');if(b.manualHijack===true){if(typeof b.instruction!=='string'||!b.instruction.trim()||b.instruction.length>100||/[\r\n]/.test(b.instruction)||!Number.isFinite(b.apexHijackScore)||b.apexHijackScore<0||b.apexHijackScore>100||typeof b.scoreBasis!=='string'||!(b.scrapedSource.medianOutlierMultiplier===null||Number.isFinite(b.scrapedSource.medianOutlierMultiplier)&&b.scrapedSource.medianOutlierMultiplier>=0))throw Error('Invalid manual feed card');}for(const v of [b.scrapedSource.creatorHandle,b.scrapedSource.soundName,b.bones.cameraDistance,b.bones.physicalAction,b.skin.wardrobe,b.skin.filmingLocation])if(typeof v!=='string')throw Error('Invalid brief text');if((b.bones.cutTimestampSeconds!==null&&(!Number.isFinite(b.bones.cutTimestampSeconds)||b.bones.cutTimestampSeconds<0))||!Array.isArray(b.skin.props)||b.skin.props.some(v=>typeof v!=='string'))throw Error('Invalid mechanics or props');for(const key of ['mirror','commentTrap','funnelDriver']){const a=b.angles[key];for(const k of ['label','textHook','screenCaption','objective'])if(typeof a?.[k]!=='string')throw Error('Missing brief angle')}}
root.LuxevaCreatorEngine=Object.freeze({archetypes,energy,slug,profile,validate,age,direct,source,eligible,generate,computeSleeperScore,classifySignal,SIGNAL,toDualBrief,exportBrief,validateBrief,performancePost,performance});
})(globalThis);
