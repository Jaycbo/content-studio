let latestPulse = null;
let synthesisRunning = false;
let synthesisError = '';
let pulseRevision = 0;
let pulseLoadPromise = null;

async function requestPulse(method) {
  const res = await fetch('/api/synthesis', {
    method,
    headers: { 'X-Luxeva-Request': 'radar' },
    cache: 'no-store',
    ...(method==='POST'&&typeof radarTargets==='function'?{body:JSON.stringify({targets:radarTargets()})}:{}),
  });
  if (method === 'GET' && res.status === 404) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Synthesis returned invalid JSON (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(data?.error || `Synthesis failed (HTTP ${res.status}).`);
  if (!data || !Array.isArray(data.benchmarkAudits) ||
      !Array.isArray(data.winningHookPatterns) ||
      !data.formatDistribution || typeof data.formatDistribution !== 'object') {
    throw new Error('Synthesis returned an incomplete playbook. Try running it again.');
  }
  return data;
}

function refreshPlaybook(open = false) {
  const mount = document.getElementById('radar-playbook-card') ||
    document.getElementById('radar-playbook-drawer');
  if (mount) {
    const wasOpen = mount.open;
    mount.outerHTML = renderMetaPlaybookHtml(latestPulse);
    const drawer = document.getElementById('radar-playbook-drawer');
    if (drawer) drawer.open = open || wasOpen;
  }
  wirePlaybookActions();
  if (typeof renderBenchmarkEditor === 'function') renderBenchmarkEditor();
}

function loadLatestPulse() {
  if (pulseLoadPromise) return pulseLoadPromise;
  const revision = pulseRevision;
  pulseLoadPromise = (async () => {
    try {
      const data = await requestPulse('GET');
      // A delayed page-load response must never replace a newer synthesis.
      if (revision !== pulseRevision) return;
      latestPulse = data;
      synthesisError = '';
    } catch (error) {
      if (revision !== pulseRevision) return;
      synthesisError = error.message;
    } finally {
      if (revision === pulseRevision) refreshPlaybook();
    }
  })();
  return pulseLoadPromise;
}

async function handleRunSynthesis() {
  if (synthesisRunning) return;
  synthesisRunning = true;
  synthesisError = '';
  pulseRevision++;
  wirePlaybookActions();
  try {
    latestPulse = await requestPulse('POST');
    refreshPlaybook(true);
    if(typeof loadRadarFeed==='function'&&typeof view!=='undefined'&&view==='radar')loadRadarFeed();
  } catch (error) {
    synthesisError = error.message;
  } finally {
    synthesisRunning = false;
    // Resolve the current DOM node: a successful response replaces the card.
    wirePlaybookActions();
  }
}

function wirePlaybookActions() {
  const btn = document.getElementById('run-synthesis-btn');
  if (btn) {
    btn.disabled = synthesisRunning;
    btn.textContent = synthesisRunning ? '⚡ Running Gemini...' : '⚡ Run Synthesis';
    btn.onclick = handleRunSynthesis;
  }
  const status = document.getElementById('synthesis-status');
  if (status) {
    status.textContent = synthesisError;
    status.hidden = !synthesisError;
  }
  document.querySelectorAll('.copy-hook-btn').forEach(b => {
    b.onclick = async () => {
      try {
        await navigator.clipboard.writeText(decodeURIComponent(b.dataset.hook));
        b.textContent = '✓ Copied!';
      } catch {
        b.textContent = 'Copy unavailable — select the formula below';
      }
      setTimeout(() => { b.textContent = 'Copy Formula'; }, 1500);
    };
  });
}

// This Studio is a static JS application; this is its initial-mount hook.
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { loadLatestPulse(); }, { once: true });
  } else {
    loadLatestPulse();
  }
}

function getTikTokAgeHours(url) {
  const match = String(url || '').match(/(\d{18,20})/);
  if (!match) return null;
  try {
    const epochSec = Number(BigInt(match[1]) >> 32n);
    if (!epochSec || epochSec < 1577836800) return null; // Sanity check (>= 2020)
    return Math.max(0, (Date.now() - (epochSec * 1000)) / 3600000);
  } catch {
    return null;
  }
}

/* Studio-native components: uses the existing shell, save boundary and gold theme. */
const CreatorEngine=LuxevaCreatorEngine;
const agencyBenchmarkHandles = ["faye.belincii", "minalatinaof", "aishah", "leximarvell", "jellybeanxooo", "realalinnarosee", "lelasohna", "isabela.ramirez31", "woesenpai69", "savaschulz", "sophieraiin"];

// --- Benchmark Competitor Management Engine ---
function sanitizeBenchmarkInput(val) {
  if (!val) return '';
  let s = String(val).trim();
  s = s.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '');
  s = s.split('?')[0].split('/')[0].replace(/^@/, '').toLowerCase().trim();
  return s;
}

function getActiveBenchmarkTargets() {
 let rows=agencyBenchmarkHandles;
 try{const saved=localStorage.getItem('agency_benchmarks_roster');if(saved&&Array.isArray(JSON.parse(saved)))rows=JSON.parse(saved);}catch{}
 return rows.map(row=>typeof row==='string'?{handle:'@'+row.replace(/^@/,''),tier:1,niche:'universal'}:{...row,handle:'@'+String(row.handle).replace(/^@/,''),tier:row.tier===2?2:1});
}
function getActiveBenchmarkHandles(){return getActiveBenchmarkTargets().map(t=>t.handle.slice(1));}
function saveActiveBenchmarkTargets(targets){
 try{localStorage.setItem('agency_benchmarks_roster',JSON.stringify(targets));}catch{alert('Could not save benchmarks. No removal or replacement was saved.');return false;}
 renderBenchmarkEditor();if(typeof view!=='undefined'&&view==='radar')loadRadarFeed();return true;
}
function saveActiveBenchmarkHandles(handles){const old=getActiveBenchmarkTargets();return saveActiveBenchmarkTargets(handles.map(handle=>old.find(t=>t.handle==='@'+handle)||{handle:'@'+handle,tier:1,niche:'universal'}));}
function addBenchmarkHandle(input){
 try{
  const handle=benchmarkReplacementHandle(input),current=getActiveBenchmarkTargets();
  if(current.some(t=>t.handle==='@'+handle))return;
  const tier=Number(document.getElementById('new-benchmark-tier')?.value||1);
  const niche=tier===1?'universal':document.getElementById('new-benchmark-niche')?.value.trim();
  const creatorId=tier===2?document.getElementById('new-benchmark-model')?.value:'';
  const model=typeof agency!=='undefined'?agency.models.find(m=>m.id===creatorId):null;
  if(tier===2&&(!niche||!model))throw Error('Choose a niche and assigned creator for Tier 2.');
  saveActiveBenchmarkTargets([...current,{handle:'@'+handle,tier,niche,...(tier===2?{creatorId,assignedModel:model.model.name}:{})}]);
 }catch(error){alert(error.message);}
}
function radarTargets(){
 const targets=getActiveBenchmarkTargets();
 if(typeof agency!=='undefined')for(const model of agency.models){const p=creatorProfileFor(model);for(const c of p.nicheCompetitors){if(!targets.some(t=>t.handle==='@'+c.handle.replace(/^@/,'')&&t.creatorId===p.id))targets.push({handle:c.handle,tier:2,niche:c.nicheFocus,creatorId:p.id,assignedModel:p.name});}}
 return targets.map(t=>({...t,creatorId:t.creatorId||(typeof agency!=='undefined'?agency.models.find(m=>m.model.name===t.assignedModel)?.id:'')||''}));
}
let radarFeedBriefs=[],radarFeedRevision=0;
async function loadRadarFeed(){
 const revision=++radarFeedRevision;
 try{
  const response=await fetch('/api/radar/feed',{method:'POST',headers:{'Content-Type':'application/json','X-Luxeva-Request':'radar'},body:JSON.stringify({targets:radarTargets()})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Feed unavailable');
  if(revision!==radarFeedRevision)return;
  radarFeedBriefs=result.briefs||[];
  if(typeof view!=='undefined'&&view==='radar'){const mount=document.getElementById('radar-results');if(mount)renderActiveQueueManager(mount,agency.models.map(m=>({record:m,p:creatorProfileFor(m)})));}
 }catch(error){const status=document.getElementById('radar-progress');if(status)status.textContent=error.message;}
}
function removeBenchmarkHandle(handle) {
  if (!confirm(`Remove @${handle} from your active benchmarks? This does not delete saved posts.`)) return;
  saveActiveBenchmarkHandles(getActiveBenchmarkHandles().filter(h => h !== handle));
}

// Notification payload is derived from the latest audit and current roster.
// Never mutate the roster merely because Gemini recommends DROP.
function getBenchmarkDropNotifications(pulse, handles) {
  const active = new Set(handles.map(h => String(h).replace(/^@/, '').toLowerCase()));
  const drops = new Map();
  for (const audit of Array.isArray(pulse?.benchmarkAudits) ? pulse.benchmarkAudits : []) {
    if (!audit || audit.action !== 'DROP' || typeof audit.handle !== 'string') continue;
    const handle = audit.handle.replace(/^@/, '').toLowerCase();
    if (!/^[\w.]+$/.test(handle) || !active.has(handle)) continue;
    drops.set(handle, {handle, reason: String(audit.reason || 'Review the latest synthesis audit.').replace(/DEMO(?: SAMPLE)?/g,'Preview'),
      replacement: String(audit.suggestedReplacement || ''), demo: audit.demo === true || pulse.demo === true});
  }
  return [...drops.values()];
}

function benchmarkReplacementHandle(input) {
  let value = String(input || '').trim();
  if (/^https?:/i.test(value)) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['www.tiktok.com','tiktok.com'].includes(url.hostname) ||
        url.port || url.username || url.password || !/^\/@[\w.]+\/?$/.test(url.pathname)) {
      throw Error('Paste a TikTok profile URL or an @handle.');
    }
    value = url.pathname.slice(2).replace(/\/$/, '');
  } else value = value.replace(/^@/, '');
  if (!/^[\w.]{1,24}$/.test(value)) throw Error('Enter a valid TikTok handle (letters, numbers, underscores or periods).');
  return value.toLowerCase();
}

