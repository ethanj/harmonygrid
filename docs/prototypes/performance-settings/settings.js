// Design-only state; no live instrument, MIDI access, audio, or file writes.
(()=>{
const $=id=>document.getElementById(id),numbers=['hold','velocity','mouse','midi'],checks=['capture-limit','internal','generated','thru','preserve'];
for(const id of ['mouse','midi'])for(let channel=1;channel<=16;channel++)$(id).add(new Option(String(channel),String(channel)));
const initial={hold:32,velocity:96,mouse:1,midi:1,'capture-limit':false,internal:true,generated:true,thru:false,preserve:false};let applied={...initial},lastValid={...initial};
function values(){return Object.fromEntries([...numbers.map(k=>[k,$(k).value===''?NaN:Number($(k).value)]),...checks.map(k=>[k,$(k).checked])]);}
function set(v){for(const k of numbers)$(k).value=v[k];for(const k of checks)$(k).checked=v[k];render();}
function validate(v){if(!Number.isInteger(v.hold)||v.hold<0||v.hold>128)return 'Hold Number must be a whole number from 0 to 128.';if(!Number.isInteger(v.velocity)||v.velocity<1||v.velocity>127)return 'Mouse velocity must be a whole number from 1 to 127.';if([v.mouse,v.midi].some(n=>!Number.isInteger(n)||n<1||n>16))return 'Choose MIDI channels from 1 to 16.';return '';}
const signature=v=>JSON.stringify(v);
function render(){const v=values(),error=validate(v),dirty=signature(v)!==signature(applied);if(!error)lastValid={...v};const p=lastValid;
$('error').textContent=error;$('apply').disabled=!!error||!dirty;$('status').textContent=error?'Check values':dirty?'Unapplied changes':'No changes';$('draft-label').textContent=error?'Last valid preview':dirty?'Draft settings':'Current settings';
$('mouse-velocity').textContent=`Velocity ${p.velocity}`;
const route=channel=>[p.internal?'Internal sound':null,p.generated?`MIDI channel ${channel}`:null].filter(Boolean).join(' + ')||'No generated sound output';
$('mouse-route').textContent=route(p.mouse);$('midi-route').textContent=route(p.midi);$('thru-route').textContent=p.thru?(p.preserve?'MIDI · incoming channels preserved':`MIDI channel ${p.midi}`):'Off';
$('preserve-help').textContent=v.preserve?'On: only Thru keeps incoming channels; generated chords still use the selected channel.':'Off: Thru and MIDI-generated chords use the channel above.';
$('capture-help').textContent=v['capture-limit']?`On: a separate allowance of ${Number.isInteger(v.hold)?v.hold:'…'} audition notes. Every selected pitch stays in the draft.`:'Off: selected capture notes sustain without eviction.';
$('retention').textContent=p.hold===0?'Sustain retains no extra notes. Hold and Drone keep their own notes.':`Sustain: up to ${p.hold} retained notes, oldest released first.`;
$('capture-summary').textContent=p['capture-limit']?`Capture: separate allowance of ${p.hold} audition notes; draft selections remain.`:'Capture: no audition eviction.';
$('applied').textContent=`Hold ${applied.hold} · velocity ${applied.velocity} · channels ${applied.mouse} / ${applied.midi}`;
}
for(const id of [...numbers,...checks])$(id).addEventListener('input',render);
$('cancel').onclick=()=>{set(applied);$('status').textContent='Changes discarded';};$('apply').onclick=()=>{if(validate(values()))return;applied={...values()};render();$('status').textContent='Applied to preview';};
const scene=new URLSearchParams(location.search).get('scene');const scenes={routing:{mouse:2,midi:4,thru:true},preserve:{mouse:2,midi:4,thru:true,preserve:true},external:{internal:false,mouse:2,midi:4,thru:true},capture:{hold:16,'capture-limit':true},invalid:{velocity:0}};set({...initial,...scenes[scene]});if(scene==='variations')document.querySelector('.fields').scrollTop=9999;
})();
