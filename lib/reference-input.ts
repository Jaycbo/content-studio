export const RETENTION = 60*24*60*60*1000;
export const REASONS = ['', 'Hook', 'Audio', 'Action', 'Editing', 'Personality'];
export function canonicalVideo(value: unknown) {
 if(typeof value !== 'string' || value.length>2000) throw Error('Paste a full TikTok video link.');
 let u:URL; try{u=new URL(value)}catch{throw Error('Paste a full TikTok video link.')}
 if(u.protocol!=='https:' || !['www.tiktok.com','tiktok.com','m.tiktok.com'].includes(u.hostname) || u.username || u.password || u.port) throw Error('Use an https://www.tiktok.com video link.');
 const m=u.pathname.match(/^\/@([A-Za-z0-9_.]+)\/(video|photo)\/(\d{10,25})\/?$/);
 if(!m) throw Error('Open the individual TikTok post and copy its full link (not a shortened share link).');
 return {id:m[3],url:`https://www.tiktok.com/@${m[1]}/${m[2]}/${m[3]}`,creator:'@'+m[1]};
}
export function cleanText(value:unknown,max:number){return typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):''}
export function audioLink(value:unknown){if(!value)return '';try{const u=new URL(String(value));return u.protocol==='https:'&&u.hostname==='www.tiktok.com'&&/^\/music\/[^/]+$/.test(u.pathname)&&!u.port&&!u.username&&!u.password?u.origin+u.pathname:''}catch{return ''}}
