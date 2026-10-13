const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('extension/capture.js','utf8');
function capture({url='https://www.tiktok.com/@demo/video/1234567890123456789',root={},videos=[]}={}){
 const context={URL,location:new URL(url),innerWidth:1000,innerHeight:800,document:{body:root,querySelector:()=>root,querySelectorAll:()=>videos}};
 vm.createContext(context);vm.runInContext(source,context);return vm.runInContext('captureTikTokReference()',context);
}
const root={querySelector:q=>q.includes('music')?{href:'https://www.tiktok.com/music/example-123?tracking=1'}:{textContent:'A useful caption'}};
assert.equal(capture({root}).url,'https://www.tiktok.com/@demo/video/1234567890123456789');
assert.equal(capture({root}).caption,'A useful caption');assert.equal(capture({root}).audio,'https://www.tiktok.com/music/example-123');
assert(capture({url:'https://example.com',root}).error);
assert(capture({url:'https://www.tiktok.com/foryou',root}).error);
const parent={querySelectorAll:()=>[{href:'https://www.tiktok.com/@feed/video/1234567890123456790'}],querySelector:()=>null};
const video={parentElement:parent,getBoundingClientRect:()=>({top:0,left:0,bottom:700,right:400})};
assert.equal(capture({url:'https://www.tiktok.com/foryou',root,videos:[video]}).url,'https://www.tiktok.com/@feed/video/1234567890123456790');
assert(capture({url:'https://www.tiktok.com/foryou',root,videos:[video,video]}).error);
parent.querySelectorAll=()=>[{href:'https://www.tiktok.com/@feed/video/1234567890123456790'},{href:'https://www.tiktok.com/@feed/video/1234567890123456791'}];
assert(capture({url:'https://www.tiktok.com/foryou',root,videos:[video]}).error);
const manifest=JSON.parse(fs.readFileSync('extension/manifest.json'));assert.deepEqual(manifest.permissions,['activeTab','scripting']);assert.equal(manifest.host_permissions,undefined);assert.equal(manifest.background,undefined);
console.log('PASS: post extraction, optional text/audio, non-TikTok rejection, visible feed card selection, ambiguity fallback, minimal extension permissions.');
