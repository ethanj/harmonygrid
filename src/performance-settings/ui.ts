/*! Copyright (c) 2026 Ethan Joffe */
import {template} from './template';
import {validateVariations,validateOutputs,type OutputSettings} from './model';
import {serializeDocument,type InstrumentDocument} from '../document/model';
import type {Settings} from '../performance/model';
export class PerformanceSettingsUI {
  private dialog=document.createElement('dialog');private original!:InstrumentDocument;
  constructor(private read:()=>InstrumentDocument,private apply:(settings:Settings,outputs:OutputSettings,thru:boolean)=>void,private blocked:()=>boolean,private device:()=>string|null){
    this.dialog.id='performance-settings';this.dialog.innerHTML=template;this.dialog.setAttribute('aria-label','Performance and MIDI settings');document.body.append(this.dialog);
    for(const id of ['mouse','midi'])for(let c=1;c<=16;c++)this.el<HTMLSelectElement>(id).add(new Option(String(c),String(c)));
    this.dialog.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>this.render()));
    this.el('cancel').onclick=()=>this.dialog.close();this.el('apply').onclick=()=>{try{const d=this.values();this.apply(d.settings,d.outputs!,d.surface.thru);this.dialog.close();}catch(e){this.el('error').textContent=(e as Error).message;}};
    document.getElementById('performance-settings-button')!.onclick=()=>this.show();
    window.addEventListener('keydown',e=>{if(this.active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.dialog.close();}},true);
  }
  get active():boolean{return this.dialog.open;}
  private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.dialog.querySelector<T>(`#perf-${id}`)!;}
  private values():InstrumentDocument {
    const d=structuredClone(this.original),number=(id:string)=>{const v=this.el<HTMLInputElement>(id).value;return v===''?NaN:Number(v);},checked=(id:string)=>this.el<HTMLInputElement>(id).checked;
    d.settings.holdNumber=number('hold');d.settings.velocity=number('velocity');d.settings.mouseChannel=number('mouse')-1;d.settings.midiChannel=number('midi')-1;d.settings.captureHoldNumber=number('capture-allowance');d.settings.captureLimit=checked('capture-limit');
    d.outputs=validateOutputs({internal:checked('internal'),generated:checked('generated'),preserveThru:checked('preserve')});d.surface.thru=checked('thru');
    const v=d.settings.variations;
    for(const k of ['multiMidi','sustainRetrigger','retainAcrossScale','sustainLimit','refreshSustainAge'] as const)v[k]=checked(k);
    v.repeatDrone=this.el<HTMLSelectElement>('repeatDrone').value as typeof v.repeatDrone;v.shortInput=this.el<HTMLSelectElement>('shortInput').value as typeof v.shortInput;validateVariations(v);serializeDocument(d);return d;
  }
  show():void {
    if(this.blocked()||this.active)return;this.original=this.read();const s=this.original.settings,o=this.original.outputs??{internal:true,generated:true,preserveThru:true};
    for(const [id,value]of Object.entries({hold:s.holdNumber,velocity:s.velocity,mouse:s.mouseChannel+1,midi:s.midiChannel+1,'capture-allowance':s.captureHoldNumber,repeatDrone:s.variations.repeatDrone,shortInput:s.variations.shortInput}))this.el<HTMLInputElement>(id).value=String(value);
    for(const [id,value]of Object.entries({'capture-limit':s.captureLimit,internal:o.internal,generated:o.generated,preserve:o.preserveThru,thru:this.original.surface.thru,...s.variations}))if(typeof value==='boolean')this.el<HTMLInputElement>(id).checked=value;
    this.dialog.querySelector('.fields')!.scrollTop=0;this.dialog.showModal();this.render();
  }
  private render():void {
    let d:InstrumentDocument;try{d=this.values();this.el('error').textContent='';}catch(e){this.el('error').textContent=(e as Error).message;this.el<HTMLButtonElement>('apply').disabled=true;this.el('draft-label').textContent='Last valid preview';return;}
    const dirty=JSON.stringify(d)!==JSON.stringify(this.original),s=d.settings,o=d.outputs!;this.el<HTMLButtonElement>('apply').disabled=!dirty;this.el('status').textContent=dirty?'Unapplied changes':'No changes';this.el('draft-label').textContent=dirty?'Draft settings':'Current settings';
    const route=(c:number)=>[o.internal?'Internal sound':null,o.generated?`MIDI channel ${c+1}`:null].filter(Boolean).join(' + ')||'No generated sound output';
    this.el('mouse-route').textContent=route(s.mouseChannel);this.el('midi-route').textContent=route(s.midiChannel);this.el('mouse-velocity').textContent=`Velocity ${s.velocity}`;
    this.el('thru-route').textContent=d.surface.thru?(o.preserveThru?'MIDI · incoming channels preserved':`MIDI channel ${s.midiChannel+1}`):'Off';
    this.el('capture-allowance-label').hidden=!s.captureLimit;
    this.el('capture-help').textContent=s.captureLimit?`Separate allowance: ${s.captureHoldNumber} auditions. Draft selections remain.`:'Off: selected capture notes sustain without eviction.';
    this.el('capture-summary').textContent=s.captureLimit?`Capture: ${s.captureHoldNumber} audition notes, independently of performance.`:'Capture: no audition eviction.';
    this.el('retention').textContent=s.variations.sustainLimit?`Sustain: up to ${s.holdNumber} retained notes, oldest released first.`:'Sustain: no musical note eviction.';
    this.el('preserve-help').textContent=o.preserveThru?'Only Thru preserves incoming channels; generated chords use the selected channel.':'Thru and MIDI-generated chords use the channel above.';
    this.el('applied').textContent=`Hold ${this.original.settings.holdNumber} · velocity ${this.original.settings.velocity}`;
    this.dialog.querySelector('.device strong')!.textContent=this.device()??'No MIDI output selected';this.dialog.querySelector('.device p')!.textContent=this.device()?'Output device selected in the playing controls.':'Routes below take effect when an output is connected.';
  }
}
