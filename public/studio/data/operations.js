/* Pure local operations: no persistence or external integrations. */
(function(root){
  const statuses=['pending','active','frozen','cancelled'];
  const status=m=>m.status==='archived'?'active':m.status||'active';
  const archived=m=>m.archived===true||m.status==='archived';
  const locked=m=>archived(m)||['frozen','cancelled'].includes(status(m));
  function validate(m){
    if(m.status!==undefined&&!statuses.includes(m.status)&&m.status!=='archived')throw Error('Invalid operational status.');
    if(m.archived!==undefined&&typeof m.archived!=='boolean')throw Error('Invalid archive flag.');
    if(m.pending_reason!==undefined&&typeof m.pending_reason!=='string')throw Error('Invalid pending reason.');
    if(status(m)==='pending'&&!m.pending_reason?.trim())throw Error('A pending reason is required.');
    for(const key of ['assets','plans'])if(m[key]!==undefined){
      if(!Array.isArray(m[key])||m[key].some(r=>!r||typeof r.id!=='string'||!r.id)||new Set(m[key].map(r=>r.id)).size!==m[key].length)throw Error('Invalid '+key+' records.');
    }
  }
  function normalizeWorkspace(w){return {...w,models:w.models.map(m=>({...m,status:status(m),archived:archived(m)}))}}
  function transition(m,next,reason=''){
    if(!statuses.includes(next))throw Error('Invalid operational status.');
    const result={...m,status:next,archived:archived(m),pending_reason:next==='pending'?reason.trim():''};
    validate(result);return result;
  }
  function roster(w,{status:filter='all',archived:archive=false}={}){
    return w.models.filter(m=>archived(m)===archive&&(filter==='all'||status(m)===filter));
  }
  const unreviewed=m=>(m.assets||[]).filter(a=>a.reviewStatus==='unreviewed');
  const reviewPlans=m=>(m.plans||[]).filter(p=>p.status==='ready_for_review');
  function attention(w){
    const visible=w.models.filter(m=>!archived(m));
    return {active:visible.filter(m=>status(m)==='active'),pending:visible.filter(m=>status(m)==='pending'),
      content:visible.filter(m=>unreviewed(m).length),plans:visible.filter(m=>reviewPlans(m).length)};
  }
  root.LuxevaOperations=Object.freeze({statuses,status,archived,locked,validate,normalizeWorkspace,transition,roster,unreviewed,reviewPlans,attention});
})(globalThis);
