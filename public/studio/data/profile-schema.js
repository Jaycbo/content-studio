(function(root){
 const sections=[
 ['identity','Identity & Agency'],['appearance','Appearance & Sizing'],['personality','Personality & Knowledge'],['brand','Brand & Positioning'],['content','Content Profile'],['accounts','Social & Platform Accounts'],['boundaries','Boundaries & Permissions'],['team','Team & Assignment']
 ].map(([id,title])=>({id,title,fields:[]}));
 const fields={};
 function field(section,key,label,type='text',sensitivity='internal',options){const f={key,label,type,sensitivity,...(options?{options}:{})};fields[key]=f;sections.find(s=>s.id===section).fields.push(f);return f}
 function batch(section,list,sensitivity='internal'){for(const [key,label] of list)field(section,key,label,'text',sensitivity)}
 batch('identity',[['legalName','Legal name'],['timezone','Timezone'],['preferredContact','Preferred contact channel']]);
 field('identity','aliases','Aliases','repeat','internal',['Alias']);field('identity','contacts','Contact channels','repeat','internal',['Channel','Value']);
 for(const [k,l] of [['contractStart','Contract start'],['contractEnd','Contract end'],['contractRenewal','Renewal date']])field('identity',k,l,'date');
 field('identity','revenueSplit','Creator revenue share (%)','number');
 batch('appearance',[['topSize','Top size'],['bottomSize','Bottom size'],['dressSize','Dress size'],['waist','Waist (include unit)'],['hips','Hips (include unit)'],['tattoos','Tattoos'],['piercings','Piercings'],['features','Distinguishing features']],'smm');
 field('appearance','weight','Weight (kg, optional)','number','smm');field('appearance','sizeSystem','Clothing size system','select','smm',['US','UK','EU','International']);
 field('personality','favorites','Favorites','repeat','chatter',['Type','Value']);batch('personality',[['likes','Likes'],['dislikes','Dislikes'],['pets','Pets']],'chatter');
 for(const [k,l] of [['facts','Personal facts'],['stories','Stories she is comfortable sharing'],['conversationLimits','Conversational limits']])field('personality',k,l,'textarea','chatter');
 batch('brand',[['targetMarket','Target market'],['targetLanguage','Target language']],'smm');
 for(const [k,l] of [['differentiators','Differentiators'],['voiceRestrictions','Voice restrictions'],['brandSummary','Positioning summary']])field('brand',k,l,'textarea','smm');
 field('brand','competitorLinks','Competitor references','repeat','smm',['Name','URL']);
 for(const [k,l] of [['abilities','Content abilities'],['strengths','Strengths'],['preferences','Content preferences'],['locations','Filming locations'],['resources','Available equipment / resources'],['submissionPreferences','Editing and submission preferences'],['priorities','Content priorities']])field('content',k,l,'textarea','smm');
 field('content','multipleTakes','Comfortable filming multiple takes','select','smm',['Yes','No','Ask first']);
 field('boundaries','hardRules','Creator Hard Rules','textarea','internal');
 for(const group of ['Content','Platform','Chatter'])for(const item of group==='Content'?['Public content','Private content','Collaborations']:group==='Platform'?['Posting','Cross-posting','Live streaming']:['Personal stories','Custom requests','Promises / commitments'])field('boundaries',group.toLowerCase()+item.replace(/[^a-z]/gi,''),group+': '+item,'select','internal',['Allowed','Ask First','Not Allowed']);
 batch('team',[['manager','Manager'],['smm','Social media manager'],['leadChatter','Lead chatter'],['strategist','Strategist']]);field('team','chatters','Additional chatters','repeat','internal',['Name']);field('team','teamNotes','Team notes','textarea');
 const legacy={identity:['name','photo','homeLocation','dateOfBirth','age','nationality','languages'],appearance:['height','hairType','hairColor','eyeColor','braSize','shoeSize','body_type'],personality:['personality','interests','skills'],brand:['niche','styles','preferred_tones'],content:['wardrobe_tags','content_categories','filming_days','filming_times','availability'],accounts:['accountEntries'],boundaries:['filming_boundaries','boundary_tags']};
 // Deployment brief: retain all existing fields under the revised eight domains.
 const sectionNames={identity:'Identity',appearance:'Visual / Style',personality:'Voice / Tone',boundaries:'Boundaries / Off-Limits',accounts:'Platform Links',brand:'Target Benchmarks',content:'Content Vault Tags',team:'Weekly Filming Quota Tracking'};
 sections.forEach(s=>s.title=sectionNames[s.id]);
 const team=sections.find(s=>s.id==='team'),identity=sections.find(s=>s.id==='identity');identity.fields.push(...team.fields);team.fields=[];
 sections.sort((a,b)=>['identity','appearance','personality','boundaries','accounts','brand','content','team'].indexOf(a.id)-['identity','appearance','personality','boundaries','accounts','brand','content','team'].indexOf(b.id));
 field('brand','baselineViews','Public-post baseline views','number','smm');field('brand','outlierMultiplier','Outlier multiplier (ratio, not Z-score)','number','smm');field('brand','benchmarkNotes','Benchmark notes','textarea','smm');
 field('team','quotaWeek','Week beginning','date','smm');
 const quotas=[['setA','Set A photos (Casual / Lingerie)',25,30],['setB','Set B photos (Theme / Glam)',25,30],['broll','B-roll clips',6,8],['hero','Hero PPV videos (5–12 minutes)',1,1],['lipSync','Lip-sync hooks (9:16)',4,5],['storytime','Storytime hooks',3,3],['xLoops','X loop clips',5,7],['lifestyle','Lifestyle snaps',5,5]];
 for(const [key,title,min,max] of quotas){field('team',key+'Target',title+' — weekly target ('+min+'–'+max+')','number','smm');field('team',key+'Delivered',title+' — delivered','number','smm');}
 field('team','quotaNotes','Weekly production notes','textarea','smm');
 const flags={};for(const f of Object.values(fields))flags['details.'+f.key]=f.sensitivity;
 for(const [section,keys] of Object.entries(legacy))for(const key of keys)flags[key]=['photo','name'].includes(key)?'public':section==='identity'?'internal':section==='personality'?'chatter':'smm';
 for(const key of ['platform','handle','daily','role','status','followers','notes'])flags['accountEntries.'+key]=key==='notes'?'internal':'smm';
 flags.taxonomyRules='smm';flags.status='internal';flags.pending_reason='internal';flags.archived='internal';
 function validate(m){
  if(m.profileSchemaVersion!==undefined&&m.profileSchemaVersion!==1)throw Error('Unsupported profile schema.');
  if(m.details!==undefined&&(!m.details||typeof m.details!=='object'||Array.isArray(m.details)))throw Error('Invalid profile details.');
  for(const [key,value] of Object.entries(m.details||{})){const f=fields[key];if(!f)continue;
   if(f.type==='repeat'){if(!Array.isArray(value)||value.some(row=>!row||typeof row!=='object'||f.options.some(c=>typeof row[c]!=='string')))throw Error('Invalid '+f.label);}
   else if(typeof value!=='string')throw Error('Invalid '+f.label);
   else if(f.type==='number'&&value!==''&&(!Number.isFinite(Number(value))||Number(value)<0||(key==='revenueSplit'&&Number(value)>100)))throw Error('Invalid '+f.label);
   else if(f.type==='date'&&value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value).toISOString().slice(0,10)!==value))throw Error('Invalid '+f.label);
   else if(f.type==='select'&&value&&!f.options.includes(value))throw Error('Invalid '+f.label);
  }
  if(m.details?.contractStart&&m.details?.contractEnd&&m.details.contractEnd<m.details.contractStart)throw Error('Contract end must follow its start.');
  if(m.fieldSensitivity&&Object.values(m.fieldSensitivity).some(v=>!['internal','chatter','smm','public'].includes(v)))throw Error('Invalid sensitivity flag.');
 }
 function stamp(m){return {...m,profileSchemaVersion:1,details:m.details||{},fieldSensitivity:{...flags}}}
 root.LuxevaProfileSchema=Object.freeze({version:1,sections,fields,legacy,flags,validate,stamp});
})(globalThis);
