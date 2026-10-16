/* Explicit conflict handling around the local Phase 1 store. No credentials stored. */
(function(){
 let revision=null,busy=false,timer,again=false;
 const box=document.createElement('section');box.className='section-gap';box.innerHTML='<strong>Online workspace</strong><p id="online-status" role="status">Checking SQLite storage…</p><button class="subtle" id="online-load">Load online copy</button><button class="subtle" id="online-save">Save this copy online</button>';
 document.querySelector('.aside-bottom').prepend(box);
 const message=t=>document.querySelector('#online-status').textContent=t;
 async function request(method='GET',body){const response=await fetch('/api/workspace',{method,headers:method==='GET'?{}:{'Content-Type':'application/json','X-Luxeva-Request':'workspace'},...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{throw Error('Online storage did not return data. Sign in or retry; local data is retained.')}if(!response.ok){if(response.status===409)revision=null;throw Error(data.error||'Online storage is unavailable.')}return data}
 async function push(){
  if(revision===null||storageProblem)return;if(busy){again=true;return}
  busy=true;message('Saving to SQLite…');
  try{const snapshot=JSON.parse(workspaceStore.exportWorkspace(agency)).workspace;const result=await request('PUT',{revision,workspace:snapshot});revision=result.revision;message('Saved online in SQLite · local recovery copy retained.');}
  catch(error){revision=null;message(error.message)}finally{busy=false;if(again){again=false;window.queueWorkspaceSync()}}
 }
 window.queueWorkspaceSync=()=>{clearTimeout(timer);timer=setTimeout(push,500)};
 function apply(w){const next=preparePhase3(w);workspaceStore.restore(next);agency=next;state=agency.models.find(m=>m.id===agency.activeId);storageProblem=false;dirty=false;statusDirty=false;LuxevaTaxonomy.mirror(localStorage,agency);render()}
 document.querySelector('#online-load').onclick=async()=>{if(busy)return;if(!confirm('Replace this browser workspace with the online copy? Export local changes first if needed.'))return;try{const remote=await request();if(!remote.workspace){message('No online workspace exists yet. Save this copy online first.');return}apply(remote.workspace);revision=remote.revision;message('Online workspace loaded. Future saves sync automatically.')}catch(error){message(error.message)}};
 document.querySelector('#online-save').onclick=async()=>{if(busy||storageProblem)return;if(!confirm('Save this browser workspace online, replacing the current online copy? Other browser copies will not be merged.'))return;try{const remote=await request();revision=remote.revision;await push()}catch(error){message(error.message)}};
 async function start(){
  try{
   const before=JSON.stringify(agency),remote=await request();
   if(storageProblem){message('Recover local storage before connecting online.');return}
   if(before!==JSON.stringify(agency)||dirty||statusDirty){message('Local edits detected. Choose Load online copy or Save this copy online.');return}
   if(!remote.workspace){revision=0;await push();return}
   if(JSON.stringify(remote.workspace)===JSON.stringify(agency)){revision=remote.revision;message('Online SQLite workspace connected.');return}
   if(agency.models.length&&agency.models.every(m=>m.demo)){apply(remote.workspace);revision=remote.revision;message('Loaded your online workspace.');return}
   message('Local and online copies differ. Export a backup, then choose which copy to keep.');
  }catch(error){message(error.message)}
 }
 window.addEventListener('storage',e=>{if(e.key===LuxevaWorkspaceStore.KEY){revision=null;message('Another tab changed the local copy. Reconnect before saving online.')}});
 start();
})();