function replaceFlaggedBenchmark(handle) {
  const drop = getBenchmarkDropNotifications(latestPulse, getActiveBenchmarkHandles()).find(d => d.handle === handle);
  if (!drop) return;
  const input = prompt(`${drop.demo ? 'Preview recommendation — not live performance.\n\n' : ''}@${handle}: ${drop.reason}\n\nPaste a replacement TikTok profile URL or @handle. Nothing changes until you confirm.`, drop.replacement);
  if (input === null) return;
  try {
    const replacement = benchmarkReplacementHandle(input);
    const current = getActiveBenchmarkHandles();
    if (!current.includes(handle)) throw Error('This benchmark is no longer active. Refresh the benchmark list.');
    if (current.includes(replacement)) throw Error('That handle is already in your benchmark list. Choose a different replacement.');
    if (!confirm(`Remove @${handle} and replace it with @${replacement}?\n\n${drop.demo ? 'This recommendation uses Preview data.\n' : ''}Saved posts will be kept. This changes only your benchmark targets.`)) return;
    saveActiveBenchmarkTargets(getActiveBenchmarkTargets().map(t=>t.handle==='@'+handle?{...t,handle:'@'+replacement}:t));
  } catch (error) {
    alert(error.message);
  }
}

function renderBenchmarkDropBanner(drops) {
  if (!drops.length) return '';
  return `<section id="benchmark-drop-alert" role="alert" aria-live="polite" style="border:2px solid #f87171;background:rgba(127,29,29,.3);border-radius:8px;padding:14px;margin-bottom:16px;color:#fecaca">
    <strong>⚠️ ${drops.length} Benchmark Model${drops.length === 1 ? '' : 's'} Flagged for Removal: ${drops.map(d => '@' + esc(d.handle)).join(', ')}</strong>
    <p style="margin:8px 0">Review Gemini’s recommendation. No benchmarks have been removed.${drops.some(d => d.demo) ? ' Preview recommendations use preview data, not live performance.' : ''}</p>
    <button type="button" id="manage-flagged-benchmarks" class="secondary">Manage Benchmarks</button>
  </section>`;
}

function resetBenchmarkHandles() {
  if(!confirm('Reset benchmark targets to defaults? Saved posts will be retained.'))return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('agency_benchmarks_roster');
    }
  } catch (e) {}
  if (typeof renderBenchmarkEditor === 'function') renderBenchmarkEditor();
}

const sharedCreatorTagPaths=['archetype.toneBadges','archetype.filmingBackdrops'];
function readCreatorTagLibrary(storage=localStorage){const raw=storage.getItem('luxeva_custom_tags');if(raw===null)return {};const library=JSON.parse(raw);if(!library||typeof library!=='object'||Array.isArray(library))throw Error('Invalid shared tag library');for(const key of sharedCreatorTagPaths)if(library[key]!==undefined&&(!Array.isArray(library[key])||library[key].length>100||library[key].some(v=>typeof v!=='string'||!v.trim()||v.length>100)))throw Error('Invalid shared tag library');return library}
function sharedCreatorTags(path){if(!sharedCreatorTagPaths.includes(path))return [];try{return readCreatorTagLibrary()[path]||[]}catch{return []}}
function rememberCreatorTag(path,value,storage=localStorage){if(!sharedCreatorTagPaths.includes(path))return;const v=value.trim();if(!v||v.length>100)throw Error('Custom tags must be 1–100 characters');const library=readCreatorTagLibrary(storage),tags=library[path]||[];if(tags.some(t=>t.toLowerCase()===v.toLowerCase()))return;if(tags.length>=100)throw Error('Shared tag library is limited to 100 tags per group');library[path]=[...tags,v];storage.setItem('luxeva_custom_tags',JSON.stringify(library))}
function archetypeGuide(value){return ({
 'Athletic / Gym Baddie':'High discipline, activewear, glute/waist hooks.',
 'Girl Next Door (GND)':'Approachable, oversized loungewear, bedroom eye-contact hooks.',
 'Glamour / High-Maintenance':'Nightlife, sleek dresses, blowout hair, luxury lifestyle.',
 'Clean Girl / Aesthetic Wellness':'Daylight, linen/Pilates sets, skincare/smoothie routines.',
 'Clean Girl / Wellness':'Daylight, linen/Pilates sets, skincare/smoothie routines.',
 'Sun-Kissed / Coastal Beach':'Swimwear, golden hour, beach transitions.',
 'Alt / Gamer / Subculture':'Edgy, neon lighting, anime/gaming aesthetic.',
 'Tomboy / Streetwear':'Relaxed streetwear, everyday confidence, casual styling.',
 'Classic / Sophisticated':'Polished tailoring, understated styling, composed delivery.',
 None:'No secondary vibe.'
 })[value]||(value?'Custom archetype: define its visual direction in Signature aesthetic.':'Choose an archetype to see its visual direction.')}

