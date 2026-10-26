import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {targetURL} from '../../lib/radar-ingestion.mjs';
const exec=promisify(execFile);
async function localCommand(env){
 const binary=env.YTDLP_PATH||'yt-dlp';let resolved=binary;
 if(!path.isAbsolute(binary)){for(const dir of (env.PATH||process.env.PATH||'').split(path.delimiter)){try{const candidate=path.join(dir,binary);await fs.access(candidate);resolved=candidate;break}catch{}}}
 try{const real=await fs.realpath(resolved),header=(await fs.readFile(real,'utf8')).split('\n')[0];const python=env.YTDLP_PYTHON||(header.startsWith('#!/')&&header.includes('python')?header.slice(2).trim():null);if(python)return {command:python,prefix:[fileURLToPath(new URL('./ytdlp-metadata.py',import.meta.url))]}}catch{/* A standalone binary still supports basic extraction. */}
 return {command:binary,prefix:[]};
}
export function normalizeYtdlp(raw){
 const rows=Array.isArray(raw.entries)?raw.entries:[raw],posts=[];
 for(const row of rows){if(!row)continue;try{const url=targetURL(row.webpage_url||row.original_url,true),id=url.split('/').pop(),handle=new URL(url).pathname.split('/')[1];
 if(!Number.isFinite(row.view_count)||!Number.isFinite(row.timestamp))continue;
 let soundUrl=null;for(const candidate of [row.music_url,row.track_url,...(row.description||'').matchAll(/https:\/\/(?:www\.)?tiktok\.com\/music\/[^\s]+/g)].map(x=>Array.isArray(x)?x[0]:x)){if(typeof candidate==='string'){try{const u=new URL(candidate);if(u.protocol==='https:'&&['www.tiktok.com','tiktok.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&/^\/music\/[^/]+-\d+\/?$/.test(u.pathname))soundUrl=candidate}catch{}}}
 posts.push({id,creatorHandle:handle,originalVideoUrl:url,soundUrl,soundName:row.track||'Original sound',viewCount:row.view_count,caption:String(row.description||row.title||'').slice(0,3000),publishedAt:new Date(row.timestamp*1000).toISOString()});
 }catch{/* Unusable metadata is omitted, never replaced with guessed counts. */}}
 return posts;
}
export function createScraperProvider(env=process.env,{execute=exec}={}){
 const name=env.SCRAPER_PROVIDER||'yt-dlp';
 if(name==='public')return null;
 if(name!=='yt-dlp')throw Error(name==='apify'?'Apify adapter is reserved for later. No paid request was made. Use SCRAPER_PROVIDER=yt-dlp for free local extraction.':'Unknown SCRAPER_PROVIDER. Use yt-dlp or public.');
 return {name,async collect(url){targetURL(url);try{const runner=await localCommand(env);const {stdout}=await execute(runner.command,[...runner.prefix,'--ignore-config','--skip-download','--dump-single-json','--no-warnings','--ignore-errors','--playlist-end','31','--socket-timeout','12','--retries','0','--extractor-retries','0','--',url],{timeout:45000,maxBuffer:8*1024*1024,windowsHide:true});return normalizeYtdlp(JSON.parse(stdout));}catch(error){if(error.stdout){try{const rows=normalizeYtdlp(JSON.parse(error.stdout));if(rows.length)return rows}catch{}}throw Error(error.code==='ENOENT'?'yt-dlp is not installed. Use the explicitly labeled demo fallback or install yt-dlp.':'yt-dlp could not extract this public page. TikTok may require access that this free collector does not use.')}}};
}
export function demoRadar(){const now=Date.now();return {scanned:7,errors:['DEMO FIXTURE — not scraped metrics. Links are demonstration placeholders. Nothing is saved to live queues.'],sources:[{id:'000000001',creatorHandle:'@luxeva_demo',originalVideoUrl:'https://www.tiktok.com/@luxeva_demo/video/000000001',soundUrl:'https://www.tiktok.com/music/Demo-sound-000000001',soundName:'Demo sound (fixture)',viewCount:45000,medianViews:10000,multiplier:4.5,sampleSize:6,caption:'Three ways to style one look — which one wins?',publishedAt:new Date(now).toISOString(),observedAt:new Date(now).toISOString(),cameraDistance:'DEMO: fixed waist-up framing',cutTimestampSeconds:2.4,physicalAction:'DEMO: turn toward camera, then reveal the second styling choice on the beat',deliveryStyle:'sound_sync_only',physicalIntensity:'static_chill_only',mechanicsBasis:'DEMO fixture — not observed video mechanics',tier:'agency',creatorId:'',provenance:'Demo fixture',demo:true,reviewed:false}]};}
