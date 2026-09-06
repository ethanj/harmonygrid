// Fixed design fixtures only. No audio, MIDI access, musical scheduler, or live playing.
const NAMES=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const MAJOR=[0,2,4,5,7,9,11], MINOR=[0,2,3,5,7,8,10];
const note=n=>NAMES[((n%12)+12)%12]+(Math.floor(n/12)-1);
const S={
  '1':{id:'01-playing-surface',title:'Play',root:0,mode:'Major',scale:MAJOR,axes:[4,3],base:24,anchor:60,played:[60,64,67],filtered:[63],held:[],midi:[],chord:2,metro:false,controls:[],caption:'Full chord shape · C4–E4–G4 sound; E♭4 is filtered.'},
  '2':{id:'02-filtered-chord',title:'Filter',root:0,mode:'Major',scale:MAJOR,axes:[4,3],base:36,anchor:71,played:[71,74],filtered:[75,78],held:[],midi:[],chord:2,metro:true,controls:[],caption:'On B4, E♭5 and G♭5 are filtered. The fifth disappears; its position stays visible.'},
  '3':{id:'03-retained-notes',title:'Retain',root:0,mode:'Natural minor',scale:MINOR,axes:[2,1],base:48,anchor:60,played:[60,63,67],filtered:[64],held:[64,71],midi:[],chord:2,metro:true,controls:['Sustain','Drone'],caption:'E4 is filtered from this chord but retained by Sustain. B4 continues from Drone.'},
  '4':{id:'04-tick-transition',title:'Timing',caption:'Static storyboard · Sound and chord display change together on the tick. No between-tick preview.'},
  '5':{id:'05-midi-and-controls',title:'MIDI',root:0,mode:'Major',scale:MAJOR,axes:[4,3],base:24,anchor:76,played:[67,71,74,76],filtered:[70],held:[],midi:[48,52,67],chord:2,metro:true,controls:['Hold'],caption:'MIDI input: C3, E3, G4. G4 drives accompaniment; the mouse plays E5 independently.'}
};
const query=new URLSearchParams(location.search);
const selected=S[query.get('state')]?query.get('state'):'1';
const state=S[selected];
const logo=`<svg width="23" height="23" viewBox="0 0 23 23" aria-hidden="true"><g fill="none" stroke="#789b84"><rect x="1" y="1" width="9" height="9" rx="1"/><rect x="13" y="1" width="9" height="9" rx="1"/><rect x="1" y="13" width="9" height="9" rx="1"/></g><circle cx="5.5" cy="17.5" r="3" fill="#a0dfc8"/><circle cx="17.5" cy="5.5" r="3" fill="#a0dfc8"/><circle cx="17.5" cy="17.5" r="4" fill="#a0dfc8"/></svg>`;
const header=()=>`<header class="app-header"><div class="brand">${logo}harmony grid<small>Ⅰ</small></div><nav class="app-menu" aria-label="Illustrated application menus"><span>File</span><span>Edit</span><span>Options</span><span>Operations</span><span>MIDI</span><span>Help</span></nav><div class="header-right"><div class="document-title">Document &nbsp; <b>Harmony study</b></div><button class="sound-select" disabled>Electric piano <span class="quiet">⌄</span></button></div></header>`;
function controls(s){return [['Sustain','Space'],['Hold','G'],['Drone','Y'],['Repeat','D']].map(([n,k])=>`<button disabled class="control ${s.controls.includes(n)?'active':''}">${n}<kbd>${k}</kbd></button>`).join('');}
function sidebar(s){
 const modes=['Chromatic','Major','Natural minor','Harmonic minor','Melodic minor','Pentatonic','Whole tone','Dorian','Mixolydian','Blues'];
 return `<aside class="sidebar"><section><div class="eyebrow">Scale root</div><div class="scale-heading"><div><span class="tonic">C</span><span class="scale-name">${s.mode}</span></div><kbd>Tab</kbd></div><div class="scale-sub"><span>Set root at pointer</span><span>♭</span></div></section><section><div class="section-head"><span class="eyebrow">Modes</span><span class="hint">Shift / Caps + 0–9</span></div><div class="modes">${modes.map((n,i)=>`<button class="mode ${n===s.mode?'active':''}" disabled><span class="radio"></span>${n}<span class="slot">${(i+1)%10}</span></button>`).join('')}</div></section><section class="separator"><div class="section-head"><span class="eyebrow">Performance</span><span class="hint">⌘ to latch*</span></div><div class="performance">${controls(s)}</div><div class="control-note">F toggles Sustain · Y toggles Drone<br>* Hold and Repeat: ⌘ + key</div></section><section class="metronome"><div class="section-head"><span class="eyebrow">Metronome</span><kbd>T</kbd></div><div class="tempo-readout"><span class="rate">240</span><span class="units">ticks<br>/ min</span><span class="metro-state">${s.metro?'ON':'OFF'}<span class="pulses"><i class="pulse lit"></i><i class="pulse"></i></span></span></div><div class="tempo-keys">${[['½','Q'],['2×','W'],['⅔','E'],['³⁄₂','R']].map(([v,k])=>`<button disabled class="tempo-key"><span>${v}</span><kbd>${k}</kbd></button>`).join('')}</div><div class="tempo-bottom"><span><kbd>A</kbd> −1 &nbsp; <kbd>S</kbd> +1</span><span>⌘ to latch</span></div></section></aside>`;
}
const mini=`<svg class="mini-shape" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="13" r="2.5"/><circle cx="13" cy="13" r="2.5"/><circle cx="13" cy="5" r="2.5"/></g><rect x="2.5" y="2.5" width="5" height="5" fill="none" stroke="currentColor" stroke-dasharray="1 1"/></svg>`;
function chords(s){return `<div class="chord-head"><span class="eyebrow">Chords</span><span>0–9 select chord &nbsp; · &nbsp; N make chord &nbsp; · &nbsp; M make mode</span></div><div class="chords">${['Solo','Mm triad','Major','Minor','Dominant 7','Major 7','Minor 7','Mm7','Counterpoint','Octaves'].map((n,i)=>`<button disabled class="chord ${(i+1)%10===s.chord?'active':''}"><span class="slot">${(i+1)%10}</span>${n}${(i+1)%10===s.chord?mini:''}</button>`).join('')}</div>`;}
function grid(s,opts={}){
 const cols=opts.cols||18,rows=opts.rows||(innerWidth>=1450?8:7),base=opts.base??s.base,step=60;
 const ax=opts.axes||s.axes, sound=new Set([...s.played,...s.held]), candidate=new Set([...s.played,...s.filtered]), midiPC=new Set(s.midi.map(n=>n%12));
 const w=cols*step,h=rows*step,id=opts.id||'main';
 let content=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${ax[0]} by ${ax[1]} harmony grid. Sounding ${[...sound].map(note).join(', ')}. Filtered ${s.filtered.map(note).join(', ')}."><defs><pattern id="hatch-${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="8" stroke="#c29660" stroke-width="1" opacity=".48"/></pattern></defs><rect width="${w}" height="${h}" fill="#141e17"/>`;
 const cells=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const n=base+c*ax[0]+(rows-1-r)*ax[1], x=c*step,y=r*step,onScale=s.scale.includes((n-s.root+120)%12),root=n%12===s.root,played=sound.has(n),filter=s.filtered.includes(n),chord=candidate.has(n),raw=s.midi.includes(n),pc=midiPC.has(n%12);
  cells.push({n,c,r,x,y});
  content+=`<g data-pitch="${n}" data-sounding="${played}" data-filtered="${filter}" data-scale="${onScale}"><rect x="${x}" y="${y}" width="60" height="60" fill="${pc?'#344839':onScale?'#1b2920':'#152019'}" stroke="#334738" stroke-width=".8"/>`;
  if(chord)content+=`<rect x="${x+1}" y="${y+1}" width="58" height="58" fill="${filter?`url(#hatch-${id})`:'#66835a22'}" stroke="${filter?'#b68d5a':'#82b090'}" stroke-width="1.4"/>`;
  if(raw)content+=`<path d="M${x+3} ${y+13}V${y+3}H${x+13}M${x+47} ${y+3}H${x+57}V${y+13}M${x+3} ${y+47}V${y+57}H${x+13}M${x+47} ${y+57}H${x+57}V${y+47}" stroke="#e1eadd" fill="none" stroke-width="2.3"/>`;
  if(onScale||played)content+=`<circle cx="${x+30}" cy="${y+30}" r="${played?21:20}" fill="${played?'#a0dfc8':'none'}" stroke="${played?'#a0dfc8':root?'#a0c6a4':'#45684d'}" stroke-width="${root?1.6:1.1}"/>`;
  if(root)content+=`<circle cx="${x+30}" cy="${y+30}" r="24" fill="none" stroke="#9ac2a0" stroke-width="1.25"/>`;
  content+=`<text x="${x+30}" y="${y+35}" text-anchor="middle" fill="${played?'#123626':filter?'#efc693':root?'#c4dfbf':onScale?'#a6bba5':'#7f947f'}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="16" font-weight="${played?650:450}">${NAMES[n%12]}<tspan font-size="11" dy="1" opacity=".8">${Math.floor(n/12)-1}</tspan></text></g>`;
 }
 const desired=opts.pointer??s.anchor;
 const candidates=cells.filter(c=>c.n===desired).sort((a,b)=>Math.abs(a.c-cols*.5)+Math.abs(a.r-rows*.4)-Math.abs(b.c-cols*.5)-Math.abs(b.r-rows*.4));
 if(candidates.length){const p=candidates[0],x=p.x+48,y=p.y+47;content+=`<g aria-label="Pointer at ${note(desired)}"><circle cx="${x}" cy="${y}" r="9" fill="#17261c" stroke="#e7efdf" stroke-width="1.3"/><path d="M${x-5} ${y}h10M${x} ${y-5}v10" stroke="#e7efdf" stroke-width="1.4"/></g>`;}
 content+='</svg>';return content;
}
function keyboard(s){
 const low=48,high=84,white=[0,2,4,5,7,9,11],whiteNotes=[];
 for(let n=low;n<=high;n++)if(white.includes(n%12))whiteNotes.push(n);
 const count=whiteNotes.length,w=960,kw=w/count,sound=new Set([...s.played,...s.held]);
 let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 96" preserveAspectRatio="none" role="img" aria-label="Clavier from C3 through C6"><defs><pattern id="key-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="5" stroke="#ba8743" stroke-width="1.6"/></pattern></defs>`;
 const draw=(n,x,bw,bh,black)=>{
  const played=sound.has(n),filter=s.filtered.includes(n),raw=s.midi.includes(n),sc=s.scale.includes((n-s.root+120)%12),root=n%12===s.root;
  let z=`<g data-key="${n}" data-sounding="${played}" data-filtered="${filter}" data-scale="${sc}"><rect x="${x+.7}" y="0" width="${bw-1.4}" height="${bh}" rx="1.5" fill="${played?'#a0dfc8':black?'#18221b':'#c3ccbe'}" stroke="${black?'#09130c':'#6c7c68'}" stroke-width="1"/>`;
  if(filter)z+=`<rect x="${x+2}" y="1" width="${bw-4}" height="${played?9:bh-2}" fill="url(#key-hatch)"/>`;
  if(raw)z+=`<rect x="${x+4}" y="4" width="${bw-8}" height="6" fill="${played||!black?'#304d37':'#dfe8d9'}"/>`;
  if(sc)z+=`<circle cx="${x+bw/2}" cy="${bh-22}" r="3.8" fill="${root?'#365541':'none'}" stroke="${played||!black?'#486b51':'#9cae97'}" stroke-width="1"/>`;
  if(n%12===0||played||filter)z+=`<text x="${x+bw/2}" y="${bh-7}" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="10" font-weight="550" fill="${played||!black?'#294332':'#cfbc93'}">${note(n)}</text>`;
  return z+'</g>';
 };
 whiteNotes.forEach((n,i)=>out+=draw(n,i*kw,kw,96,false));
 for(let n=low;n<=high;n++)if(!white.includes(n%12)){const before=whiteNotes.filter(k=>k<n).length;out+=draw(n,before*kw-kw*.3,kw*.6,59,true);}
 return out+'</svg>';
}
function legend(s){return `<div class="legend"><span class="legend-item"><i class="legend-mark"></i>Scale</span><span class="legend-item"><i class="legend-mark root"></i>Root</span><span class="legend-item"><i class="legend-mark sounding"></i>Sounding</span><span class="legend-item"><i class="legend-mark filtered"></i>Filtered chord tone</span>${s.midi.length?'<span class="legend-item"><i class="legend-mark midi"></i>MIDI pitch</span><span class="legend-item"><i class="legend-mark pitchclass"></i>Pitch class</span>':''}<span class="lead">Lead &nbsp; ${note(s.anchor)}</span></div>`;}
function surface(s){return `${header()}<div class="workspace">${sidebar(s)}<section class="playing-area">${chords(s)}<div class="grid-head"><div class="left"><strong>Harmony grid</strong><span class="axis">→ ${s.axes[0]} &nbsp; ↑ ${s.axes[1]}</span>${s.midi.length?'<div class="midi-controls"><span>Play Chords</span><span>Mouse Solo</span><span>Thru</span><span class="off">Sets Root off</span></div>':`<span>${s.axes[0]===2?'Whole steps / half steps':'Major thirds / minor thirds'}</span>`}</div><div class="right"><span class="small-switch"><i class="switch-dot"></i>Auto Button</span><span>Set axes ⌄</span></div></div><div class="grid-frame">${grid(s)}</div><div class="clavier-head"><div class="left"><span class="eyebrow">Clavier</span><span>C3 – C6</span></div><div class="right"><span>Smooth Clavier &nbsp; ○</span><span>Show &nbsp; ●</span></div></div><div class="clavier">${keyboard(s)}</div>${legend(s)}</section></div>`;}
function storyboard(){
 const c={...S['1'],base:48,axes:[4,3],anchor:60};
 const d={...c,anchor:62,played:[62,65,69],filtered:[66]};
 const stages=[
  {title:'At the tick',time:'t = 0 ms',s:c,pointer:60,desc:'The pointer is on C4. The chord and sound are committed together.',sound:'C4 · E4 · G4',filter:'E♭4',label:'C4'},
  {title:'Between ticks',time:'t = 125 ms',s:c,pointer:62,desc:'The pointer moves to D4. The chord display still shows the C4 event.',sound:'C4 · E4 · G4',filter:'E♭4',label:'D4'},
  {title:'At the next tick',time:'t = 250 ms',s:d,pointer:62,desc:'The new position is sampled. D4’s chord replaces the previous event.',sound:'D4 · F4 · A4',filter:'G♭4',label:'D4'}
 ];
 return `${header()}<section class="comparison"><div class="comparison-head"><div><div class="eyebrow">Timing study · 240 ticks / min · C Major · Mm triad</div><h1>The gesture chooses. The tick commits.</h1></div><div class="subtitle">A fixed three-frame illustration of the agreed behavior.<br>Pointer movement is not an advance preview of the chord.</div></div><div class="timeline">${stages.map((p,i)=>`<article class="stage"><div class="stage-head"><span class="stage-title">${p.title}</span><span class="stage-time">${p.time}</span></div><p class="stage-note">${p.desc}</p><div class="stage-grid">${grid(p.s,{cols:5,rows:6,base:48,axes:[4,3],id:'stage'+i,pointer:p.pointer})}</div><div class="stage-state"><div class="row"><span>Pointer</span><strong>${p.label}</strong></div><div class="row"><span>Sounding</span><strong>${p.sound}</strong></div><div class="row"><span>Filtered</span><strong class="filtered-text">${p.filter}</strong></div></div></article>`).join('')}</div><div class="timing-foot"><span><strong>No intermediate notes are queued.</strong><br>Only the current pointer position determines the next tick.</span><span>Crosshair: pointer &nbsp; · &nbsp; Filled circle: sounding<br>Striped cell: filtered member of the committed chord</span></div></section>`;
}
document.getElementById('instrument').innerHTML=selected==='4'?storyboard():surface(state);
document.getElementById('review-bar').innerHTML=`<span class="review-label">DESIGN 01 · NO AUDIO</span><nav class="review-nav" aria-label="Prototype states">${Object.entries(S).map(([k,s])=>`<a href="?state=${k}" ${k===selected?'aria-current="page"':''} class="${k===selected?'active':''}">${k.padStart(2,'0')} ${s.title}</a>`).join('')}</nav><div class="review-caption">${state.caption}</div>`;
document.title=`Harmony Grid — ${state.id} — static prototype`;
// Exposed only to the local render/QA script; this is not instrument state.
window.designFixture={state:selected,fixture:state,viewport:{width:innerWidth,height:innerHeight}};
if(query.has('qa')) setTimeout(()=>{
 const area=document.getElementById('instrument').getBoundingClientRect();
 const checked=[...document.querySelectorAll('#instrument button,#instrument .control-note,#instrument .timing-foot,#instrument .midi-controls,#instrument svg text')];
 const outside=checked.filter(el=>{const r=el.getBoundingClientRect();return r.left<area.left-1||r.right>area.right+1||r.top<area.top-1||r.bottom>area.bottom+1;}).map(el=>({tag:el.tagName,text:el.textContent.slice(0,80),bounds:el.getBoundingClientRect().toJSON()}));
 const keys=[...document.querySelectorAll('[data-key]')].map(el=>({pitch:+el.dataset.key,sounding:el.dataset.sounding==='true',filtered:el.dataset.filtered==='true',scale:el.dataset.scale==='true'}));
 const cells=[...document.querySelectorAll('[data-pitch]')].map(el=>({pitch:+el.dataset.pitch,sounding:el.dataset.sounding==='true',filtered:el.dataset.filtered==='true',scale:el.dataset.scale==='true'}));
 const result={...window.designFixture,outside,cells,keys,documentHeight:document.documentElement.scrollHeight,controlOverflow:[...document.querySelectorAll('#instrument button')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.textContent)};
 const out=document.createElement('script');out.type='application/json';out.id='design-qa';out.textContent=JSON.stringify(result);document.body.append(out);
},50);
