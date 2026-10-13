// This self-contained function runs only after the user invokes the extension.
function captureTikTokReference() {
 const valid=(s)=>{try{const u=new URL(s,location.href);return u.protocol==='https:'&&['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(u.hostname)&&/^\/@[A-Za-z0-9_.]+\/(video|photo)\/\d{10,25}\/?$/.test(u.pathname)?u.origin+u.pathname:''}catch{return ''}};
 if(!['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(location.hostname))return {error:'Open TikTok or paste a full video link below.'};
 let url=valid(location.href),root=null;
 if(url){root=document.querySelector('[role="dialog"]')||document.querySelector('main')||document.body}
 else {
  // Only choose a feed card if its video is visible and its permalink is unambiguous.
  const visible=[...document.querySelectorAll('video')].map(v=>{const r=v.getBoundingClientRect();const area=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0))*Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0));return {v,area}}).filter(x=>x.area>0).sort((a,b)=>b.area-a.area);
  const candidate=visible[0];
  if(candidate&&(!visible[1]||candidate.area>visible[1].area*1.5)){
   let el=candidate.v.parentElement;
   for(let i=0;el&&i<8;i++,el=el.parentElement){const links=[...new Set([...el.querySelectorAll('a[href]')].map(a=>valid(a.href)).filter(Boolean))];if(links.length===1){url=links[0];root=el;break}if(links.length>1)break}
  }
 }
 if(!url)return {error:'Open the individual post, then click the extension again. You can also paste its full video link below.'};
 const caption=root?.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"]')?.textContent?.trim().slice(0,1000)||'';
 const audioElement=root?.querySelector('a[href*="/music/"]');
 let audio='';try{const u=new URL(audioElement?.href||'');if(u.protocol==='https:'&&u.hostname==='www.tiktok.com')audio=u.origin+u.pathname}catch{}
 return {url,caption,audio};
}
