// n8n → Pipeline Map importer. Reads one or more n8n workflow JSONs (plus, optionally, the AI Act Transparency Kit's
// registry.json) and lays them out as groups of nodes with typed sockets and wires. Nothing is drawn by hand:
// positions come from n8n, sockets from the node's outputs, colours from what the node does, and the registry's
// path analysis paints every generator with its status and wires it to the Auditor block.
(function(){
const AI_TYPE=/hume|emotion|biometric|rekognition|langchain|openai|anthropic|ollama|gemini|mistral|huggingface|groq|cohere|deepseek|perplexity|xai|elevenlabs|replicate|stability|bedrock|vertex|azureopenai|heygen|midjourney|runway|bannerbear|kokoro/i;
const AI_HOST=/api\.openai\.com|api\.anthropic\.com|:11434|:8880|kokoro|api\.elevenlabs\.io|api\.replicate\.com|api\.stability\.ai|generativelanguage\.googleapis|api\.mistral\.ai|api\.heygen\.com|api\.bannerbear\.com|api\.groq\.com|api\.cohere|api\.deepseek\.com|api\.x\.ai|openrouter\.ai|api\.d-id\.com|api\.synthesia\.io/i;
const AUDIO=/elevenlabs|kokoro|tts|voice|speech|audio/i, VIDEO=/heygen|runway|synthesia|d-id|video/i, IMAGE=/midjourney|stability|replicate|bannerbear|image|dall/i;
const EXIT_TYPE=/linkedIn|twitter|facebook|instagram|youTube|tiktok|wordpress|ghost|webflow|contentful|mailchimp|brevo|sendinblue|sendgrid|mailgun|emailSend|gmail|microsoftOutlook|telegram|whatsApp|twilio|messageBird|discord|reddit|medium|hubspot|activeCampaign|klaviyo/i;
const GATE_TYPE=/n8n-nodes-base\.form$|n8n-nodes-base\.wait$/, GATE_OP=/sendAndWait|approval/i;
const TRIGGER=/Trigger$|n8n-nodes-base\.webhook$|n8n-nodes-base\.formTrigger$|manualTrigger|scheduleTrigger/;
const STATUS_COLOR={uncovered:'#8c1d1d',likeness:'#8c1d1d',inform:'#8c1d1d',editorial:'#8a5a00',verify:'#8a5a00',chatbot:'#8a5a00',disclosed:'#1f6b3a',informed:'#1f6b3a',internal:'#444'};
const SX=1.2,SY=1.3,NODE_W=260,GAP_Y=200;

function short(type){return String(type).replace('@n8n/n8n-nodes-langchain.','').replace('n8n-nodes-base.','')}
function hostOf(url){try{return new URL(url).host}catch(e){return String(url||'').replace(/^https?:\/\//,'').split('/')[0]}}
function classify(n,kitId){
  const p=n.parameters||{},url=typeof p.url==='string'?p.url:'',t=n.type;
  const isKit=/executeWorkflow$/.test(t)&&(!kitId||JSON.stringify(p.workflowId||'').includes(kitId))&&!/Trigger$/.test(t);
  const gen=AI_TYPE.test(t)||AI_HOST.test(url);
  const gate=isKit||GATE_TYPE.test(t)||GATE_OP.test(String(p.operation||''))||GATE_OP.test(String(p.resource||''));
  const exit=EXIT_TYPE.test(t)||/\[exit\]/i.test(n.name);
  const trig=TRIGGER.test(t);
  const notify=/notify|reviewer/i.test(n.name)&&/slack|gmail|telegram|email|discord|teams/i.test(t);
  const loop=/splitInBatches$/.test(t), iff=/n8n-nodes-base\.if$/.test(t), sw=/n8n-nodes-base\.switch$/.test(t);
  let outType='data';
  if(gen)outType=VIDEO.test(t+url+n.name)?'video':AUDIO.test(t+url+n.name)?'video':IMAGE.test(t+url+n.name)?'creative':'brief';
  if(gate||notify)outType='gate';
  if(exit)outType='data';
  let color=C.generic;
  if(trig)color=C.input; if(gen)color=C.engine; if(/code$|crypto$|set$/.test(t))color=C.generic; if(gate||notify)color=C.qa; if(exit)color=C.launch; if(isKit)color=C.agent; if(loop||iff||sw)color=C.learn;
  return {isKit,gen,gate,exit,trig,loop,iff,sw,notify,outType,color,human:(gate&&!isKit)||notify};
}
function outsOf(n,c,wf){
  if(c.iff)return[['true','gate'],['false','gate']];
  if(c.loop)return[['done',c.outType],['loop','fb']];
  if(c.sw){const k=((wf.connections||{})[n.name]||{}).main?.length||2;return Array.from({length:k},(_,i)=>['rule '+(i+1),'gate'])}
  const k=Math.max(1,(((wf.connections||{})[n.name]||{}).main||[]).length);
  return Array.from({length:k},(_,i)=>[k>1?'out '+i:'out',c.outType]);
}
function widgetsOf(n,c){
  const p=n.parameters||{},w=[];
  const model=(p.model&&(p.model.value||p.model))||(p.modelId&&(p.modelId.value||p.modelId))||'';
  if(model)w.push(['model',String(model)]);
  if(!model&&typeof p.jsonBody==='string'){const mm=p.jsonBody.match(/model['"]?\s*:\s*['"]([^'"]+)['"]/);if(mm)w.push(['model',mm[1]])}
  if(typeof p.url==='string'&&p.url)w.push(['host',hostOf(p.url)]);
  if(p.path||(p.options&&p.options.path))w.push(['path','/'+(p.path||p.options.path)]);
  if(p.resume)w.push(['resume',p.resume]);
  if(p.operation)w.push(['op',String(p.operation)]);
  if(c.isKit)w.push(['calls','AI Act Transparency Kit']);
  if(p.batchSize)w.push(['batch',String(p.batchSize)]);
  if(n.disabled)w.push(['state','disabled']);
  return w.slice(0,4).map(a=>({k:a[0],v:a[1]}));
}

// ---- one workflow → nodes, wires, notes inside a group. Returns the group's rect.
function layoutWorkflow(wf,offY,ids,kitId,offX){offX=offX||0;
  const nodes=[],wires=[],notes=[];
  const real=wf.nodes.filter(n=>!/stickyNote$/.test(n.type));
  const minx=Math.min(...wf.nodes.map(n=>n.position[0])),miny=Math.min(...wf.nodes.map(n=>n.position[1]));
  const key=n=>ids.get(wf.id+'|'+n.name);
  for(const n of real){
    const c=classify(n,kitId);const id='w'+ids.size;ids.set(wf.id+'|'+n.name,id);
    const outs=outsOf(n,c,wf).map(a=>({name:a[0],type:a[1]}));
    const ins=c.trig?(/executeWorkflowTrigger$/.test(n.type)?[{name:'from a line',type:'gate'}]:[]):[{name:'in',type:'data'}];
    nodes.push({id,x:Math.round((n.position[0]-minx)*SX)+offX,y:Math.round((n.position[1]-miny)*SY)+offY,w:NODE_W,title:n.name,badge:short(n.type),color:c.color,human:c.human,ins,outs,widgets:widgetsOf(n,c),_cls:c,_wf:wf.name,_name:n.name});
  }
  for(const n of wf.nodes.filter(n=>/stickyNote$/.test(n.type))){
    const p=n.parameters||{};const html=String(p.content||'').replace(/^##\s*(.*)$/m,'<b>$1</b>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/\n+/g,'<br>');
    notes.push({id:'nt'+ids.size+'_'+notes.length,x:Math.round((n.position[0]-minx)*SX)+offX,y:Math.round((n.position[1]-miny)*SY)+offY,w:Math.min(640,Math.round((p.width||400)*0.9)),html});
  }
  const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
  for(const [src,c] of Object.entries(wf.connections||{})){
    const a=key({name:src});if(!a)continue;
    (c.main||[]).forEach((edges,oi)=>{for(const e of edges||[]){const b=key({name:e.node});if(!b)continue;const back=byId[b].x<byId[a].x;const fromOut=byId[a].outs[oi]||byId[a].outs[0];
      wires.push({id:'e'+wires.length+'_'+ids.size,from:[a,Math.min(oi,byId[a].outs.length-1)],to:[b,0],kind:(back||fromOut.type==='fb')?'fb':'',flow:2});
      if(byId[b].ins[0]&&fromOut.type!=='fb')byId[b].ins[0].type=fromOut.type;}});
  }
  const xs=nodes.map(n=>n.x).concat(notes.map(n=>n.x)),xe=nodes.map(n=>n.x+n.w).concat(notes.map(n=>n.x+n.w));
  const ys=nodes.map(n=>n.y).concat(notes.map(n=>n.y)),ye=nodes.map(n=>n.y+60+24*Math.max(n.ins.length,n.outs.length)+28*n.widgets.length).concat(notes.map(n=>n.y+110));
  const rect={x:Math.min(...xs)-40,y:Math.min(...ys)-70,w:Math.max(...xe)-Math.min(...xs)+80,h:Math.max(...ye)-Math.min(...ys)+120};
  return {nodes,wires,notes,rect};
}

// ---- Auditor block: what the EU reads, filled from the registry
function auditorBlock(reg,x,y,ids){
  const st=(reg&&reg.systems)||[];const cnt=s=>st.filter(r=>r.path_status===s).length;
  const a=reg&&reg.audit||{};
  const mk=(id,title,badge,ins,widgets,dy)=>({id,x,y:y+dy,w:360,title,badge,color:'#1f4e79',human:false,ins,outs:[],widgets:widgets.map(w=>({k:w[0],v:String(w[1])}))});
  const nodes=[
    mk('aud_wait','Awaiting a human','the gate · a person decides',[{name:'stopped at the gate',type:'gate'}],[['assets waiting',a.awaiting??'—'],['who decides','a named reviewer']],0),
    mk('aud_reg','1 · AI-systems registry','voluntary · Art. 4',[{name:'from every workflow',type:'data'},{name:'uncovered',type:'alert'}],[['systems',st.length],['people not told',cnt('uncovered')+cnt('likeness')+cnt('inform')],['need a decision',cnt('editorial')+cnt('verify')+cnt('chatbot')],['workflows scanned',reg?reg.instance_workflows:'—']],150),
    mk('aud_media','2 · Synthetic media & deep fakes','Art. 50(4) §1 · 50(2)',[{name:'manifests',type:'creative'}],[['assets',a.media??'—'],['needs','label + consent + provenance']],360),
    mk('aud_text','3 · Generated text','Art. 50(4) §2',[{name:'manifests',type:'brief'}],[['texts',a.texts??'—'],['exception','named editor']],520),
    mk('aud_log','4 · Approval log','voluntary · Art. 26(6)-style',[{name:'decisions',type:'gate'}],[['decisions',a.approvals??'—'],['ledger',a.chain_ok===false?'chain BROKEN':a.chain_ok?'append-only · chain verified':'Postgres, append-only']],660),
  ];
  return {nodes,rect:{x:x-40,y:y-70,w:440,h:860}};
}

function importN8n(files,opts){
  opts=opts||{};
  const wfs=[],regs=[];
  for(const f of files){
    if(f&&Array.isArray(f.workflows)){wfs.push(...f.workflows);if(f.registry)regs.push(f.registry);continue}
    if(f&&Array.isArray(f)&&f.length&&f[0].nodes){wfs.push(...f);continue}
    if(f&&Array.isArray(f.nodes)&&f.connections!==undefined){wfs.push(f);continue}
    if(f&&Array.isArray(f.systems)){regs.push(f);continue}
  }
  if(!wfs.length){toast('No n8n workflow found in that JSON');return false}
  const reg=regs[0]||null;
  const kitId=opts.kitId||(wfs.find(w=>/transparency kit$/i.test(w.name||''))||{}).id||null;
  const ids=new Map();const groups=[],nodes=[],wires=[],notes=[];let offY=0;
  const auditWf=wfs.find(w=>/audit view/i.test(w.name||''));
  for(const wf of wfs){
    if(wf===auditWf)continue;
    const L=layoutWorkflow(wf,offY,ids,kitId);
    groups.push({id:'g_'+groups.length,x:L.rect.x,y:L.rect.y,w:L.rect.w,h:L.rect.h,title:(wf.name||'workflow')+(wf.active===false?'  ·  inactive':wf.active?'  ·  active':''),color:'rgba(255,255,255,.04)'});
    nodes.push(...L.nodes);wires.push(...L.wires);notes.push(...L.notes);offY=L.rect.y+L.rect.h+GAP_Y;
  }
  // registry overlay: paint generators with their path status, wire the uncovered ones to the registry
  const maxX=Math.max(...groups.map(g=>g.x+g.w));const aud=auditorBlock(reg,maxX+260,groups[0].y+70,ids);
  nodes.push(...aud.nodes);groups.push({id:'g_auditor',x:aud.rect.x,y:aud.rect.y,w:aud.rect.w,h:aud.rect.h,title:'Auditor · what the EU reads',color:'rgba(84,160,255,.07)'});
  // the audit view reads the auditor's files and renders the page: place it under the block, wire every block into "Collect files"
  if(auditWf){const L=layoutWorkflow(auditWf,aud.rect.y+aud.rect.h+170,ids,kitId,aud.rect.x+40);
    groups.push({id:'g_audit',x:L.rect.x,y:L.rect.y,w:L.rect.w,h:L.rect.h,title:(auditWf.name||'audit view')+'  ·  renders the blocks above as one page',color:'rgba(84,160,255,.05)'});
    nodes.push(...L.nodes);wires.push(...L.wires);notes.push(...L.notes);
    const collect=L.nodes.find(n=>/collect|ledger/i.test(n._name))||L.nodes[1];
    if(collect){for(const a of aud.nodes){a.outs.push({name:'file',type:'data'});wires.push({id:'av_'+wires.length,from:[a.id,0],to:[collect.id,0],kind:'',flow:1})}}}
  // embedding: a line's call to the kit enters "Called by another workflow" and comes back from "Return to caller"
  const kitEntry=nodes.find(n=>n._name==='Called by another workflow'&&/transparency kit$/i.test(n._wf||''));
  const kitReturn=nodes.find(n=>n._name==='Return to caller'&&/transparency kit$/i.test(n._wf||''));
  for(const n of nodes){if(!(n._cls&&n._cls.isKit))continue;
    if(kitEntry){wires.push({id:'in_'+wires.length,from:[n.id,0],to:[kitEntry.id,0],kind:'',flow:3})}
    if(kitReturn){n.ins.push({name:'decision',type:'gate'});wires.push({id:'ret_'+wires.length,from:[kitReturn.id,0],to:[n.id,n.ins.length-1],kind:'fb',flow:3})}}
  if(reg){for(const r of reg.systems||[]){if(r.source!=='workflow node')continue;const n=nodes.find(n=>n._wf===r.workflow&&n._name===r.system);if(!n)continue;
    n.badge=r.path_status;n.color=STATUS_COLOR[r.path_status]||n.color;
    if(r.path_status==='uncovered'||r.path_status==='likeness'||r.path_status==='inform'){n.outs.push({name:'uncovered',type:'alert'});wires.push({id:'al_'+wires.length,from:[n.id,n.outs.length-1],to:['aud_reg',1],kind:'',flow:3})}
    n.widgets=[{k:'status',v:r.path_status}].concat(n.widgets).slice(0,4);}}
  const wireTo=(name,to,inIdx)=>{const n=nodes.find(n=>n._name===name&&/transparency kit$/i.test(n._wf||''));if(n){wires.push({id:'au_'+wires.length,from:[n.id,0],to:[to,inIdx||0],kind:'',flow:3})}};
  wireTo('Store asset','aud_wait');wireTo('Store asset','aud_media');wireTo('Store asset','aud_text');wireTo('Record decision','aud_log');wireTo('Snapshot registry','aud_reg',0);
  for(const n of nodes)if(n._cls&&n._cls.isKit)wires.push({id:'ak_'+wires.length,from:[n.id,0],to:['aud_reg',0],kind:'',flow:2});
  for(const n of nodes){delete n._cls;delete n._wf;delete n._name}
  snap();S.groups=groups;S.nodes=nodes;S.wires=wires;S.notes=notes;
  // camera slots: 1 = everything, then one per group, last = the auditor
  const r=vp.getBoundingClientRect();const slot=g=>({x:g.x-60,y:g.y-60,w:g.w+120,h:g.h+120,maxK:1});
  const ga=groups.find(g=>g.id==='g_auditor'),gv=groups.find(g=>g.id==='g_audit');const right=gv?{x:Math.min(ga.x,gv.x),y:ga.y,w:Math.max(ga.x+ga.w,gv.x+gv.w)-Math.min(ga.x,gv.x),h:gv.y+gv.h-ga.y}:ga;
  S.slots={1:'fit'};S.slotNames={1:'Overview'};let s=2;for(const g of groups){if(g.id==='g_auditor'||g.id==='g_audit')continue;if(s>4)break;S.slotNames[s]=String(g.title).split('  ·  ')[0];S.slots[s++]=slot(g)}S.slots[5]=slot(right);S.slotNames[5]='What the auditor reads';if(typeof setScene==='function')setScene(null,null);
  save();build();fit();renderSlots();toast(`Imported ${wfs.length} workflow${wfs.length>1?'s':''}${reg?' + registry':''}`);return true;
}

// ---- UI: button, drag-and-drop, ?import=
const btn=document.createElement('button');btn.className='btn';btn.id='n8nimport';btn.title='Import n8n workflow JSON (several files at once; add the Transparency Kit registry.json to paint statuses)';btn.textContent='Import n8n';
const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';inp.multiple=true;inp.style.display='none';
btn.onclick=()=>inp.click();
inp.onchange=async()=>{const parsed=[];for(const f of inp.files){try{parsed.push(JSON.parse(await f.text()))}catch(e){toast(f.name+' is not JSON')}}if(parsed.length)importN8n(parsed);inp.value=''};
const bar=document.getElementById('bar');bar.insertBefore(btn,document.getElementById('json'));bar.appendChild(inp);
vp.addEventListener('dragover',e=>{e.preventDefault()});
vp.addEventListener('drop',async e=>{e.preventDefault();const parsed=[];for(const f of e.dataTransfer.files){try{parsed.push(JSON.parse(await f.text()))}catch(x){}}if(parsed.length)importN8n(parsed)});
const q=new URLSearchParams(location.search);
if(q.get('import')){fetch(q.get('import')).then(r=>r.json()).then(j=>{if(importN8n([j])){if(q.get('slot'))setTimeout(()=>gotoSlot(+q.get('slot')),300);if(q.get('pres'))document.getElementById('app').classList.add('pres');if(q.get('flow')==='0')setFlow(false)}}).catch(()=>toast('Could not load '+q.get('import')))}
window.importN8n=importN8n;
})();