function creatorProfileFor(record){const p=CreatorEngine.profile(record.model,record.id);p.status=Ops.locked(record)||Ops.status(record)==='pending'?'Paused':'Active';return p}
function creatorField(p,path,label,options){const value=path.split('.').reduce((o,k)=>o[k],p);const name=esc(path);return `<label>${esc(label)}${Array.isArray(options)?`<select name="${name}">${[...new Set([...options,value])].map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(({sound_sync_only:'Sound-Sync Only',talking_head_allowed:'Talking Head Allowed',})[v]||v)}</option>`).join('')}</select>`:typeof value==='boolean'?`<input type="checkbox" name="${name}" ${value?'checked':''}>`:Array.isArray(value)?`<input name="${name}" value="${esc(value.join(', '))}" placeholder="Separate entries with commas">`:`<input name="${name}" type="${options|| (typeof value==='number'?'number':'text')}" ${typeof value==='number'?'min="0" step="any"':''} value="${esc(value)}">`}${['archetype.primaryArchetype','archetype.secondaryArchetype'].includes(path)?`<span class="help" data-archetype-help>${esc(archetypeGuide(value))}</span>`:''}</label>`}
function creatorChips(p,path,label,choices){const selected=path.split('.').reduce((o,k)=>o[k],p);return `<fieldset class="wide creator-chips" data-chips="${esc(path)}"><legend>${esc(label)}</legend><div class="tag-options">${[...new Set([...choices,...sharedCreatorTags(path),...selected])].map(v=>`<label class="chip"><input type="checkbox" name="${esc(path)}" value="${esc(v)}" ${selected.includes(v)?'checked':''}><span>${esc(v)}</span></label>`).join('')}</div><div class="bar"><input aria-label="Custom ${esc(label)}" data-custom placeholder="Add custom"><button type="button" class="secondary" data-chip-add>+ Add Custom</button></div></fieldset>`}
function creatorRadios(p,key,label,options){return `<fieldset class="creator-chips wide"><legend>${label}</legend><div class="tag-options">${Object.entries(options).map(([value,title])=>`<label class="chip"><input type="radio" name="capabilities.${key}" value="${value}" ${p.capabilities[key]===value?'checked':''}><span>${title}</span></label>`).join('')}</div></fieldset>`}
function nicheRow(c={handle:'',nicheFocus:''}){return `<div class="record niche-row"><label>TikTok handle<input data-handle value="${esc(c.handle)}" placeholder="@creator" required></label><label>Focus<input data-focus value="${esc(c.nicheFocus)}"></label><button type="button" data-remove-niche class="subtle">Remove</button></div>`}
function renderCreatorProfile(){
 const owner=state,p=creatorProfileFor(owner);p.status=Ops.locked(owner)?'Paused':p.status;
 const f=(path,label,options)=>creatorField(p,path,label,options),chips=(path,label,options)=>creatorChips(p,path,label,options);
 $('#content').innerHTML=`<form id="creator-profile"><div class="panel profile-banner">${avatar(owner.model,true)}<div>${f('status','Status',['Active','Paused'])}<h2>${esc(p.name)}</h2><p>Creator ID · <span id="creator-slug">${esc(p.slug||CreatorEngine.slug(p.name))}</span></p><p class="help">Four boxes. Changes save together when you choose Save profile.</p></div></div><div class="creator-grid">
 <section class="panel"><span class="eyebrow">BOX 01</span><h2>Identity, Terms & Comms</h2><div class="form-grid">${f('name','Working name')}${f('demographics.dob','Date of birth','date')}<output id="creator-age" role="status"></output>${f('demographics.heritage','Heritage')}${f('demographics.location','Location / timezone')}${f('demographics.languages','Languages')}${f('contract.startDate','Contract starts','date')}${f('contract.endDate','Contract ends','date')}${f('contract.autoRenew','Auto renew')}${f('contract.agencySplit','Agency split %')}${f('contract.creatorSplit','Creator split %')}${Object.keys(p.channels).map(k=>f('channels.'+k,({tiktok:'TikTok handle',instagram:'Instagram',twitter:'X / Twitter',telegramChannel:'Telegram channel',onlyFansVip:'VIP page',onlyFansFree:'Free page',emergencyContact:'Emergency WhatsApp / Telegram'})[k])).join('')}<label>Profile photo · 500 × 500<input id="creator-photo" type="file" accept="image/jpeg,image/png,image/webp"></label><button type="button" id="creator-remove-photo" class="subtle">Remove photo</button></div></section>
 <section class="panel"><span class="eyebrow">BOX 02</span><h2>Visual Archetype & Brand Lens</h2><div class="form-grid">${f('archetype.primaryArchetype','Primary archetype',['',...CreatorEngine.archetypes,'+ Custom Archetype'])}${f('archetype.secondaryArchetype','Secondary vibe',['None',...CreatorEngine.archetypes,'+ Custom Archetype'])}${f('archetype.energyPace','Energy & pace',CreatorEngine.energy)}${f('archetype.signatureAesthetic','Signature aesthetic')}${chips('archetype.toneBadges','Tone badges',['Playful & Teasing','Bold & Unapologetic','Bubbly','Sarcastic','Disciplined'])}${chips('archetype.filmingBackdrops','Filming backdrops',['Gym / Squat Rack','Car Interior','Bedroom Mirror','Kitchen Island'])}</div></section>
 <section class="panel"><h2>BOX 03 · Radar Targets & Ingestion Streams</h2><div class="form-grid">${creatorRadios(p,'deliveryStyle','Delivery capability',{sound_sync_only:'Sound-Sync Only',talking_head_allowed:'Talking Head Allowed'})}${f('capabilities.includeAgencyBenchmarks','Include Tier 1 Global Agency Benchmarks — apex pool (@jellybeanxooo, @savaschulz, @minalatinaof, +7 more)')}</div><h3>Tier 2 · Model niche competitors</h3><div id="niche-list">${p.nicheCompetitors.map(nicheRow).join('')}</div><button type="button" id="add-niche" class="secondary">+ Add competitor</button><p class="help">Macro benchmarks and niche competitors monitor viral outliers for automated 3-angle brief generation.</p></section>
 <section class="panel"><span class="eyebrow">BOX 04</span><h2>Revenue, Chatting & Paywall</h2><div class="form-grid">${f('paywall.pageModel','Page strategy',['Paid VIP','Free Page + PPV','Dual Funnel'])}${f('paywall.customsAllowed','Customs allowed')}${f('paywall.customsSla','Customs turnaround',['24-48 Hours','48-72 Hours','5-7 Days'])}${f('paywall.saysFanName','Says fan name')}${f('paywall.maxCustomDurationMins','Maximum custom duration (minutes)')}${f('paywall.bilingualChattingAllowed','Bilingual chatting allowed')}${f('paywall.textingQuirks','Texting quirks')}${chips('paywall.chatterPersonas','Chatter personas',['GFE / Affectionate','Playful & Bratty','Bold & Dominant','Submissive & Sweet','Sarcastic / Banter','Unfiltered / Direct'])}${chips('paywall.highTicketSpecialties','Specialties · Verbal / Aesthetic / Explicit',['Spanish Dirty Talk','English Dirty Talk','JOI','Audio ASMR','Gym / Spandex Teasing','Sweaty / Post-Workout','Oil / Shower','Lingerie Try-On','Micro-Bikini','Dildo / Toy Play','Squirting','Fingering / Close-ups'])}${chips('paywall.hardDealbreakers','Hard dealbreakers',['No Anal','No Face in Explicit Content','No Feet Content','No Humiliation / SPH','No Male Collabs','No Video Calls','No IRL Meetups'])}<label class="wide">Dealbreaker notes<textarea name="paywall.dealbreakerNotes">${esc(p.paywall.dealbreakerNotes)}</textarea></label></div></section></div><div class="save-bar"><span id="creator-save-status" role="status">Saved legacy information is retained.</span><button id="creator-save">Save profile</button></div></form>`;
 const form=$('#creator-profile');let photo=p.avatarUrl,uploading=false;const dobInput=form.elements['demographics.dob'];dobInput.max=new Date(Date.now()-18*365.25*24*60*60*1000).toISOString().split('T')[0];dobInput.required=true;for(const key of ['agencySplit','creatorSplit'])form.elements['contract.'+key].max='100';
 const ageUpdate=()=>{const input=form.elements['demographics.dob'],a=CreatorEngine.age(input.value);input.setCustomValidity(!input.value||!a||a.years<18?'Creator must be at least 18 years old.':'');$('#creator-age').classList.toggle('age-required',!a||a.years<18);$('#creator-age').textContent=a&&a.years>=18?`Age: ${a.years} yrs, ${a.months} mos (18+ Verified)`:'Required: Must verify 18+'};ageUpdate();
 form.oninput=e=>{if(e.target.name==='contract.agencySplit')form.elements['contract.creatorSplit'].value=100-Number(e.target.value);if(e.target.name==='contract.creatorSplit')form.elements['contract.agencySplit'].value=100-Number(e.target.value);$('#creator-slug').textContent=CreatorEngine.slug(form.elements.name.value);dirty=true;ageUpdate();$('#creator-save-status').textContent='Unsaved changes'};
 form.querySelectorAll('select[name^="archetype."]').forEach(select=>select.onchange=()=>{const help=select.parentElement.querySelector('[data-archetype-help]');if(help)help.textContent=archetypeGuide(select.value);if(select.value!=='+ Custom Archetype')return;const input=document.createElement('input');input.name=select.name;input.placeholder='Custom archetype';select.replaceWith(input);input.focus()});
 form.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-chip-add')){const box=b.closest('[data-chips]'),input=box.querySelector('[data-custom]'),v=input.value.trim();if(!v)return;const existing=[...box.querySelectorAll('input[type=checkbox]')].find(x=>x.value.toLowerCase()===v.toLowerCase());if(existing)existing.checked=true;else box.querySelector('.tag-options').insertAdjacentHTML('beforeend',`<label class="chip"><input type="checkbox" name="${esc(box.dataset.chips)}" value="${esc(v)}" checked><span>${esc(v)}</span></label>`);try{rememberCreatorTag(box.dataset.chips,v)}catch(error){notice('Selected for this profile, but not added to the shared library: '+error.message)}input.value='';dirty=true;$('#creator-save-status').textContent='Unsaved profile selection · custom tags shared in this browser'}if(b.hasAttribute('data-remove-niche')){b.closest('.niche-row').remove();dirty=true}};
 $('#add-niche').onclick=()=>{$('#niche-list').insertAdjacentHTML('beforeend',nicheRow());dirty=true};
 $('#creator-photo').onchange=async e=>{const file=e.target.files[0];if(!file)return;uploading=true;$('#creator-save').disabled=true;try{photo=await creatorPhoto(file);$('.profile-banner .avatar').innerHTML=`<img src="${photo}" alt="Profile preview">`;dirty=true;$('#creator-save-status').textContent='Photo ready. Save profile to keep it.'}catch(err){notice(err.message)}finally{uploading=false;$('#creator-save').disabled=false}};
 $('#creator-remove-photo').onclick=()=>{photo='';$('.profile-banner .avatar').textContent=p.name.slice(0,2);dirty=true};
 form.onsubmit=e=>{e.preventDefault();if(uploading)return;const data=new FormData(form),next=JSON.parse(JSON.stringify(p));for(const path of ['name','status',...['contract','demographics','channels','archetype','capabilities','paywall'].flatMap(g=>Object.keys(p[g]).map(k=>g+'.'+k))]){const keys=path.split('.'),key=keys.pop(),obj=keys.length?next[keys[0]]:next,old=obj[key];obj[key]=typeof old==='boolean'?data.has(path):typeof old==='number'?Number(data.get(path)):Array.isArray(old)?(form.querySelector(`[data-chips="${path}"]`)?data.getAll(path):String(data.get(path)||'').split(',').map(v=>v.trim()).filter(Boolean)):String(data.get(path)||'').trim()}
 next.slug=CreatorEngine.slug(next.name,agency.models.filter(r=>r.id!==owner.id).map(r=>r.model.creatorProfile?.slug||CreatorEngine.slug(r.model.name)));next.avatarUrl=photo;next.nicheCompetitors=[...form.querySelectorAll('.niche-row')].map(row=>({handle:row.querySelector('[data-handle]').value.trim(),nicheFocus:row.querySelector('[data-focus]').value.trim(),platform:'tiktok'}));
 try{CreatorEngine.validate(next);const before=owner.model,oldStatus=owner.status,oldArchived=owner.archived;if(next.status==='Active')owner.archived=false;owner.status=({Active:'active',Paused:'frozen',Offboarding:'cancelled'})[next.status];owner.model={...before,creatorProfile:next,name:next.name,photo,dateOfBirth:next.demographics.dob,homeLocation:next.demographics.location,nationality:next.demographics.heritage,languages:next.demographics.languages.join(', ')};if(!save()){owner.model=before;owner.status=oldStatus;owner.archived=oldArchived;return}dirty=false;render();notice('Complete four-box profile saved for '+next.name+'.')}catch(err){notice(err.message)}};
}
async function creatorPhoto(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Choose a JPG, PNG or WebP under 20 MB');const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=500;const ctx=canvas.getContext('2d'),side=Math.min(img.width,img.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,500,500);ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,500,500);return canvas.toDataURL('image/jpeg',.82)}finally{URL.revokeObjectURL(url)}}
function computeSleeperScore(b, radarMatches, realAgeH, totalClusterCount) {
 return CreatorEngine.computeSleeperScore(b, radarMatches, realAgeH, totalClusterCount);
}


function renderSynthesisControls() {
  return `<div><button id="run-synthesis-btn" type="button" class="secondary">⚡ Run Synthesis</button>
    <p id="synthesis-status" role="alert" style="color:#f87171;margin:6px 0 0" hidden></p></div>`;
}

function renderMetaPlaybookHtml(pulse) {
  if(pulse)pulse=JSON.parse(JSON.stringify(pulse).replace(/DEMO(?: SAMPLE)?|SAMPLE|Sample/g,'Preview'));
  if (!pulse || !pulse.benchmarkAudits) {
    return `
      <div id="radar-playbook-card" style="margin-top:12px;padding:12px 14px;background:rgba(255,255,255,0.03);border:1px dashed #374151;border-radius:8px;font-size:0.82rem;color:#9ca3af;display:flex;align-items:center;justify-content:space-between">
        <span>🧠 <strong>Radar Meta Playbook:</strong> No recent synthesis data found.</span>
        ${renderSynthesisControls()}
      </div>
    `;
  }

  const { formatDistribution: f, benchmarkAudits: audits, winningHookPatterns: hooks } = pulse;

  const drops = audits.filter(a => a && a.action === 'DROP');
  const promotes = audits.filter(a => a && a.action === 'PROMOTE');

  const dropHtml = drops.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:6px;padding:6px 10px;margin-bottom:6px">
      <div>
        <span style="color:#f87171;font-weight:600">❌ Drop ${esc(String(d.handle ?? ''))}</span>
        <span style="color:#d1d5db;font-size:0.75rem;margin-left:6px">${esc(String(d.reason ?? ''))}</span>
      </div>
      ${d.suggestedReplacement ? `<span style="font-size:0.72rem;background:#1f2937;color:#9ca3af;padding:2px 6px;border-radius:4px">Swap: ${esc(String(d.suggestedReplacement ?? ''))}</span>` : ''}
    </div>
  `).join('');

  const promoteHtml = promotes.map(p => `
    <span style="display:inline-flex;align-items:center;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:4px;padding:2px 8px;font-size:0.75rem;color:#34d399;margin-right:6px;margin-bottom:4px">
      🔥 ${esc(String(p.handle ?? ''))} · ${esc(String(p.reason ?? '').slice(0, 38))}...
    </span>
  `).join('');

  const hookList = hooks.filter(Boolean).map((h, i) => `
    <div style="background:#111827;border:1px solid #1f2937;border-radius:6px;padding:8px 10px;margin-top:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <strong style="color:#e5e7eb;font-size:0.78rem">${i+1}. ${esc(String(h.angle ?? ''))} (~${esc(String(h.estimatedSharePct ?? ''))}% of Outliers)</strong>
        <button type="button" class="copy-hook-btn" data-hook="${encodeURIComponent(h.formula ?? '')}" style="padding:2px 6px;font-size:0.7rem;background:#374151;color:#d1d5db;border:none;border-radius:4px;cursor:pointer">Copy Formula</button>
      </div>
      <div style="font-family:monospace;font-size:0.75rem;color:#93c5fd;background:rgba(59,130,246,0.08);padding:4px 6px;border-radius:4px">"${esc(String(h.formula ?? ''))}"</div>
      <div style="font-size:0.72rem;color:#9ca3af;margin-top:4px"><em>Example: "${esc(String(h.example ?? ''))}"</em></div>
    </div>
  `).join('');

  return `
    <details id="radar-playbook-drawer" style="margin-top:12px;background:rgba(17,24,39,0.7);border:1px solid #1f2937;border-radius:8px;padding:10px 14px;font-size:0.82rem">
      <summary style="cursor:pointer;font-weight:600;color:#f3f4f6;display:flex;align-items:center;justify-content:space-between;user-select:none">
        <span>🧠 Radar Intelligence Playbook & Winning Hooks</span>
        <span style="font-size:0.72rem;color:#10b981;background:rgba(16,185,129,0.1);padding:2px 8px;border-radius:10px">Synthesized via Gemini</span>
      </summary>

      <div style="margin-top:12px;border-top:1px solid #1f2937;padding-top:10px">
        ${renderSynthesisControls()}
        <!-- Formats -->
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;font-size:0.75rem;color:#9ca3af">
          <strong style="color:#d1d5db">Format Split:</strong>
          <span style="background:#1f2937;padding:2px 6px;border-radius:4px">💬 Lip-Sync + Text: ${esc(String(f.lipSyncTextPct ?? ''))}%</span>
          <span style="background:#1f2937;padding:2px 6px;border-radius:4px">⚡ Micro-Dance: ${esc(String(f.microDancePct ?? ''))}%</span>
          <span style="background:#1f2937;padding:2px 6px;border-radius:4px">✨ Aesthetic Loops: ${esc(String(f.aestheticLoopPct ?? ''))}%</span>
          <span style="background:#1f2937;padding:2px 6px;border-radius:4px">🗣️ Talking Head: ${esc(String(f.talkingHeadPct ?? ''))}%</span>
        </div>

        <!-- Hygiene -->
        <div style="margin-bottom:12px">
          <strong style="color:#d1d5db;display:block;margin-bottom:6px">Surveillance Hygiene & Recommendations:</strong>
          ${dropHtml || '<div style="color:#9ca3af;font-size:0.75rem">No cold benchmark candidates flagged for removal.</div>'}
          ${promoteHtml ? `<div style="margin-top:6px">${promoteHtml}</div>` : ''}
        </div>

        <!-- Hooks -->
        <div>
          <strong style="color:#d1d5db;display:block;margin-bottom:4px">Winning Hook Templates (Click to Copy):</strong>
          ${hookList}
        </div>
      </div>
    </details>
  `;
}

