const studio='https://content-studio-pilot.blueslug16.chatgpt.site/studio/index.html';
let audio='';
(async()=>{
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)throw Error('Open a TikTok video first.');
  const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureTikTokReference});
  document.querySelector('#url').value=result?.url||'';
  document.querySelector('#caption').value=result?.caption||'';
  audio=result?.audio||'';
  document.querySelector('#status').textContent=result?.error||'Reference found. Check the link, then open the save screen.';
 }catch{document.querySelector('#status').textContent='This page cannot be read. Open a TikTok post or paste its full link.'}
})();
document.querySelector('#url').addEventListener('input',()=>{audio='';document.querySelector('#caption').value=''});
document.querySelector('#save').onsubmit=async e=>{
 e.preventDefault();const button=document.querySelector('#send');
 try{
  const u=new URL(document.querySelector('#url').value.trim());
  if(u.protocol!=='https:'||!['www.tiktok.com','tiktok.com','m.tiktok.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/@[A-Za-z0-9_.]+\/(video|photo)\/\d{10,25}\/?$/.test(u.pathname))throw Error('Use the full TikTok post link, not a shortened share link.');
  button.disabled=true;
  const data={url:'https://www.tiktok.com'+u.pathname,caption:document.querySelector('#caption').value.slice(0,1000),audio};
  await chrome.tabs.create({url:studio+'#capture='+encodeURIComponent(JSON.stringify(data))});
  document.querySelector('#status').textContent='Opened Content Studio. Confirm Save reference there to finish.';
 }catch(e){document.querySelector('#status').textContent=e.message}finally{button.disabled=false}
};
