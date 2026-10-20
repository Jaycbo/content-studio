/* Public metadata only. Pure analytics shared by the browser and local collector. */
(function(root){
'use strict';
function publicURL(value,post=false){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use a public HTTPS platform URL.');
 const h=u.hostname.replace(/^www\./,'');let platform;
 if(h==='tiktok.com')platform='TikTok';else if(h==='instagram.com')platform='IG';else if(h==='youtube.com')platform='YouTube';else if(['x.com','twitter.com'].includes(h))platform='X';else throw Error('Only public TikTok, Reels, Shorts and X URLs are supported.');
 if(post&&!({TikTok:/^\/@[^/]+\/video\/\d+\/?$/,IG:/^\/reels?\/[\w-]+\/?$/,YouTube:/^\/shorts\/[\w-]+\/?$/,X:/^\/\w+\/status\/\d+\/?$/}[platform].test(u.pathname)))throw Error('Use a direct public post URL.');
 return {platform,url:'https://'+(platform==='X'?'x.com':h)+u.pathname.replace(/\/$/,'')};
}
function count(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number')return Number.isFinite(v)&&v>=0?v:null;const m=String(v).replace(/,/g,'').trim().match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);return m?Number(m[1])*({K:1e3,M:1e6,B:1e9}[m[2]?.toUpperCase()]||1):null}
function date(v){const d=typeof v==='number'?new Date(v<1e12?v*1000:v):new Date(v);if(!v||!Number.isFinite(d.getTime()))throw Error('Each post needs a valid publication and collection date.');return d.toISOString()}
function normalize(row,source='local',observedAt=new Date().toISOString()){
 const link=publicURL(row.url||row.webVideoUrl||row.tweetUrl||row.videoUrl,true);
 const publishedAt=date(row.publishedAt||row.createTimeISO||row.createTime||row.timestamp||row.created_at||row.date);
 const captured=date(row.observedAt||observedAt);if(publishedAt>captured)throw Error('Publication date cannot follow collection date.');
 const views=count(row.views??row.playCount??row.videoViewCount??row.viewCount??row.stats?.playCount??row.public_metrics?.impression_count);
 return {...link,publishedAt,observedAt:captured,views,likes:count(row.likes??row.diggCount??row.likesCount??row.stats?.diggCount),caption:String(row.caption??row.text??row.desc??'').slice(0,3000),source};
}
class AnalyticsAdapter{constructor(source){if(!['local','apify','scrapebadger'].includes(source))throw Error('Unknown provider');this.source=source}parse(payload){const rows=Array.isArray(payload)?payload:payload.posts||payload.items||payload.data?.items||payload.data;if(!Array.isArray(rows)||rows.length>500)throw Error('Import an array of at most 500 public posts.');return rows.map(r=>normalize(r,this.source,payload.observedAt))}}
function merge(old,rows){const map=new Map(old.map(p=>[p.url,p]));for(const p of rows){if(!map.has(p.url)||map.get(p.url).observedAt<=p.observedAt)map.set(p.url,p)}return [...map.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,200)}
function median(xs){const a=[...xs].sort((a,b)=>a-b),n=a.length;return n?n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2:null}
function evaluate(post,catalog,now=Date.now()){
 const fail=reason=>({pass:false,reason});if(post.views===null)return fail('Views unavailable');
 if(Date.parse(post.observedAt)>now+300000)return fail('Collection timestamp is in the future');
 if(now-Date.parse(post.observedAt)>7*864e5)return fail('Refresh this snapshot (older than 7 days)');
 const prior=[...new Map(catalog.filter(p=>p.url!==post.url&&p.platform===post.platform&&p.publishedAt<post.publishedAt&&Date.parse(post.publishedAt)-Date.parse(p.publishedAt)<=90*864e5&&p.views!==null&&Date.parse(p.observedAt)<=now+300000&&now-Date.parse(p.observedAt)<=7*864e5).map(p=>[p.url,p])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,30);
 if(prior.length<5)return fail('Need at least 5 older posts from this platform');
 const baseline=median(prior.map(p=>p.views)),mad=median(prior.map(p=>Math.abs(p.views-baseline)));
 if(!baseline||!mad)return fail('Zero median or MAD: insufficient variation');
 const multiplier=post.views/baseline,z=.67448975*(post.views-baseline)/mad;
 return {pass:multiplier>=3&&z>=3,multiplier,z,baseline,mad,sampleSize:prior.length,reason:multiplier>=3&&z>=3?'Both thresholds passed':'Below dual threshold'};
}
function tags(post,bank){const text=post.caption.normalize('NFKC').replace(/[_\s]+/g,' ').toLowerCase();return bank.terms.filter(t=>['location','hook','format'].includes(t.category)&&[t.label,...t.aliases].some(a=>{const escaped=a.normalize('NFKC').replace(/[_\s]+/g,' ').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^a-z0-9])'+escaped+'([^a-z0-9]|$)','i').test(text)}))}
function recommend(post,catalog,model,bank,now){const metrics=evaluate(post,catalog,now);if(!metrics.pass)return null;const matched=tags(post,bank),rules=model.taxonomyRules||[],d=model.details||{};
 if(d.contentPubliccontent==='Not Allowed'||matched.some(t=>rules.some(r=>r.termId===t.id&&r.decision==='Not Allowed')))return null;
 const unresolved=matched.length<3||['location','hook','format'].some(c=>!matched.some(t=>t.category===c))||matched.some(t=>!rules.some(r=>r.termId===t.id&&r.decision==='Allowed'));
 // Free-text boundaries/capabilities cannot be verified with keyword matching.
 const needsReview=unresolved||!!(d.hardRules||d.voiceRestrictions||model.boundaryNotes||model.boundaries||d.abilities||d.resources)||d.contentPubliccontent!=='Allowed';
 const tone=(model.preferred_tones||model.personality||[]).slice(0,2).join(', ')||'conversational';const interest=(model.interests||[])[0]||'my everyday routine';
 const format=matched.find(t=>t.category==='format')?.label.toLowerCase()||'';
 const action=format.includes('grwm')?'Show three steps of a fully clothed getting-ready routine in one take.':format.includes('lip')?'Use the reference audio timing with an original, fully clothed gesture; confirm audio availability before filming.':format.includes('tutorial')?'Demonstrate one simple skill in a single take, with a clear before-and-after result.':'Tell one short, non-sensitive story in a single take and end with a question.';
 const hook=(model.personality||[]).some(v=>/funny|witty/i.test(v))?`I thought ${interest} would be easy. Here’s what actually happened.`:`Here’s one thing you might not know about ${interest}.`;
 return {post,metrics,termIds:matched.map(t=>t.id),title:matched.map(t=>t.label).join(' · ')||'Public trend adaptation',hook,action:`${model.name}: deliver the hook in a ${tone} voice. ${action} Use a non-identifying setting. Review the reference for pacing; do not copy its wording.`,alignment:needsReview?'Human boundary / capability review required':'Mapped rules aligned · human approval required',needsReview};
}
async function enrich({post,catalog,model,bank,enabled=false,provider,now}){const draft=recommend(post,catalog,model,bank,now);if(!draft||!enabled)return {draft,paid:false};if(draft.needsReview)return {draft,paid:false};if(typeof provider!=='function')throw Error('No enrichment provider configured');return {draft,paid:true,result:await provider({caption:post.caption.slice(0,1500),tags:draft.termIds,persona:(model.preferred_tones||[]).slice(0,5)})}}
root.LuxevaIntelligence=Object.freeze({publicURL,count,normalize,AnalyticsAdapter,merge,median,evaluate,tags,recommend,enrich});
})(globalThis);