function renderRadarTelemetryHtml() {
  const sources = (typeof agency !== 'undefined' && agency && Array.isArray(agency.radarSources)) ? agency.radarSources : [];
  if (!sources.length) {
    return `<div id="radar-telemetry" style="margin-top:4px;font-size:0.82rem;line-height:1.4"><span style="color:#9ca3af">⚪ Standby · Surveillance pool ready · Scheduled daily at 6:30 AM</span></div>`;
  }

  let latestTime = 0;
  for (const s of sources) {
    const t = s.observedAt ? new Date(s.observedAt).getTime() : 0;
    if (t > latestTime) latestTime = t;
  }

  const now = Date.now();
  const diffMs = latestTime > 0 ? (now - latestTime) : 0;
  const diffHours = diffMs / (1000 * 60 * 60);

  let timeStr = 'Just now';
  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    timeStr = `${days}d ago`;
  } else if (diffHours >= 1) {
    const hrs = Math.floor(diffHours);
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    timeStr = mins > 0 ? `${hrs}h ${mins}m ago` : `${hrs}h ago`;
  } else if (diffMs > 60000) {
    timeStr = `${Math.floor(diffMs / 60000)}m ago`;
  }

  const recentSweep = sources.filter(s => {
    if (!latestTime || !s.observedAt) return true;
    return (latestTime - new Date(s.observedAt).getTime()) <= (2 * 60 * 60 * 1000);
  });

  const creatorMap = new Map();
  for (const s of recentSweep) {
    const handle = (s.creatorHandle || s.handle || '').replace(/^@/, '');
    const mult = Number(s.medianOutlierMultiplier || s.multiplier || s.outlierMultiplier || 1);
    if (handle) {
      if (!creatorMap.has(handle) || mult > creatorMap.get(handle)) {
        creatorMap.set(handle, mult);
      }
    }
  }

  const escapeFn = typeof esc === 'function' ? esc : (s => String(s ?? ''));
  const topCreators = Array.from(creatorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h, m]) => `@${escapeFn(h)} (${m.toFixed(1)}×)`);

  const isStale = diffHours >= 24;
  const statusDot = isStale ? '⚠️' : '🟢';
  const statusColor = isStale ? '#fca5a5' : '#6ee7b7';

  const line1 = `<span style="color:${statusColor}">${statusDot} <strong>Last sweep:</strong> ${timeStr} · ${recentSweep.length} outlier${recentSweep.length === 1 ? '' : 's'}</span>`;
  const breakouts = topCreators.length ? `<span style="color:#d1d5db;margin-left:8px">| 📈 <strong>Top breakouts:</strong> ${topCreators.join(' · ')}</span>` : '';
  const line2 = `<div style="font-size:0.75rem;color:#9ca3af;margin-top:2px">Saved metadata · ${sources.length} active outliers indexed</div>`;

  return `<div id="radar-telemetry" style="margin-top:4px;font-size:0.82rem;line-height:1.4"><div>${line1}${breakouts}</div>${line2}</div>`;
}

