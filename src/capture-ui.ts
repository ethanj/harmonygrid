import {captureSeed} from './performance/capture';
import type {CaptureKind,CaptureSnapshot,Input,Snapshot} from './performance/model';
import {pitchClass} from './performance/harmony';
import {chords,modes} from './fixtures/instruments';
import {names,noteName} from './render/draw';

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const pitchList=(pitches:number[])=>pitches.map(noteName).join(' · ');

/** DOM authoring controls. Audio and canvas state always come from committed snapshots. */
export class CaptureUI {
  autoButton=false;
  private snapshot:Snapshot|null=null;
  private pendingStart=false;
  private ready:Promise<void>=Promise.resolve();
  private held=new Set<string>();
  private activeKey:string|null=null;
  private signature='';
  private generation=0;
  private lastPhase:string|null=null;
  private exitIntent:'cancel'|'finish'|'save'|null=null;
  private slot=5;
  private name='';
  private noticeTimer:ReturnType<typeof setTimeout>|null=null;
  private panel=document.createElement('aside');
  private heading=document.createElement('div');
  private performance=document.createElement('div');
  private dialog=document.createElement('dialog');
  constructor(private send:(input:Input)=>void,private startSound:()=>Promise<void>,private layout:()=>void,private save:(kind:CaptureKind,slot:number,name:string,notes:number[])=>void){
    this.panel.className='capture-panel';this.heading.className='capture-heading';this.performance.className='capture-performance';
    document.querySelector('.workspace')!.append(this.panel);
    document.querySelector('.playing-area')!.prepend(this.heading);
    document.querySelector('.playing-area')!.append(this.performance);
    this.dialog.className='capture-naming';document.body.append(this.dialog);
    document.getElementById('make-chord')!.onclick=()=>this.begin('chord');
    document.getElementById('make-mode')!.onclick=()=>this.begin('mode');
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.cancel();});
    window.addEventListener('keydown',event=>this.keydown(event),true);
    window.addEventListener('keyup',event=>{
      const key=event.key.toLowerCase();
      if(!this.held.delete(key))return;
      event.stopImmediatePropagation();
      if(key===this.activeKey){this.activeKey=null;this.finish();}
    },true);
  }
  get active():boolean{return this.pendingStart||!!this.snapshot?.capture;}
  get collecting():boolean{return this.pendingStart||this.snapshot?.capture?.phase==='collect';}
  private command(input:Input):void {const generation=this.generation;void this.ready.then(()=>{if(generation===this.generation)this.send(input);}).catch(()=>{});}
  begin(kind:CaptureKind):void {
    if(this.snapshot?.capture?.phase==='naming')return;
    if(!this.active){this.autoButton=false;this.pendingStart=true;this.name='';this.slot=5;this.exitIntent=null;this.ready=this.startSound().catch(error=>{this.pendingStart=false;throw error;});}
    this.command({type:'captureStart',kind});
  }
  editPattern(kind:CaptureKind,slot:number,name:string,notes:number[]):void {
    const seed=captureSeed(notes);this.begin(kind);this.name=name;this.slot=slot;
    this.command({type:'captureCancel'});this.command({type:'captureStart',kind,seed});
  }
  select(pitch:number):void {if(this.collecting)this.command({type:'captureSelect',pitch});}
  finish():void {if(this.collecting){this.exitIntent='finish';this.command({type:'captureFinish'});}}
  cancel():void {if(this.active){this.activeKey=null;this.exitIntent='cancel';this.command({type:'captureCancel'});}}
  reset():void {this.generation++;this.pendingStart=false;this.activeKey=null;this.held.clear();this.exitIntent=null;}
  private keydown(event:KeyboardEvent):void {
    if(document.querySelector('#file-dialog[open],#slot-editor[open],#grid-settings[open],#performance-settings[open],#help-dialog[open],#grid-status[data-editing="true"]'))return;
    const key=event.key.toLowerCase(),input=event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement;
    if(key==='escape'&&this.active){event.preventDefault();event.stopImmediatePropagation();this.cancel();return;}
    if(input)return;
    if((key==='n'||key==='m')&&!event.metaKey&&!event.ctrlKey&&!event.altKey){
      event.preventDefault();event.stopImmediatePropagation();
      if(event.repeat||this.held.has(key)||this.snapshot?.capture?.phase==='naming')return;
      this.held.add(key);this.activeKey=key;this.begin(key==='m'?'mode':'chord');return;
    }
    if(!this.active)return;
    if(this.snapshot?.capture?.phase==='naming'){
      event.stopImmediatePropagation();
      if(/^[02-9]$/.test(key)){event.preventDefault();this.slot=(Number(key)+9)%10;this.renderNaming();}
      if(key==='tab'&&!event.shiftKey&&(event.target as HTMLElement).hasAttribute('data-slot')){event.preventDefault();this.dialog.querySelector<HTMLInputElement>('input')!.focus();}
    }else if('0123456789 fgydtqweras'.includes(key)||key==='tab'){
      event.stopImmediatePropagation();
      if(key!=='tab'&&!(event.target instanceof HTMLButtonElement))event.preventDefault();
    }
  }
  update(snapshot:Snapshot):void {
    this.snapshot=snapshot;
    const capture=snapshot.capture;
    if(capture)this.pendingStart=false;
    const phase=capture?.phase??null;
    if(this.lastPhase!==phase){
      document.body.classList.toggle('capturing',!!capture);
      if(!capture&&this.lastPhase){
        if(this.exitIntent==='finish')this.notice('No pitches selected');
        if(this.exitIntent==='cancel')this.notice('Capture canceled');
        this.exitIntent=null;
      }
      if(phase!=='naming'&&this.dialog.open)this.dialog.close();
      if(phase==='naming')this.renderNaming();
      this.lastPhase=phase;this.layout();
    }
    const signature=JSON.stringify([capture,snapshot.settings.captureLimit,snapshot.settings.captureHoldNumber]);
    if(signature===this.signature)return;
    this.signature=signature;
    if(!capture)return;
    this.renderCollection(capture);
    if(phase==='naming'&&!this.dialog.open)this.renderNaming();
  }
  private renderCollection(c:CaptureSnapshot):void {
    const scroll=this.panel.querySelector('.capture-notes')?.scrollTop??0;
    const focused=this.panel.contains(document.activeElement)?(document.activeElement as HTMLElement).id:null;
    const auditions=new Set(c.audition.map(n=>n.pitch)),performance=new Set(c.performance.map(n=>n.pitch));
    const tones=c.reference===null?[]:[...new Set(c.selected.map(p=>pitchClass(p-c.reference!)))].sort((a,b)=>a-b);
    this.heading.innerHTML=`<div><span class="eyebrow">Make ${c.kind} · ${c.kind==='chord'?'N':'M'}</span><h1>Choose your pitches</h1><p>Select a pitch to add it. Select it again to remove it.</p></div><span>${c.selected.length} selected · ${auditions.size} auditioning</span>`;
    this.panel.innerHTML=`<div class="capture-panel-title"><strong>Your ${c.kind}</strong><span>${c.selected.length} selected</span></div><section class="capture-reference"><span class="eyebrow">${c.kind==='chord'?'Anchor':'Root'} · fixed reference</span><strong>${c.reference===null?'Not set yet':noteName(c.reference)}</strong><p>${c.reference===null?'Your first selection sets the reference.':c.selected.includes(c.reference)?'Keeps its pitch even if you remove it.':'Not selected. Still the reference.'}</p></section><div class="capture-notes">${c.selected.map(p=>`<div class="capture-note"><strong>${noteName(p)}</strong><span>${p-c.reference!>0?'+':''}${p-c.reference!} semitones<b>${auditions.has(p)?performance.has(p)?'Audition + performance':'Auditioning':performance.has(p)?'Performance only':'Selected · silent'}</b></span><button data-remove="${p}" aria-label="Remove ${noteName(p)}">×</button></div>`).join('')||'<p class="capture-empty">No pitches selected.<br>Earlier notes stay outside this draft.</p>'}</div>${c.kind==='mode'&&tones.length?`<div class="capture-tones"><span class="eyebrow">${tones.length} mode tones · octaves combined</span><p>${tones.map(p=>names[pitchClass(p+c.reference!)]).join(' · ')}</p></div>`:''}<section class="capture-settings"><label><input id="capture-limit" type="checkbox" ${this.snapshot!.settings.captureLimit?'checked':''}>Limit capture audition notes</label><p>${this.snapshot!.settings.captureLimit?'Oldest audition notes stop; every pitch stays selected.':'Off by default. Selected notes sustain without eviction.'}</p>${this.snapshot!.settings.captureLimit?`<p>Separate capture allowance · ${this.snapshot!.settings.captureHoldNumber}</p>`:''}</section><div class="capture-actions"><p>Release ${c.kind==='chord'?'N':'M'} to finish. Audition notes stop when collection ends.</p><button id="capture-finish" class="capture-primary" ${c.selected.length?'':'disabled'}>Name & choose slot →</button><button id="capture-cancel">Cancel collection · Esc</button></div>`;
    this.panel.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b=>b.onclick=()=>this.select(Number(b.dataset.remove)));
    this.panel.querySelector<HTMLInputElement>('#capture-limit')!.onchange=event=>this.command({type:'settings',settings:{captureLimit:(event.target as HTMLInputElement).checked}});
    this.panel.querySelector<HTMLButtonElement>('#capture-finish')!.onclick=()=>this.finish();
    this.panel.querySelector<HTMLButtonElement>('#capture-cancel')!.onclick=()=>this.cancel();
    const pitches=[...performance].sort((a,b)=>a-b),shown=pitches.slice(0,5);
    this.performance.innerHTML=`<strong>Performance continues${pitches.length?' · '+pitchList(shown)+(pitches.length>5?' · +'+(pitches.length-5)+' more':''):''}</strong><span>${pitches.length?'Capture does not replace these notes.':'No earlier notes are sounding.'}</span>`;
    this.performance.title=pitchList(pitches);
    this.panel.querySelector('.capture-notes')!.scrollTop=scroll;
    if(focused)document.getElementById(focused)?.focus({preventScroll:true});
  }
  private renderNaming():void {
    const c=this.snapshot?.capture;if(!c||c.phase!=='naming')return;
    const patterns=c.kind==='chord'?chords:modes;
    const existing=[...new Set(c.performance.map(n=>n.pitch))].slice(0,5);
    this.dialog.innerHTML=`<div class="capture-dialog-head"><span class="eyebrow">Make ${c.kind} · 2 of 2</span><h1>Name & choose a slot</h1><p>Choose a slot with 2–0, then press Tab to enter a name.</p></div><div class="capture-dialog-body"><div class="capture-ended"><strong>Capture audition stopped</strong><p>${existing.length?'The earlier performance continues: '+pitchList(existing)+'.':'No earlier notes are sounding.'}</p></div><label class="capture-name">${c.kind==='chord'?'Chord':'Mode'} name<input id="capture-name" autocomplete="off"></label><label>Keyboard slot</label><div class="capture-slots">${patterns.map((p,i)=>`<button data-slot="${i}" title="${escape(p.name)}" ${i===0?'disabled':''} class="${i===this.slot?'selected':''}">${(i+1)%10}</button>`).join('')}</div><p class="capture-replacement">Replaces <strong>slot ${(this.slot+1)%10} · ${escape(patterns[this.slot].name)}</strong>. Slot 1 is protected.</p><p class="capture-anchor">${c.kind==='chord'?'Anchor':'Root'} <strong>${noteName(c.reference!)}${c.selected.includes(c.reference!)?'':' · not selected'}</strong></p><div class="capture-summary">${c.selected.map(p=>`<span>${noteName(p)}</span>`).join('')}</div></div><div class="capture-dialog-foot"><button id="capture-edit">← Edit pitches</button><button id="naming-cancel">Cancel</button><button id="capture-save" class="capture-primary">Replace ${c.kind}</button></div>`;
    const input=this.dialog.querySelector<HTMLInputElement>('input')!;input.value=this.name;
    input.oninput=()=>{this.name=input.value;};
    input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();this.dialog.querySelector<HTMLButtonElement>('#capture-save')!.click();}};
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(b=>b.onclick=()=>{this.slot=Number(b.dataset.slot);this.renderNaming();});
    this.dialog.querySelector<HTMLButtonElement>('#capture-edit')!.onclick=()=>this.command({type:'captureEdit'});
    this.dialog.querySelector<HTMLButtonElement>('#naming-cancel')!.onclick=()=>this.cancel();
    this.dialog.querySelector<HTMLButtonElement>('#capture-save')!.onclick=()=>{
      if(this.slot===0||!c.selected.length)return;
      const offsets=c.selected.map(p=>p-c.reference!);
      const notes=c.kind==='chord'?offsets:[...new Set(offsets.map(pitchClass))].sort((a,b)=>a-b);
      const name=this.name.trim()||`New ${c.kind}`;this.exitIntent='save';
      void this.ready.then(()=>{this.send({type:'captureCancel'});this.save(c.kind,this.slot,name,notes);});
    };
    if(!this.dialog.open)this.dialog.showModal();
    this.dialog.querySelector<HTMLButtonElement>(`[data-slot="${this.slot}"]`)!.focus();
  }
  private notice(message:string):void {
    const notice=document.getElementById('capture-notice')!;
    notice.textContent=message;notice.hidden=false;
    if(this.noticeTimer)clearTimeout(this.noticeTimer);
    this.noticeTimer=setTimeout(()=>{notice.hidden=true;},5000);
  }
}
