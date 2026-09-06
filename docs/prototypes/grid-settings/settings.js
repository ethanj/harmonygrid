// Design-only interaction. No audio, MIDI, application state, or file persistence.
(()=>{
const $=id=>document.getElementById(id),names=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'],note=p=>names[p%12]+(Math.floor(p/12)-1),major=[0,2,4,5,7,9,11];
const initial={horizontal:4,vertical:3,'grid-low':24,'clavier-low':48,maximum:127};let applied={...initial},lastValid={...initial};
// Explicit MIDI values avoid ambiguity between historical octave conventions.
for(const id of ['grid-low','clavier-low'])for(let p=0;p<=(id==='grid-low'?108:72);p+=12){const option=new Option(`${note(p)} · MIDI ${p}`,p);$(id).add(option);}
const values=()=>Object.fromEntries(Object.keys(initial).map(k=>[k,$(k).value===''?NaN:Number($(k).value)]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function set(v){for(const k of Object.keys(initial))$(k).value=v[k];render();}
function valid(v){if(!Number.isInteger(v.horizontal)||!Number.isInteger(v.vertical)||v.horizontal<1||v.horizontal>12||v.vertical<1||v.vertical>12)return 'Each grid interval must be a whole number from 1 to 12.';if(!Number.isInteger(v.maximum)||v.maximum<0||v.maximum>127)return 'Highest pitch must be a MIDI number from 0 to 127.';if(v.maximum<v['grid-low']||v.maximum<v['clavier-low'])return 'Highest pitch must include the lowest note of both surfaces.';return '';}
function render(){const draft=values(),error=valid(draft);$('error').textContent=error;$('apply').disabled=!!error||same(draft,applied);$('draft-status').textContent=error?'Check values':same(draft,applied)?'No changes':'Unapplied changes';$('preview-state').textContent=error?'Last valid preview':same(draft,applied)?'Current layout':'Draft layout';if(!error)lastValid={...draft};const v=lastValid;
$('layout-name').textContent=`${v.horizontal} × ${v.vertical}`;$('maximum-label').textContent=Number.isInteger(draft.maximum)&&draft.maximum>=0&&draft.maximum<=127?`${note(draft.maximum)} · MIDI ${draft.maximum}`:'Enter a MIDI pitch';
for(const b of document.querySelectorAll('[data-preset]'))b.setAttribute('aria-pressed',String(b.dataset.preset===`${draft.horizontal},${draft.vertical}`));
let svg='<svg viewBox="0 0 720 360" role="img" aria-label="Draft grid pitch layout"><defs><pattern id="off" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#334239" stroke-width="1"/></pattern></defs>';
for(let row=0;row<6;row++)for(let col=0;col<12;col++){const p=v['grid-low']+col*v.horizontal+(5-row)*v.vertical,x=col*60,y=row*60,disabled=p>v.maximum||p>127,scale=!disabled&&major.includes(p%12);svg+=`<g data-pitch="${p}" data-unavailable="${disabled}"><rect x="${x}" y="${y}" width="60" height="60" fill="${disabled?'url(#off)':scale?'#1f3025':'#141f18'}" stroke="#334738"/>`;if(!disabled&&scale)svg+=`<circle cx="${x+30}" cy="${y+30}" r="21" fill="none" stroke="${p%12===0?'#a0dfc8':'#4f7058'}"/>`;svg+=`<text x="${x+30}" y="${y+34}" text-anchor="middle" fill="${disabled?'#58695e':scale?'#c6dbc8':'#819586'}" font-size="12">${p<=127?note(p):'—'}</text></g>`;}
$('grid-preview').innerHTML=svg+'</svg>';
const low=v['clavier-low'],high=Math.min(127,low+36),whites=[];for(let p=low;p<=high;p++)if([0,2,4,5,7,9,11].includes(p%12))whites.push(p);
let keys='<svg viewBox="0 0 720 90" preserveAspectRatio="none" role="img" aria-label="Draft clavier register">';const w=720/whites.length;
for(const [i,p]of whites.entries())keys+=`<rect x="${i*w}" y="0" width="${w-1}" height="90" fill="${p>v.maximum?'#3a463c':'#c3ccbe'}"/><text x="${(i+.5)*w}" y="80" text-anchor="middle" fill="#294332" font-size="10">${p%12===0?note(p):''}</text>`;
for(let p=low;p<=high;p++)if([1,3,6,8,10].includes(p%12)){const i=whites.filter(n=>n<p).length;keys+=`<rect x="${i*w-w*.3}" y="0" width="${w*.6}" height="55" fill="${p>v.maximum?'#303b32':'#111d16'}"/>`;}
$('clavier-preview').innerHTML=keys+'</svg>';$('clavier-range').textContent=`${note(low)}–${note(high)} · MIDI ${low}–${high}`;
$('applied').textContent=`${applied.horizontal} × ${applied.vertical} · grid ${note(applied['grid-low'])} · clavier ${note(applied['clavier-low'])} · max ${note(applied.maximum)}`;
}
for(const k of Object.keys(initial))$(k).addEventListener('input',render);
for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>{const [h,v]=b.dataset.preset.split(',');$('horizontal').value=h;$('vertical').value=v;render();};
$('cancel').onclick=()=>{set(applied);$('draft-status').textContent='Changes discarded';};$('apply').onclick=()=>{if(valid(values()))return;applied={...values()};render();$('draft-status').textContent='Applied to preview';};
const scene=new URLSearchParams(location.search).get('scene');const scenes={fifths:{horizontal:5,vertical:7},octaves:{horizontal:1,vertical:12},ceiling:{maximum:72},invalid:{horizontal:13},register:{'grid-low':48,'clavier-low':60}};set({...initial,...scenes[scene]});
})();