function signalOfBrief(b, ageH) {
  const age = ageH === undefined ? getTikTokAgeHours(b.scrapedSource?.originalVideoUrl) : ageH;
  return CreatorEngine.classifySignal({multiplier: b.scrapedSource?.medianOutlierMultiplier, viewCount: b.scrapedSource?.viewCount, ageHours: age, demo: b.demo === true});
}
function TrendJackingBriefCard(b,name){
  const dual=CreatorEngine.toDualBrief(b);
  const realAgeH = typeof getTikTokAgeHours === 'function' ? getTikTokAgeHours(b.scrapedSource.originalVideoUrl) : null;
  let ageBadge = '';
  if (realAgeH !== null) {
    if (realAgeH < 24) ageBadge = `<span class="badge" style="background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3)">🔥 Rising · ${Math.round(realAgeH)}h ago</span>`;
    else if (realAgeH <= 72) ageBadge = `<span class="badge" style="background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3)">📈 Active · ${Math.round(realAgeH/24)}d ago</span>`;
    else ageBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3)">❌ Stale · ${Math.round(realAgeH/24)}d ago</span>`;
  }
  if(b.demo)ageBadge=b.scrapedSource.multiplierBasis==='demo'?'':'<span class="badge">Preview</span>';
  if(b.manualHijack)ageBadge=`<span class="badge" style="background:rgba(184,156,100,.15);color:#dbc18d;border:1px solid rgba(184,156,100,.4)">🎯 Manual Hijack${b.demo?' · Preview':''}</span>`;
  const models = (typeof agency !== 'undefined' && agency && Array.isArray(agency.models)) ? agency.models : [];
  const soundUsage = models.flatMap(m => m.trendBriefs || []).filter(x => x.scrapedSource?.soundName && x.scrapedSource?.soundName === b.scrapedSource?.soundName).length;
  
  // Cross-reference against morning Radar sweep cache
  const radarSources = (typeof agency !== 'undefined' && agency && Array.isArray(agency.radarSources)) ? agency.radarSources : [];
  const sName = (b.scrapedSource?.soundName || b.scrapedSource?.track || '').trim().toLowerCase();
  const sUrl = (b.scrapedSource?.soundUrl || '').trim();
  const radarMatches = radarSources.filter(s => {
    if (!s || s.originalVideoUrl === b.scrapedSource?.originalVideoUrl) return false;
    const matchName = (s.soundName || s.track || '').trim().toLowerCase();
    const matchUrl = (s.soundUrl || '').trim();
    return (sName && matchName && sName === matchName) || (sUrl && matchUrl && sUrl === matchUrl);
  });
  
  const totalClusters = soundUsage + radarMatches.length;
  let clusterBadge = '';
  if (radarMatches.length > 0) {
    clusterBadge = `<span class="badge" style="background:rgba(168,85,247,0.25);color:#e9d5ff;border:1px solid rgba(168,85,247,0.45);font-weight:600">🎵 Radar Cluster Match (${totalClusters})</span>`;
  } else if (soundUsage > 1) {
    clusterBadge = `<span class="badge" style="background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.3)">🎵 Sound Cluster (${soundUsage})</span>`;
  }

  // Sleeper Hijack Score for early FYP front-running
  const { score, reasons } = computeSleeperScore(b, radarMatches, realAgeH, totalClusters);
  // Enrich the temporary manual result with the same roster context as feed cards.
  if(b.manualHijack){b.apexHijackScore=score;b.scoreBasis=(b.demo?'Preview metadata heuristic. ':'Metadata and local roster heuristic. ')+reasons;}
  const sig = signalOfBrief(b, realAgeH);
  const sigStyle = {GREEN: ['16,185,129', '#6ee7b7', '🟢 Sleeper · COPY NOW'], YELLOW: ['245,158,11', '#fbbf24', '🟡 Breakout · FAST FOLLOW'], RED: ['239,68,68', '#fca5a5', '🔴 Apex · SKIP, saturated'], PURPLE: ['168,85,247', '#e9d5ff', '🟣 Preview · do not shoot']}[sig.light];
  const sleeperBadge = sigStyle ? '<span class="badge" title="' + esc(sig.reason + ' · ' + reasons) + '" style="background:rgba(' + sigStyle[0] + ',0.2);color:' + sigStyle[1] + ';border:1px solid rgba(' + sigStyle[0] + ',0.45);font-weight:600">' + sigStyle[2] + '</span>' : '';
  return `<article class="panel trend-card" data-trend-id="${esc(b.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;margin:6px 0;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:8px;transition:opacity 0.3s"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-width:0;flex:1"><input type="checkbox" data-select-brief="${esc(b.id)}" ${b.manualHijack?'disabled title="Manual preview is separate from batch dispatch"':''} style="cursor:pointer;width:16px;height:16px;margin:0;accent-color:#6366f1;flex-shrink:0"><strong style="font-size:0.95rem">${esc(b.scrapedSource.creatorHandle)}</strong><span class="badge" style="font-size:0.75rem;padding:2px 6px">${b.scrapedSource.medianOutlierMultiplier===null?'Multiplier unavailable':Number(b.scrapedSource.medianOutlierMultiplier).toFixed(1)+'× '+(b.scrapedSource.multiplierBasis==='demo'?'Preview':'Outlier')}</span>${ageBadge}${clusterBadge}${sleeperBadge}<a href="${esc(CreatorEngine.direct(b.scrapedSource.originalVideoUrl,'video'))}" target="_blank" rel="noopener noreferrer" style="font-size:0.85rem">↗ Video</a>${b.scrapedSource.soundUrl?`<a href="${esc(CreatorEngine.direct(b.scrapedSource.soundUrl,'sound'))}" target="_blank" rel="noopener noreferrer" style="font-size:0.85rem">♫ Sound: ${esc(b.scrapedSource.soundName.replace(/DEMO|Sample|SAMPLE/g,'Preview'))}</a>`:'<span class="meta">♫ Sound unavailable</span>'}<span class="meta" style="margin:0;font-size:0.8rem;opacity:0.6">Instructions: ${esc(dual.bones.instructions)}</span>${b.manualHijack&&b.pulseDemo?'<span class="badge">Preview pulse</span>':''}${b.manualHijack&&b.engine==='local-fallback'?'<span class="badge">Local template</span>':''}</div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0"><button data-copy-trend style="margin:0;padding:6px 14px;font-size:0.85rem;white-space:nowrap">📋 Copy Brief</button><span data-copy-status role="status" style="font-size:0.85rem"></span></div><textarea data-copy-fallback hidden readonly aria-label="Brief text to copy manually"></textarea></article>`;
}
function wireTrendCards(container,briefs,name){
 container.querySelectorAll('[data-trend-id]').forEach(card=>{
  const b=briefs.find(x=>x.id===card.dataset.trendId);if(!b)return;
  card.querySelector('[data-copy-trend]').onclick=async()=>{
   const text=CreatorEngine.exportBrief(b,name),status=card.querySelector('[data-copy-status]');
   try{await navigator.clipboard.writeText(text);status.textContent=' Copied ✓';}
   catch{const fallback=card.querySelector('[data-copy-fallback]');fallback.hidden=false;fallback.value=text;fallback.focus();fallback.select();status.textContent=' Clipboard unavailable. Copy the selected text with ⌘C / Ctrl+C.'}
  };
 });
}
function renderTrendQueue(){const briefs=state.trendBriefs||[],box=document.createElement('section');box.className='section-gap';box.innerHTML=`<h2>3-Angle Trend Briefs</h2><p class="help">Review source mechanics, creator boundaries, outfit and wording before filming.</p>${briefs.map(b=>TrendJackingBriefCard(b,state.model.name)).join('')||'<p class="empty">No trend briefs yet. Run a scan or ingest a URL in Agency Radar.</p>'}`;$('#content').prepend(box);wireTrendCards(box,briefs,state.model.name)}


