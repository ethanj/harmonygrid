// Interactive design fixtures only: no audio, MIDI, file writes, or engine integration.
(()=>{
 const params=new URLSearchParams(location.search),scene=Number(params.get('scene')||1);
 const labels=['No eviction','Optional limit','Empty start','Naming','Empty finish','Mode capture'];
 const rootEl=document.getElementById('instrument');
 const preexisting=[48,55,64],holdNumber=2;
 let kind=scene===6?'mode':'chord',phase=scene===4?'naming':scene===5?'playing':'collect';
 let picked=scene===3||scene===5?[]:scene===6?[60,62,64,67,69,72]:[64,67,71,72];
 let reference=scene===3?null:60,limited=false,activeCaptureKey=null;
 let notice=scene===5?'No pitches selected':'',noticeTimer=null,slot=6,draftName=scene===6?'Open pent':'Open maj7';
 const chromatic=Array.from({length:12},(_,i)=>i),unique=ns=>[...new Set(ns)];
 const audition=()=>phase==='collect'?(limited?picked.slice(-holdNumber):[...picked]):[];
 const sounding=()=>unique([...preexisting,...audition()]);
 const pitchText=ns=>ns.map(note).join(' · ');
 const interval=p=>p-reference>0?'+'+(p-reference):String(p-reference);
 const appHeader=()=>`<header class="app-header"><div class="brand">${logo}harmony grid<small>Ⅰ</small></div><nav class="app-menu"><button data-action="start-chord">Make chord · N</button><button data-action="start-mode">Make mode · M</button></nav><div class="header-right"><span class="document-title"><strong>Open Voicings</strong></span><span class="sound-select">Organ</span></div></header>`;

 function pitchSurfaces(){
  const snapshot={base:36,axes:[4,3],root:reference===null?-1:reference%12,scale:chromatic,played:[],held:sounding(),filtered:[],midi:[],anchor:reference??-1};
  const fragment=document.createElement('div');
  fragment.innerHTML=`<div class="capture-grid">${grid(snapshot,{cols:14,rows:6,base:36,id:'capture-revision'})}</div><div class="capture-tools"><strong>Clavier <span class="muted">C3–C6</span></strong><span>Raw pitch selection</span></div><div class="capture-clavier">${keyboard(snapshot)}</div>`;
  fragment.querySelectorAll('[data-pitch],[data-key]').forEach(el=>{
   const p=Number(el.dataset.pitch??el.dataset.key),selected=picked.includes(p);
   el.dataset.selected=String(selected);el.dataset.audition=String(audition().includes(p));el.dataset.performance=String(preexisting.includes(p));
   if(!selected)return;
   const base=el.querySelector('rect'),mark=document.createElementNS('http://www.w3.org/2000/svg','rect');
   if(el.hasAttribute('data-pitch')){
    for(const [k,v] of Object.entries({x:+base.getAttribute('x')+2,y:+base.getAttribute('y')+2,width:56,height:56,fill:'none',stroke:'#a0dfc8','stroke-width':1.8}))mark.setAttribute(k,v);
   }else{
    for(const [k,v] of Object.entries({x:+base.getAttribute('x')+3,y:5,width:+base.getAttribute('width')-6,height:4,rx:1,fill:'#254c3a',stroke:'#a0dfc8','stroke-width':1}))mark.setAttribute(k,v);
   }
   mark.setAttribute('data-selection-mark','true');mark.style.pointerEvents='none';el.append(mark);
  });
  return fragment.innerHTML;
 }
 function captureView(){
  const a=audition(),pc=reference===null?[]:unique(picked.map(p=>(p-reference+120)%12)).sort((x,y)=>x-y);
  return `${appHeader()}<div class="capture-layout ${kind==='mode'?'mode-capture':''}"><section class="capture-stage"><div class="step-heading"><div><div class="eyebrow">Make ${kind} <kbd>${kind==='mode'?'M':'N'}</kbd></div><h1>Choose your pitches</h1><p>Select a pitch to add it. Select it again to remove it.</p></div><div class="steps"><b>1</b> Collect <i></i><span>2</span> Name & slot</div></div><div class="capture-tools"><strong>Solo / Chromatic · Auto Button off</strong><span class="audition-count">${picked.length} selected · ${a.length} auditioning</span></div>${pitchSurfaces()}<div class="capture-legend"><span><i class="selection"></i>Selected in draft</span><span><i></i>Sounding</span><span><i class="reference"></i>Reference pitch class</span></div><div class="performance-strip"><div><strong>Performance continues · C3 · G3 · E4</strong><br><span>Drone: C3, G3 · Sustain: E4</span></div><span>Capture does not replace these notes.</span></div></section><aside class="capture-panel"><div class="panel-title"><h3>Your ${kind}</h3><span class="count">${picked.length} selected</span></div><div class="reference-card"><span class="mini-label">${kind==='mode'?'Root':'Anchor'} · fixed reference</span><strong>${reference===null?'Not set yet':note(reference)}</strong><p class="small">${reference===null?'Your first selection sets the reference.':picked.includes(reference)?'Keeps its pitch even if you remove it.':'Not selected. Still the reference.'}</p></div><div class="note-list">${picked.map(p=>`<div class="note-row" data-row-pitch="${p}"><strong>${note(p)}</strong><div class="pitch-detail"><span>${interval(p)} semitones</span><b class="${a.includes(p)?'':'silent'}">${a.includes(p)?preexisting.includes(p)?'Audition + performance':'Auditioning':preexisting.includes(p)?'Performance only':'Selected · silent'}</b></div><button data-remove="${p}" aria-label="Remove ${note(p)}">×</button></div>`).join('')||'<p class="capture-empty">No pitches selected.<br>The notes already sounding stay outside this draft.</p>'}</div>${kind==='mode'&&pc.length?`<div class="mode-result"><span class="mini-label">${pc.length} mode tones · octaves combined</span><div class="mode-tones">${pc.map(p=>`<span>${NAMES[(p+reference)%12]}</span>`).join('')}</div></div>`:''}<section class="capture-settings" aria-label="Capture audition settings" ${phase!=='collect'?'aria-disabled="true"':''}><label><input id="capture-limit" type="checkbox" ${limited?'checked':''} ${phase!=='collect'?'disabled':''}>Limit capture audition notes</label><p>${limited?'Oldest audition notes stop; every pitch stays selected.':'Off by default. Selected notes sustain without eviction.'}</p>${limited?`<div class="allowance"><span>Separate capture allowance</span><strong>Hold Number · ${holdNumber}</strong></div>`:''}</section><div class="panel-foot"><p class="small muted">${phase==='collect'?`Release ${kind==='mode'?'M':'N'} to finish. Audition notes stop when collection ends.`:'Collection ended. Only the earlier performance sounds.'}</p><button class="action primary" data-action="finish" ${picked.length?'':'disabled'}>Name & choose slot →</button><button class="cancel" data-action="cancel">Cancel collection · Esc</button></div></aside></div>`;
 }
 function namingView(){
  const names=kind==='mode'?['Chromatic','Major','Natural minor','Harmonic minor','Melodic minor','Pentatonic','Whole tone','Dorian','Mixolydian','Blues']:['Solo','Mm triad','Major','Minor','Dominant 7','Major 7','Minor 7','Mm7','Extended','Octaves'];
  return `<div class="shade naming"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="dialog-head"><div class="eyebrow">Make ${kind} · 2 of 2</div><h1 id="dialog-title">Name & choose a slot</h1><p class="small muted">Choose a slot with 2–0, then press Tab to enter a name.</p></header><div class="dialog-body"><div class="audition-ended"><strong>Capture audition stopped</strong><br>The earlier performance continues: C3 · G3 · E4.</div><div class="field"><label for="pattern-name">${kind==='mode'?'Mode':'Chord'} name</label><input id="pattern-name"></div><div class="field"><label>Keyboard slot</label><div class="slot-picker">${names.map((n,i)=>`<button data-slot="${(i+1)%10}" ${i===0?'disabled':''} class="${slot===(i+1)%10?'selected':''}" title="${n}">${(i+1)%10}</button>`).join('')}</div><div class="replacement">Replaces <strong>slot ${slot} · ${names[slot===0?9:slot-1]}</strong>. Slot 1 is protected.</div></div><div class="summary-row"><span>${kind==='mode'?'Root':'Anchor'}</span><strong>${note(reference)}${picked.includes(reference)?'':' · not selected'}</strong></div><div class="selected-notes">${picked.map(p=>`<span>${note(p)}</span>`).join('')}</div><p class="small muted">${kind==='mode'?unique(picked.map(p=>(p-reference+120)%12)).length+' mode tones; octave equivalents combine.':'Intervals: '+picked.map(interval).join(' · ')+' semitones.'}</p></div><footer class="dialog-foot actions"><button class="action left" data-action="edit">← Edit pitches</button><button class="action" data-action="cancel">Cancel</button><button class="action primary" data-action="replace">Replace ${kind}</button></footer></section></div>`;
 }
 function showNotice(message){notice=message;clearTimeout(noticeTimer);if(!params.has('qa'))noticeTimer=setTimeout(()=>{notice='';render();},5000);}
 function finish(){if(!picked.length){phase='playing';showNotice('No pitches selected');}else phase='naming';activeCaptureKey=null;render();}
 function start(nextKind){kind=nextKind;phase='collect';picked=[];reference=null;notice='';clearTimeout(noticeTimer);render();}
 function toggle(p){if(phase!=='collect')return;if(picked.includes(p))picked=picked.filter(n=>n!==p);else{if(reference===null)reference=p;picked.push(p);}render();}
 function render(){
  if(phase==='playing'){
   rootEl.innerHTML=surface({...S['1'],played:[],filtered:[],held:preexisting,controls:['Sustain','Drone']});
   rootEl.querySelector('.app-header').outerHTML=appHeader();
  }else rootEl.innerHTML=captureView()+(phase==='naming'?namingView():'');
  document.querySelector('.capture-notice')?.remove();
  if(notice){const el=document.createElement('div');el.className='capture-notice';el.setAttribute('role','status');el.innerHTML=`<div><strong>${notice}</strong><p>No chord or mode changed.</p></div><button data-dismiss>Dismiss</button>`;rootEl.querySelector('.header-right').before(el);el.querySelector('button').onclick=()=>{notice='';clearTimeout(noticeTimer);render();};}
  document.getElementById('review-bar').innerHTML=`<span class="review-label">DESIGN 03 · NO AUDIO</span><nav class="review-nav">${labels.map((label,i)=>`<a href="?scene=${i+1}" class="${scene===i+1?'active':''}">${i+1} ${label}</a>`).join('')}</nav><span class="review-caption">Illustrated sound states · Screens reset on entry</span>`;
  rootEl.querySelectorAll('[data-pitch],[data-key]').forEach(el=>el.onclick=()=>toggle(Number(el.dataset.pitch??el.dataset.key)));
  rootEl.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>toggle(+el.dataset.remove));
  rootEl.querySelectorAll('[data-slot]').forEach(el=>el.onclick=()=>{slot=+el.dataset.slot;render();});
  const input=rootEl.querySelector('#pattern-name');if(input){input.value=draftName;input.oninput=()=>{draftName=input.value;};}
  const limit=rootEl.querySelector('#capture-limit');if(limit)limit.onchange=()=>{limited=limit.checked;render();};
  rootEl.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{
   const action=el.dataset.action;
   if(action==='start-chord'||action==='start-mode'){const nextKind=action==='start-mode'?'mode':'chord';if(phase==='collect'){kind=nextKind;render();}else start(nextKind);}
   if(action==='finish')finish();
   if(action==='cancel'){phase='playing';picked=[];activeCaptureKey=null;showNotice('Capture canceled');render();}
   if(action==='edit'){phase='collect';render();}
   if(action==='replace'){showNotice('Preview only — replacement is not saved');render();}
  });
  const modal=rootEl.querySelector('.dialog');
  if(modal){rootEl.querySelector('.capture-layout').inert=true;rootEl.querySelector('.app-header').inert=true;modal.querySelector(`[data-slot="${slot}"]`).focus();}
  document.title='Harmony Grid — Capture revision — '+labels[scene-1];
  window.captureFixture={state:String(scene),phase,kind,picked:[...picked],reference,limited,holdNumber,audition:audition(),preexisting:[...preexisting],sounding:sounding(),notice};
 }
 document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if(phase==='naming'&&key==='tab'){
   const modal=rootEl.querySelector('.dialog'),focusables=[...modal.querySelectorAll('button:not(:disabled),input')];
   if(e.target.hasAttribute('data-slot')&&!e.shiftKey){e.preventDefault();modal.querySelector('input').focus();return;}
   const i=focusables.indexOf(document.activeElement);
   if(e.shiftKey&&i<=0){e.preventDefault();focusables.at(-1).focus();return;}
   if(!e.shiftKey&&i===focusables.length-1){e.preventDefault();focusables[0].focus();return;}
  }
  if(key==='escape'&&phase!=='playing'){e.preventDefault();phase='playing';picked=[];activeCaptureKey=null;showNotice('Capture canceled');render();return;}
  if(e.target.matches('input,textarea,select'))return;
  if(phase==='naming'&&/^[02-9]$/.test(key)){e.preventDefault();slot=Number(key);render();return;}
  if((key==='n'||key==='m')&&!e.repeat&&phase!=='naming'){
   e.preventDefault();if(phase==='playing')start(key==='m'?'mode':'chord');else kind=key==='m'?'mode':'chord';activeCaptureKey=key;render();
  }
  if(key==='escape'&&phase!=='playing'){e.preventDefault();phase='playing';picked=[];activeCaptureKey=null;showNotice('Capture canceled');render();}
 });
 document.addEventListener('keyup',e=>{if(e.key.toLowerCase()===activeCaptureKey&&phase==='collect')finish();});
 render();
 if(notice&&!params.has('qa'))showNotice(notice);
 // Read-only layout and pitch witnesses for the dedicated artifact renderer.
 window.captureQA=()=>{
  const area=rootEl.getBoundingClientRect(),scope=rootEl.querySelector('.dialog')||rootEl;
  const checked=[...scope.querySelectorAll('button,input,h1,h2,h3,p,.performance-strip,.capture-legend,.capture-settings')];
  const outside=checked.filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.left<area.left-1||r.right>area.right+1||r.top<area.top-1||r.bottom>area.bottom+1);}).map(el=>el.textContent||el.id);
  const controlOverflow=checked.filter(el=>el.clientWidth&&el.scrollWidth>el.clientWidth+2).map(el=>el.textContent||el.id);
  const flags=selector=>[...rootEl.querySelectorAll(selector)].map(el=>({pitch:Number(el.dataset.pitch??el.dataset.key),selected:el.dataset.selected==='true',sounding:el.dataset.sounding==='true',audition:el.dataset.audition==='true',performance:el.dataset.performance==='true'}));
  return {...window.captureFixture,viewport:{width:innerWidth,height:innerHeight},outside,controlOverflow,documentHeight:document.documentElement.scrollHeight,cells:flags('[data-pitch]'),keys:flags('[data-key]')};
 };
 if(params.has('qa'))setTimeout(()=>{const out=document.createElement('script');out.type='application/json';out.id='capture-qa';out.textContent=JSON.stringify(window.captureQA());document.body.append(out);},150);
})();
