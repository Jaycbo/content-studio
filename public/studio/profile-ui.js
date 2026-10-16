function taxonomyPicker(category,m){
 const terms=agency.taxonomy?.terms.filter(t=>t.category===category)||[],ids=m.taxonomyRefs?.[category]||[];
 const title=TAG_LABELS[category]||({niche:'Niches',content_categories:'Content categories',body_type:'Body type'})[category]||category;
 return `<details class="tag-group"><summary>${esc(title)} <span class="meta">${ids.length} selected</span></summary><div class="tag-options">${terms.map(t=>`<label class="chip"><input type="checkbox" name="${category}" value="${esc(t.id)}" ${ids.includes(t.id)?'checked':''}><span>${esc(t.label)}</span></label>`).join('')||'<p>No terms yet. Add one in Taxonomy Bank.</p>'}</div></details>`;
}
function managedLegacyField(key,m){
 if(key==='dateOfBirth')return `<label>Date of birth<input name="dateOfBirth" type="date" max="${adultCutoff()}" value="${esc(m.dateOfBirth||'')}"><span id="dob-error" class="help" role="status"></span></label>`;
 if(key==='age'&&m.dateOfBirth)return `<label>Age<input name="age" readonly value="${ageFromDOB(m.dateOfBirth)??''}"></label>`;
 if(key==='skills')return `<label>Skills / talents<textarea name="skills">${esc(m.skills||'')}</textarea></label>`;
 return detailSelect(key,PROFILE_FIELDS[key],m[key]);
}
function extraField(f,m){
 const value=m.details?.[f.key]??'';
 if(f.type==='repeat')return `<fieldset class="wide" data-repeat="${f.key}"><legend>${esc(f.label)}</legend><div data-repeat-list>${(value||[]).map(row=>repeatRow(f,row)).join('')}</div><button type="button" class="secondary" data-add-repeat="${f.key}">+ Add ${esc(f.label.toLowerCase())}</button></fieldset>`;
 return `<label>${esc(f.label)}${f.type==='textarea'?`<textarea name="extra:${f.key}">${esc(value)}</textarea>`:f.type==='select'?`<select name="extra:${f.key}"><option value="">Not specified</option>${f.options.map(v=>`<option ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select>`:`<input name="extra:${f.key}" type="${f.type}" ${f.type==='number'?'min="0" step="any"':''} ${f.key==='revenueSplit'?'max="100"':''} value="${esc(value)}">`}</label>`;
}
function repeatRow(f,row={}){return `<div data-repeat-row class="record"><div class="form-grid">${f.options.map(c=>`<label>${esc(c)}<input data-column="${esc(c)}" value="${esc(row[c]||'')}"></label>`).join('')}</div><button type="button" class="subtle" data-remove-repeat>Remove</button></div>`}
function renderManagedProfile(m){
 const sections=LuxevaProfileSchema.sections;
 return `<div class="panel"><div class="profile-banner">${avatar(m,true)}<div><h2>${esc(m.name)}</h2><p>${esc(profileSummary(m))}</p></div></div><p class="help">Summary from saved profile information.</p></div><form id="settings">${sections.map(s=>{
 let special='';
 if(s.id==='identity')special=`<label>Model / working name<input name="name" maxlength="100" required value="${esc(m.name)}"></label><label>Lives in — city / country<input name="homeLocation" value="${esc(m.homeLocation||'')}"></label><label>Profile photo<input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p id="photo-status" role="status" class="help">Photos are compressed and saved immediately.</p><button type="button" class="subtle" id="remove-photo">Remove photo</button>${['dateOfBirth','age','nationality','languages'].map(k=>managedLegacyField(k,m)).join('')}<p class="help">Status, pending reason and archive controls are below Manage Profile.</p>`;
 if(s.id==='appearance')special=['height','hairType','hairColor','eyeColor','braSize','shoeSize'].map(k=>managedLegacyField(k,m)).join('')+taxonomyPicker('body_type',m);
 if(s.id==='personality')special=managedLegacyField('skills',m)+['personality','interests'].map(k=>taxonomyPicker(k,m)).join('');
 if(s.id==='brand')special=['niche','styles','preferred_tones'].map(k=>taxonomyPicker(k,m)).join('');
 if(s.id==='content')special=['wardrobe_tags','content_categories','location','hook','format'].map(k=>taxonomyPicker(k,m)).join('')+scheduleChoices('filming_days','Days',DAYS,m)+scheduleChoices('filming_times','Times',TIMES,m)+(m.availability?`<p class="help">Saved availability: ${esc(m.availability)}</p>`:'');
 if(s.id==='accounts')special=`<div class="wide"><button type="button" id="add-account">+ Add an account</button><div id="account-list"></div>${m.handles?`<p class="help">Previous account notes: ${esc(m.handles)}</p>`:''}</div>`;
 if(s.id==='boundaries')special=['filming_boundaries','boundary_tags'].map(k=>taxonomyPicker(k,m)).join('')+`<details class="wide"><summary>Public reference tag rules</summary><p class="help">Set a rule for a Location, Hook or Format tag. Add tags in Taxonomy Bank first.</p>${agency.taxonomy.terms.filter(t=>['location','hook','format'].includes(t.category)).map(t=>`<label>${esc(t.category+': '+t.label)}<select name="rule:${esc(t.id)}"><option value="">No rule set</option>${['Allowed','Ask First','Not Allowed'].map(v=>`<option ${(m.taxonomyRules||[]).some(r=>r.termId===t.id&&r.decision===v)?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</details>`;
 return `<details class="panel section-gap" data-profile-section="${s.id}"><summary>${esc(s.title)}</summary><div class="form-grid">${special}${s.fields.map(f=>extraField(f,m)).join('')}</div></details>`;
 }).join('')}<div class="save-bar"><span id="profile-save-status" role="status">Profile changes save when you click Save. Photos save immediately.</span><button id="save-profile">Save profile</button></div></form><section class="panel section-gap"><h2>Taxonomy Bank</h2><p>Map public reference tags such as Location: Car, Hook: Storytime and Format: GRWM to this creator’s selected tags and rules. No scraping is performed.</p><button id="manage-taxonomy" class="secondary">Manage terms</button></section>`;
}
function wireExtraProfile(form){
 form.querySelectorAll('[data-add-repeat]').forEach(b=>b.onclick=()=>{const f=LuxevaProfileSchema.fields[b.dataset.addRepeat];b.parentElement.querySelector('[data-repeat-list]').insertAdjacentHTML('beforeend',repeatRow(f));dirty=true;wireRemoves()});
 function wireRemoves(){form.querySelectorAll('[data-remove-repeat]').forEach(b=>b.onclick=()=>{b.closest('[data-repeat-row]').remove();dirty=true})}wireRemoves();
 $('#manage-taxonomy').onclick=()=>{if(leaveForm()){dirty=false;renderTaxonomyBank()}};
}
function readExtraProfile(form,next){
 const data=new FormData(form);next.details={...next.details};
 for(const f of Object.values(LuxevaProfileSchema.fields)){
  if(f.type==='repeat')next.details[f.key]=[...form.querySelectorAll(`[data-repeat="${f.key}"] [data-repeat-row]`)].map(row=>Object.fromEntries(f.options.map(c=>[c,[...row.querySelectorAll('[data-column]')].find(i=>i.dataset.column===c).value.trim()]))).filter(row=>Object.values(row).some(Boolean));
  else next.details[f.key]=String(data.get('extra:'+f.key)||'').trim();
 }
 next.taxonomyRules=agency.taxonomy.terms.filter(t=>['location','hook','format'].includes(t.category)).map(t=>({termId:t.id,decision:data.get('rule:'+t.id)})).filter(r=>r.decision);
 next.taxonomyRefs=Object.fromEntries(LuxevaTaxonomy.categories.map(k=>[k,data.getAll(k)]));
 LuxevaTaxonomy.project({taxonomy:agency.taxonomy,models:[{model:next}]});
 Object.assign(next,LuxevaProfileSchema.stamp(next));LuxevaProfileSchema.validate(next);
}
function renderTaxonomyBank(category='niche'){
 const terms=agency.taxonomy.terms.filter(t=>t.category===category);
 $('#content').innerHTML=`<section class="panel"><div class="bar"><h2>Taxonomy Bank</h2><button id="back-profile">Back to profile</button></div><label>Category<select id="taxonomy-category">${LuxevaTaxonomy.categories.map(k=>`<option value="${k}" ${k===category?'selected':''}>${esc(TAG_LABELS[k]||k.replaceAll('_',' '))}</option>`).join('')}</select></label><form id="taxonomy-add"><label>New term<input name="term" required></label><button>Add term</button></form><p class="help">Changes apply to every model, including archived profiles. Renames retain the old name as an alias. Merge preserves aliases; delete unlinks selections.</p>${terms.map(t=>`<details><summary>${esc(t.label)}</summary><p>Aliases: ${esc(t.aliases.join(', ')||'None')}</p><form data-term="${esc(t.id)}"><label>Name<input name="label" value="${esc(t.label)}" required></label><button name="action" value="rename">Rename</button><label>New alias<input name="alias"></label><button name="action" value="alias">Add alias</button><label>Merge into<select name="target"><option value="">Choose…</option>${terms.filter(x=>x.id!==t.id).map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}</select></label><button name="action" value="merge">Merge</button><button name="action" value="delete" class="danger">Delete and unlink</button></form></details>`).join('')||'<p>No terms in this category.</p>'}</section>`;
 $('#back-profile').onclick=()=>render();$('#taxonomy-category').onchange=e=>renderTaxonomyBank(e.target.value);
 function commit(action){try{const next=LuxevaTaxonomy.edit(agency,action);workspaceStore.save(next);agency=next;state=agency.models.find(m=>m.id===agency.activeId);const mirrored=LuxevaTaxonomy.mirror(localStorage,agency);window.queueWorkspaceSync?.();renderTaxonomyBank(category);notice(mirrored?'Taxonomy updated across all profiles.':'Saved in workspace. Taxonomy mirror will retry on reload.')}catch(error){notice('Taxonomy was not changed: '+error.message)}}
 $('#taxonomy-add').onsubmit=e=>{e.preventDefault();commit({type:'add',category,label:new FormData(e.target).get('term')})};
 document.querySelectorAll('[data-term]').forEach(form=>form.onsubmit=e=>{e.preventDefault();const data=new FormData(form),type=e.submitter.value;if(['merge','delete'].includes(type)&&!confirm(type==='merge'?'Merge these terms across every model?':'Delete this term and unlink it from every model?'))return;commit({type,id:form.dataset.term,label:type==='alias'?data.get('alias'):data.get('label'),target:data.get('target')})});
}