function runStorageGarbageCollector() {
  if (typeof agency === 'undefined' || !agency) return;
  let changed = false;
  if (Array.isArray(agency.radarSources)) {
    const initialLen = agency.radarSources.length;
    agency.radarSources = agency.radarSources.filter(r => {
      const ageH = typeof getTikTokAgeHours === 'function' ? getTikTokAgeHours(r.originalVideoUrl) : null;
      return ageH === null || ageH <= 72;
    }).slice(-50);
    if (agency.radarSources.length !== initialLen) changed = true;
  }
  if (Array.isArray(agency.models)) {
    for (const model of agency.models) {
      if (!Array.isArray(model.trendBriefs)) continue;
      const initialLen = model.trendBriefs.length;
      const freshQueued = [];
      const recentFilmed = [];
      for (const b of model.trendBriefs) {
        if (b.status === 'queued') {
          const ageH = typeof getTikTokAgeHours === 'function' ? getTikTokAgeHours(b.scrapedSource?.originalVideoUrl) : null;
          if (ageH === null || ageH <= 72) freshQueued.push(b);
        } else if (b.status === 'filmed' || b.status === 'rejected') {
          recentFilmed.push(b);
        }
      }
      model.trendBriefs = [...freshQueued, ...recentFilmed.slice(-20)];
      if (model.trendBriefs.length !== initialLen) changed = true;
    }
  }
  if (changed && typeof save === 'function') save();
}

