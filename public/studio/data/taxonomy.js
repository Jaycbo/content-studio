(function(root){
 'use strict';
 const KEY='luxeva-taxonomy-v1';
 const categories=['niche','styles','personality','interests','preferred_tones','wardrobe_tags','filming_boundaries','boundary_tags','content_categories','body_type','location','hook','format'];
 const copy=x=>JSON.parse(JSON.stringify(x));
 const normalize=s=>String(s).normalize('NFKC').trim().replace(/[_\s]+/g,' ').toLowerCase();
 const label=s=>String(s).normalize('NFKC').trim().replace(/[_\s]+/g,' ').split(' ').map(w=>/^[A-Z]{2,5}$/.test(w)?w:w[0]?.toUpperCase()+w.slice(1).toLowerCase()).join(' ');
 function validate(bank){
  if(!bank||bank.version!==1||!Array.isArray(bank.terms))throw Error('Unsupported taxonomy bank.');
  const ids=new Set(),names=new Set();
  for(const t of bank.terms){if(!t||typeof t.id!=='string'||!t.id||ids.has(t.id)||!categories.includes(t.category)||typeof t.label!=='string'||!normalize(t.label)||!Array.isArray(t.aliases))throw Error('Invalid taxonomy term.');ids.add(t.id);
   for(const n of [t.label,...t.aliases]){if(typeof n!=='string'||!normalize(n))throw Error('Invalid alias.');const key=t.category+':'+normalize(n);if(names.has(key))throw Error('Duplicate taxonomy name or alias.');names.add(key)}
  }return bank;
 }
 function resolve(bank,category,name){return bank.terms.find(t=>t.category===category&&(t.id===name||[t.label,...t.aliases].some(n=>normalize(n)===normalize(name))))}
 function add(bank,category,name,aliases=[],uuid=()=>crypto.randomUUID()){
  if(!categories.includes(category)||!normalize(name))throw Error('Choose a category and term.');
  const existing=resolve(bank,category,name);if(existing)return existing;
  const term={id:uuid(),category,label:label(name),aliases:[...new Set(aliases.map(normalize))].filter(a=>a!==normalize(name))};
  validate({...bank,terms:[...bank.terms,term]});bank.terms.push(term);return term;
 }
 function project(w){
  validate(w.taxonomy);
  for(const record of w.models){const m=record.model;if(m.taxonomyRules!==undefined){if(!Array.isArray(m.taxonomyRules)||m.taxonomyRules.some(r=>!r||!w.taxonomy.terms.some(t=>t.id===r.termId)||!['Allowed','Ask First','Not Allowed'].includes(r.decision)))throw Error('Invalid taxonomy rule.')}if(!m.taxonomyRefs)continue;
   for(const [category,ids] of Object.entries(m.taxonomyRefs)){
    if(!categories.includes(category)||!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw Error('Invalid taxonomy references.');
    const terms=[...new Set(ids)].map(id=>w.taxonomy.terms.find(t=>t.id===id&&t.category===category));if(terms.some(t=>!t))throw Error('Unknown taxonomy reference.');
    m.taxonomyRefs[category]=terms.map(t=>t.id);m[category]=category==='niche'?terms.map(t=>t.label).join(', '):terms.map(t=>t.label);
   }
  }return w;
 }
 function prepare(workspace,seeds={},fallback=null,uuid){
  const w=copy(workspace);w.taxonomy=w.taxonomy?validate(w.taxonomy):fallback?copy(validate(fallback)):{version:1,terms:[]};
  // Seed only a new bank. Deleted terms must not reappear on reload.
  if(!workspace.taxonomy&&!fallback)for(const [category,values] of Object.entries(seeds))for(const value of values){const fitness=category==='interests'&&normalize(value)==='gym';add(w.taxonomy,category,fitness?'Fitness':value,fitness?['gym']:[],uuid)}
  for(const r of w.models){const m=r.model;m.taxonomyRefs ||= {};
   for(const category of categories){if(Object.hasOwn(m.taxonomyRefs,category))continue;
    const values=category==='niche'?(m.niche?[m.niche]:[]):Array.isArray(m[category])?m[category]:[];
    m.taxonomyRefs[category]=[...new Set(values.filter(v=>typeof v==='string'&&v.trim()).map(v=>add(w.taxonomy,category,v,[],uuid).id))];
   }
  }return project(w);
 }
 function edit(workspace,action){
  const w=copy(workspace),bank=validate(w.taxonomy),term=bank.terms.find(t=>t.id===action.id);
  if(action.type==='add'){add(bank,action.category,action.label,action.aliases||[]);return project(w)}
  if(!term)throw Error('Term no longer exists.');
  if(action.type==='rename'){
   const next=label(action.label);if(!normalize(next))throw Error('Enter a term name.');
   const aliases=[...term.aliases,term.label].filter(a=>normalize(a)!==normalize(next));
   term.label=next;term.aliases=[...new Map(aliases.map(a=>[normalize(a),a])).values()];
  }else if(action.type==='alias'){
   if(!normalize(action.label))throw Error('Enter an alias.');
   if(resolve(bank,term.category,action.label))throw Error('That name or alias already exists.');term.aliases.push(label(action.label));
  }else if(action.type==='merge'){
   const target=bank.terms.find(t=>t.id===action.target);if(!target||target.id===term.id||target.category!==term.category)throw Error('Merge requires a different term in the same category.');
   target.aliases=[...new Map([...target.aliases,term.label,...term.aliases].filter(a=>normalize(a)!==normalize(target.label)).map(a=>[normalize(a),a])).values()];
   for(const r of w.models)for(const ids of Object.values(r.model.taxonomyRefs||{}))for(let i=0;i<ids.length;i++)if(ids[i]===term.id)ids[i]=target.id;
   for(const r of w.models){const merged=new Map();for(const rule of r.model.taxonomyRules||[]){const id=rule.termId===term.id?target.id:rule.termId,old=merged.get(id);if(!old||['Allowed','Ask First','Not Allowed'].indexOf(rule.decision)>['Allowed','Ask First','Not Allowed'].indexOf(old.decision))merged.set(id,{...rule,termId:id});}if(r.model.taxonomyRules)r.model.taxonomyRules=[...merged.values()];}
   bank.terms=bank.terms.filter(t=>t.id!==term.id);
  }else if(action.type==='delete'){
   bank.terms=bank.terms.filter(t=>t.id!==term.id);
   for(const r of w.models)if(r.model.taxonomyRules)r.model.taxonomyRules=r.model.taxonomyRules.filter(rule=>rule.termId!==term.id);
   for(const r of w.models)for(const [key,ids] of Object.entries(r.model.taxonomyRefs||{}))r.model.taxonomyRefs[key]=ids.filter(id=>id!==term.id);
  }else throw Error('Unknown taxonomy action.');
  return project(w);
 }
 function mirror(storage,w){try{validate(w.taxonomy);storage.setItem(KEY,JSON.stringify(w.taxonomy));return true}catch{return false}}
 function fallback(storage){const raw=storage.getItem(KEY);return raw===null?null:validate(JSON.parse(raw))}
 root.LuxevaTaxonomy=Object.freeze({KEY,categories,normalize,label,validate,resolve,add,prepare,project,edit,mirror,fallback});
})(globalThis);
