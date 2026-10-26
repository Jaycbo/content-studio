import fs from 'node:fs';
export function readPlatformTrends(file=new URL('../public/studio/data/active-platform-trends.json',import.meta.url)) {
 try {const data=JSON.parse(fs.readFileSync(file,'utf8'));return Object.fromEntries(['activeThemes','trendingHashtags','trendingAudioVibes'].map(k=>[k,Array.isArray(data[k])?data[k].filter(v=>typeof v==='string').slice(0,20):[]]));}catch{return {activeThemes:[],trendingHashtags:[],trendingAudioVibes:[]};}
}