function renderActiveQueueManager(targetEl, profiles) {
  let searchTerm = '', minMultiplier = 0, sortBy = 'velocity', freshOnly = false, selectedTier = 1;

  function getPending() {
    const list = [];
    for (const {record, p} of profiles) {
      for (const b of (record.trendBriefs || [])) {
        if (b.status === 'queued') list.push({b, p, record});
      }
    }
    const targets=radarTargets();
    const active=list.filter(({b})=>targets.some(t=>t.handle.replace(/^@/,'')===b.scrapedSource.creatorHandle.replace(/^@/,'')));
    for(const b of radarFeedBriefs){if(b.status!=='queued')continue;if(!active.some(x=>x.b.scrapedSource.originalVideoUrl===b.scrapedSource.originalVideoUrl&&x.b.scrapedSource.tier===b.scrapedSource.tier))active.push({b,p:{name:b.scrapedSource.assignedModel||'Agency'},record:{trendBriefs:[b]}});}
    return active;
  }

  function render() {
    const all = getPending();
    if (!all.length) {
      targetEl.innerHTML = '<p class="empty" style="padding:1.5rem 0;">🎉 Active queue is clear! All trends dispatched or pruned.</p>';
      return;
    }

    // 1. Filter
    let filtered = all.filter(({b}) => {
      if((b.scrapedSource.tier==='niche'||b.scrapedSource.tier===2?2:1)!==selectedTier)return false;
      const mult = Number(b.scrapedSource.medianOutlierMultiplier) || 0;
      if (mult < minMultiplier) return false;
      const ageH = getTikTokAgeHours(b.scrapedSource.originalVideoUrl);
      // Active queue: Green and Yellow signals only.
      const light = signalOfBrief(b, ageH).light;
      if (!['GREEN', 'YELLOW'].includes(light)) return false;
      if (freshOnly && ageH !== null && ageH > 72) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const handle = (b.scrapedSource.creatorHandle || '').toLowerCase();
        const sound = (b.scrapedSource.soundName || '').toLowerCase();
        const cap = (b.scrapedSource.caption || '').toLowerCase();
        if (!handle.includes(term) && !sound.includes(term) && !cap.includes(term)) return false;
      }
      return true;
    });

    // 2. Velocity Score Sort
    if (sortBy === 'velocity') {
      const rank = {GREEN: 0, YELLOW: 1, NONE: 2, RED: 3, PURPLE: 4};
      const key = ({b}) => { const ageH = getTikTokAgeHours(b.scrapedSource.originalVideoUrl); return {rank: rank[signalOfBrief(b, ageH).light], vph: (Number(b.scrapedSource.viewCount) || 0) / Math.max(ageH ?? 999, 1)}; };
      filtered.sort((x, y) => { const a = key(x), c = key(y); return a.rank - c.rank || c.vph - a.vph; });
    } else if (sortBy === 'highest') {
      filtered.sort((x, y) => (y.b.scrapedSource.medianOutlierMultiplier || 0) - (x.b.scrapedSource.medianOutlierMultiplier || 0));
    }

    const staleCount = all.filter(({b}) => {
      const a = getTikTokAgeHours(b.scrapedSource.originalVideoUrl);
      return a !== null && a > 72;
    }).length;

    targetEl.innerHTML = `
      <div class="bar" aria-label="Feed tier"><button data-feed-tier="1" class="${selectedTier===1?'':'secondary'}">Tier 1: Universal Concepts</button><button data-feed-tier="2" class="${selectedTier===2?'':'secondary'}">Tier 2: Niche Specific</button></div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:260px">
            <input id="queue-search" type="search" placeholder="Search handle, sound, caption…" value="${esc(searchTerm)}" style="margin:0;padding:6px 12px;font-size:0.85rem;flex:1;border-radius:6px">
            <select id="queue-filter-mult" style="margin:0;padding:6px 10px;font-size:0.85rem;border-radius:6px">
              <option value="0" ${minMultiplier===0?'selected':''}>All Multipliers</option>
              <option value="2" ${minMultiplier===2?'selected':''}>≥ 2.0×</option>
              <option value="3" ${minMultiplier===3?'selected':''}>≥ 3.0× High</option>
            </select>
            <select id="queue-sort" style="margin:0;padding:6px 10px;font-size:0.85rem;border-radius:6px">
              <option value="velocity" ${sortBy==='velocity'?'selected':''}>⚡ Highest Velocity First</option>
              <option value="highest" ${sortBy==='highest'?'selected':''}>Highest Multiplier</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button id="toggle-fresh" class="secondary" style="margin:0;padding:5px 10px;font-size:0.8rem;background:${freshOnly?'rgba(99,102,241,0.2)':'transparent'};border-color:${freshOnly?'#6366f1':'rgba(255,255,255,0.2)'}">
              ${freshOnly ? `🔥 Fresh Only (≤72h)` : `🌐 Showing All (${staleCount} Stale)`}
            </button>
            <span style="font-size:0.85rem;opacity:0.75;font-weight:500;">${filtered.length} visible</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:10px">
            <button id="quick-select-top3" class="secondary" style="margin:0;padding:4px 10px;font-size:0.8rem;border-radius:4px">⚡ Select Top 3 Rising</button>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;margin:0">
              <input id="queue-select-all" type="checkbox" style="margin:0;width:15px;height:15px;accent-color:#6366f1">
              <span>Select All Visible (<span id="queue-selected-count">0</span>)</span>
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button id="batch-copy-clear" style="margin:0;padding:6px 16px;font-size:0.85rem;font-weight:600;background:#4f46e5;color:#fff;border-radius:6px">📋 Copy Selected (<span id="btn-count">0</span>)</button>
            <button id="batch-dismiss" class="subtle" style="margin:0;padding:6px 12px;font-size:0.85rem;color:#f87171">🗑 Dismiss</button>
          </div>
        </div>
      </div>
      <div id="queue-cards-wrap">
        ${filtered.map(({b, p}) => TrendJackingBriefCard(b, p.name)).join('')||'<p class="empty">No outliers match this tier and filter. Add assigned Tier 2 targets in benchmark settings, then scan.</p>'}
      </div>
    `;

    for (const {record, p} of all) {
      wireTrendCards(targetEl.querySelector('#queue-cards-wrap'), record.trendBriefs || [], p.name);
    }

    targetEl.querySelectorAll('[data-feed-tier]').forEach(button=>button.onclick=()=>{selectedTier=Number(button.dataset.feedTier);render();});
    // Input bindings
    targetEl.querySelector('#queue-search').oninput = e => { searchTerm = e.target.value; render(); };
    targetEl.querySelector('#queue-filter-mult').onchange = e => { minMultiplier = Number(e.target.value); render(); };
    targetEl.querySelector('#queue-sort').onchange = e => { sortBy = e.target.value; render(); };
    targetEl.querySelector('#toggle-fresh').onclick = () => { freshOnly = !freshOnly; render(); };

    const selectAll = targetEl.querySelector('#queue-select-all');
    const itemBoxes = targetEl.querySelectorAll('[data-select-brief]');
    const countDisplay = targetEl.querySelector('#queue-selected-count');
    const btnCountDisplay = targetEl.querySelector('#btn-count');

    function updateCount() {
      const checked = targetEl.querySelectorAll('[data-select-brief]:checked');
      countDisplay.textContent = checked.length;
      btnCountDisplay.textContent = checked.length;
      selectAll.checked = checked.length > 0 && checked.length === itemBoxes.length;
    }

    selectAll.onchange = () => {
      itemBoxes.forEach(cb => { cb.checked = selectAll.checked; });
      updateCount();
    };

    itemBoxes.forEach(cb => { cb.onchange = updateCount; });

    targetEl.querySelector('#quick-select-top3').onclick = () => {
      let picked = 0;
      itemBoxes.forEach(cb => {
        const entry = all.find(({b}) => b.id === cb.dataset.selectBrief), light = entry ? signalOfBrief(entry.b).light : 'NONE';
        cb.checked = picked < 3 && (light === 'GREEN' || light === 'YELLOW') && ++picked > 0;
      });
      updateCount();
    };

    function getSelected() {
      const ids = new Set(Array.from(targetEl.querySelectorAll('[data-select-brief]:checked')).map(cb => cb.dataset.selectBrief));
      return all.filter(({b}) => ids.has(b.id));
    }

    // Single-Action Dispatch (Copy & Clear Inbox)
    targetEl.querySelector('#batch-copy-clear').onclick = async () => {
      const selected = getSelected();
      if (!selected.length) { notice('Select trends or click "⚡ Select Top 3 Rising" first'); return; }
      const batchText=selected.map(({b})=>CreatorEngine.exportBrief(b)).join('\n\n══════════════════════════\n\n');
      try {
        await navigator.clipboard.writeText(batchText);
        notice(`Copied ${selected.length} briefs ✓`);
        render();
      } catch {
        notice('Clipboard permission denied');
      }
    };

    // Bulk Dismiss
    targetEl.querySelector('#batch-dismiss').onclick = () => {
      const selected = getSelected();
      if (!selected.length) { notice('Select trends to dismiss'); return; }
      if(!confirm(`Dismiss ${selected.length} selected briefs?`))return;
      selected.forEach(({b}) => { b.status = 'rejected'; });
      if (typeof save === 'function') save();
      notice(`Dismissed ${selected.length} trends.`);
      render();
    };
  }

  render();
}

// Manual briefs remain in page memory and never merge into the benchmark feed.
let manualHijackResult = null;
let manualHijackRunning = false;
let manualHijackError = '';
function renderManualHijack() {
 const mount=document.getElementById('manual-hijack-result');
 if(!mount)return;
 const button=document.querySelector('#radar-quick button');
 if(button){button.disabled=manualHijackRunning;button.textContent=manualHijackRunning?'Ingesting & drafting…':'Ingest & Draft Brief';}
 const b=manualHijackResult?.brief;
 mount.innerHTML=`<p role="status">${esc(manualHijackRunning?'Fetching the video and drafting against the current pulse…':manualHijackError)}</p>${b?TrendJackingBriefCard(b,b.scrapedSource.creatorHandle):''}`;
 if(b)wireTrendCards(mount,[b],b.scrapedSource.creatorHandle);
}
async function handleManualHijack(url) {
 if(manualHijackRunning)return;
 manualHijackRunning=true;manualHijackError='';renderManualHijack();
 try {
  const response=await fetch('/api/hijack',{method:'POST',headers:{'Content-Type':'application/json','X-Luxeva-Request':'radar'},body:JSON.stringify({url}),signal:AbortSignal.timeout(115000)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Manual ingestion failed.');
  const brief=result?.brief;
  if(brief?.manualHijack!==true)throw Error('The server returned an incomplete manual feed card.');
  CreatorEngine.validateBrief(brief);
  manualHijackResult=result;
 } catch(error) {manualHijackError=error.message || 'Manual ingestion failed.';}
 finally {manualHijackRunning=false;renderManualHijack();}
}

function renderAgencyRadar(){
 const profiles=agency.models.map(m=>({record:m,p:creatorProfileFor(m)}));
 $('#content').innerHTML=`<section class="hero"><div><span class="eyebrow">AGENCY INTELLIGENCE</span><h2>Agency Radar</h2></div></section><section id="benchmark-manager-mount"></section><section class="panel"><div class="bar">${renderRadarTelemetryHtml()}<button id="radar-scan">⚡ Run Radar Scan</button></div>${renderMetaPlaybookHtml(latestPulse)}<p id="radar-progress" role="status">Ready to scan your active targets.</p></section><section class="panel" aria-label="Manual Hijack"><h2>🎯 Manual Hijack</h2><form id="radar-quick" class="bar"><input type="url" name="url" required aria-label="Paste TikTok URL to Hijack" placeholder="Paste TikTok URL to Hijack"><button>Ingest & Draft Brief</button></form><section id="manual-hijack-result" aria-label="Manual hijack brief"></section></section><section id="radar-results" class="section-gap"></section>`;
  wirePlaybookActions();
  loadLatestPulse();
  renderActiveQueueManager($('#radar-results'), profiles);
  renderBenchmarkEditor();
  renderManualHijack();
  loadRadarFeed();
let running=false;
 async function ingest(url,demo=false){
  if(running)return;
  running=true;
  const status=$('#radar-progress');
  if($('#radar-scan'))$('#radar-scan').disabled=true;
  if($('#radar-quick button'))$('#radar-quick button').disabled=true;
  status.textContent=url?'Ingesting video and recent creator posts…':'Scanning benchmarks and niche competitors…';
  const targets = url ? [] : radarTargets();
  try{
    const response=await fetch('/api/radar',{method:'POST',headers:{'Content-Type':'application/json','X-Luxeva-Request':'radar'},body:JSON.stringify({url:url||null,targets,demo})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Radar scan failed');
    if(!demo&&!result.sources.length){status.textContent=`${result.scanned} posts scanned · no qualifying outliers. ${result.errors.join(' ')}`;return}
    const previousSources=agency.radarSources,previousBriefs=new Map(agency.models.map(r=>[r.id,r.trendBriefs])),draftsById=new Map(agency.models.map(r=>[r.id,[...(r.trendBriefs||[])]]));
    let count=0;const dbg={stale:0,dup:0,locked:0,notEligible:0,profiles:profiles.length};
    const merged=[...(agency.radarSources||[])];
    for(const raw of result.sources){
      const r=CreatorEngine.source(raw);
      const postAge = typeof getTikTokAgeHours==='function' ? getTikTokAgeHours(r.originalVideoUrl) : null;
      if(!url && !r.demo && postAge !== null && postAge > 72){dbg.stale++;continue;} // Drop stale only on passive sweeps
      const seen=merged.find(x=>x.originalVideoUrl===r.originalVideoUrl&&x.tier===r.tier&&x.creatorId===r.creatorId);if(seen){seen.observedAt=new Date().toISOString();}else merged.push(r);
      for(const {record,p} of profiles){
        if(Ops.locked(record)){dbg.locked++;continue;}if(!CreatorEngine.eligible(p,r)){dbg.notEligible++;continue;}if((record.trendBriefs||[]).some(b=>b.scrapedSource.originalVideoUrl===r.originalVideoUrl)){dbg.dup++;continue;}
        draftsById.get(record.id).push(CreatorEngine.generate(p,r,crypto.randomUUID()));
        count++;
      }
    }
    agency.radarSources=merged.slice(-50);
    if (typeof document !== 'undefined') {
      const tel = document.getElementById('radar-telemetry');
      if (tel && typeof renderRadarTelemetryHtml === 'function') tel.outerHTML = renderRadarTelemetryHtml();
    }
    for(const record of agency.models)record.trendBriefs=draftsById.get(record.id);
    if(!save()){
      agency.radarSources=previousSources;
      for(const r of agency.models)r.trendBriefs=previousBriefs.get(r.id);
      throw Error('Save failed; previous workspace retained');
    }
    if(view==='radar'){
      renderAgencyRadar();
      $('#radar-progress').textContent=`${result.scanned} posts scanned · ${result.sources.length} outliers · ${count} briefs drafted. [debug: profiles ${dbg.profiles}, stale ${dbg.stale}, locked ${dbg.locked}, not eligible ${dbg.notEligible}, duplicates ${dbg.dup}, stored briefs ${profiles.map(x=>(x.record.trendBriefs||[]).length).join('/')}, outlier ids ${result.sources.map(x=>String(x.originalVideoUrl||x.url||x.id).split('/').pop()).join(',')}] ${result.errors.join(' ')}`;
    }
  }catch(error){
    status.textContent=error.message;
  }finally{
    running=false;
    if(view==='radar'){
      if($('#radar-scan'))$('#radar-scan').disabled=false;
      if($('#radar-quick button'))$('#radar-quick button').disabled=manualHijackRunning;
    }
  }
 }
 
 $('#radar-scan').onclick=()=>ingest();$('#radar-quick').onsubmit=e=>{e.preventDefault();handleManualHijack(new FormData(e.target).get('url'))};
}


function renderBenchmarkEditor() {
  if (typeof document === 'undefined') return;
  if(typeof view!=='undefined'&&view!=='radar')return;
  const container = document.getElementById('benchmark-manager-mount');
  if (!container) return;

  let mount = document.getElementById('benchmark-editor-ui');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'benchmark-editor-ui';
    mount.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; margin: 12px 0; font-family: sans-serif;';
    container.prepend(mount);
  }

  const open=document.getElementById('benchmark-settings')?.open;
  const targets=getActiveBenchmarkTargets();
  const list = getActiveBenchmarkHandles();
  const drops = getBenchmarkDropNotifications(latestPulse, list);
  mount.innerHTML = `
    ${renderBenchmarkDropBanner(drops)}
    <details id="benchmark-settings" ${open?'open':''}><summary>🎯 Target Competitors &amp; Benchmark URLs (${list.length})</summary>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span id="benchmark-manager-heading" tabindex="-1" style="font-weight:600; font-size:13px; color:#e0e0e0;">🎯 Target Competitors & Benchmark URLs (${list.length})</span>
      <button id="btn-reset-benchmarks" style="background:transparent; border:none; color:#888; font-size:11px; cursor:pointer; text-decoration:underline;">Reset Defaults</button>
    </div>
    <div style="display:flex; gap:8px; margin-bottom:10px;">
      <input id="new-benchmark-input" placeholder="Paste TikTok URL or @handle (e.g. https://www.tiktok.com/@calicomia)" 
             style="flex:1; background:#111; border:1px solid #333; color:#fff; padding:6px 10px; border-radius:4px; font-size:12px;">
      <button id="btn-add-benchmark"
              style="background:#2563eb; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer;">+ Add</button>
    </div>
    <div class="bar"><label>Tier<select id="new-benchmark-tier"><option value="1">Tier 1 · Universal</option><option value="2">Tier 2 · Niche</option></select></label><label>Niche<input id="new-benchmark-niche" placeholder="e.g. fitness"></label><label>Assign to<select id="new-benchmark-model"><option value="">Choose creator</option>${(typeof agency!=='undefined'?agency.models:[]).map(m=>`<option value="${esc(m.id)}">${esc(m.model.name)}</option>`).join('')}</select></label></div>
    <div id="benchmark-tags-container" style="display:flex; flex-wrap:wrap; gap:6px; max-height:130px; overflow-y:auto;">
      ${list.map(h => {
        const drop = drops.find(d => d.handle === h);
        return `<div style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;background:#1e1e1e;border:1px solid ${drop ? '#f87171' : '#333'};padding:6px 10px;border-radius:8px;font-size:12px;color:#ddd">
          <span>@${esc(h)}</span><span class="badge">Tier ${targets.find(t=>t.handle==='@'+h)?.tier||1} · ${esc(targets.find(t=>t.handle==='@'+h)?.niche||'universal')} ${esc(targets.find(t=>t.handle==='@'+h)?.assignedModel||'')}</span>
          ${drop ? `<strong style="color:#f87171">Suggested DROP${drop.demo ? ' · Preview' : ''}</strong>
            <button type="button" class="benchmark-replace-btn secondary" data-handle="${esc(h)}">Remove &amp; Replace</button>
            <span style="flex-basis:100%;color:#bbb">${esc(drop.reason)}</span>` : ''}
          <button type="button" data-handle="${esc(h)}" class="benchmark-remove-btn" aria-label="Remove @${esc(h)}" style="background:transparent;border:0;cursor:pointer;color:#ff5555">✕</button>
        </div>`;
      }).join('')}
    </div></details>
  `;

  const manage = document.getElementById('manage-flagged-benchmarks');
  if (manage) manage.onclick = () => {
    document.getElementById('benchmark-settings').open=true;
    const heading = document.getElementById('benchmark-manager-heading');
    heading?.scrollIntoView({behavior:'smooth', block:'center'});
    heading?.focus({preventScroll:true});
  };
  mount.querySelectorAll('.benchmark-replace-btn').forEach(btn => {
    btn.onclick = () => replaceFlaggedBenchmark(btn.getAttribute('data-handle'));
  });

  const resetBtn = document.getElementById('btn-reset-benchmarks');
  if (resetBtn) resetBtn.onclick = resetBenchmarkHandles;

  const addBtn = document.getElementById('btn-add-benchmark');
  const inputEl = document.getElementById('new-benchmark-input');
  if (addBtn && inputEl) {
    const handleAdd = () => {
      addBenchmarkHandle(inputEl.value);
      inputEl.value = '';
    };
    addBtn.onclick = handleAdd;
    inputEl.onkeydown = (e) => { if (e.key === 'Enter') handleAdd(); };
  }

  const removeBtns = mount.querySelectorAll('.benchmark-remove-btn');
  removeBtns.forEach(btn => {
    btn.onclick = () => removeBenchmarkHandle(btn.getAttribute('data-handle'));
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => { setTimeout(renderBenchmarkEditor, 300); });
}
