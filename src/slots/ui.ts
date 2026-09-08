/*! Copyright (c) 2026 Ethan Joffe */
import {captureSeed} from '../performance/capture';
import {selectionOf,type InstrumentDocument} from '../document/model';
import {SlotDraft,PatternClipboard,type Kind,type Edit} from './model';
export class SlotUI {
  private dialog=document.createElement('dialog');
  private draft:SlotDraft|null=null;
  private kind:Kind='chord';
  private slot=1;
  constructor(private read:()=>InstrumentDocument,private apply:(edits:Edit[])=>void,private blocked:()=>boolean,private clipboard:PatternClipboard,private recollect:(kind:Kind,slot:number,name:string,notes:number[])=>void){
    this.dialog.id='slot-editor';this.dialog.setAttribute('aria-labelledby','slot-heading');
    this.dialog.innerHTML=`<header><div><div class="eyebrow">Edit instrument</div><h2 id="slot-heading">Arrange your playing vocabulary</h2><p>Changes stay in this editor until you apply them.</p></div></header>
      <div class="slot-layout"><section class="slot-library"><nav aria-label="Pattern type"><button id="slot-chords" aria-pressed="true">Chords</button><button id="slot-modes" aria-pressed="false">Modes</button></nav><div id="slot-list"></div><p>Slot 1 is protected. Copy and paste stay within each type.</p></section>
      <section class="slot-detail"><div class="eyebrow" id="slot-caption"></div><h3 id="slot-title"></h3><label for="slot-name">Name</label><input id="slot-name" autocomplete="off"><label for="slot-intervals" id="slot-interval-label">Semitones from lead pitch</label><textarea id="slot-intervals" rows="3" spellcheck="false"></textarea><p id="slot-help"></p><p id="slot-error" role="alert"></p><div class="slot-clipboard"><span id="slot-clipboard-label"></span><button id="slot-copy">Copy</button></div><p>Paste replaces this draft. Apply changes updates the instrument.</p><button id="slot-paste">Paste here</button><button id="slot-recollect">Edit pitches on grid…</button><p id="slot-recollect-help"></p></section></div>
      <footer><span id="slot-summary" role="status"></span><button id="slot-cancel">Cancel</button><button id="slot-apply" class="primary">Apply changes</button></footer>`;
    document.body.append(this.dialog);
    document.getElementById('edit-slots')!.onclick=()=>this.show();
    for(const kind of ['chord','mode'] as const)this.el(`slot-${kind}s`).onclick=()=>{this.kind=kind;this.render();};
    this.el('slot-cancel').onclick=()=>this.dialog.close();
    for(const id of ['slot-name','slot-intervals'])this.el(id).oninput=()=>{
      this.draft!.set(this.kind,this.slot,this.el<HTMLInputElement>('slot-name').value,this.el<HTMLTextAreaElement>('slot-intervals').value);this.validate();this.renderList();
    };
    this.el('slot-copy').onclick=()=>{try{this.clipboard.copy(this.kind,this.draft!.pattern(this.kind,this.slot));this.validate();}catch(error){this.error(error);}};
    this.el('slot-paste').onclick=()=>{try{const p=this.clipboard.paste(this.kind,this.slot);this.draft!.set(this.kind,this.slot,p.name,p.notes.join(', '));this.render();}catch(error){this.error(error);}};
    this.el('slot-recollect').onclick=()=>{try{const p=this.draft!.pattern(this.kind,this.slot);captureSeed(p.notes);if(this.slot===0||this.draft!.edits().length)return;this.dialog.close();this.recollect(this.kind,this.slot,p.name,p.notes);}catch(error){this.error(error);}};
    this.el('slot-apply').onclick=()=>{try{this.apply(this.draft!.edits());this.dialog.close();}catch(error){this.error(error);}};
    this.dialog.addEventListener('close',()=>{this.draft=null;});
  }
  get active():boolean{return this.dialog.open;}
  private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.dialog.querySelector<T>(`#${id}`)!;}
  private error(error:unknown):void{this.el('slot-error').textContent=(error as Error).message;}
  show():void{
    if(this.blocked()||this.active)return;
    const doc=this.read();this.draft=new SlotDraft(doc);this.kind='chord';this.slot=selectionOf(doc).chord??1;
    this.render();this.dialog.showModal();
  }
  private renderList():void{
    const list=this.el('slot-list');list.replaceChildren();
    for(let i=0;i<10;i++){
      const p=this.draft!.get(this.kind,i),button=document.createElement('button');button.id=`slot-row-${i}`;button.className='slot-row';button.setAttribute('aria-pressed',String(this.slot===i));
      const digit=document.createElement('span');digit.className='slot-digit';digit.textContent=String((i+1)%10);
      const content=document.createElement('span'),name=document.createElement('strong'),notes=document.createElement('small');name.textContent=p.name||'Unnamed';notes.textContent=p.text;content.append(name,notes);button.append(digit,content);
      if(i===0){const badge=document.createElement('small');badge.textContent='Protected';button.append(badge);}
      button.onclick=()=>{this.slot=i;this.render();};list.append(button);
    }
  }
  private validate():void{
    let valid=true;this.el('slot-error').textContent='';
    try{const edits=this.draft!.edits();this.el('slot-summary').textContent=edits.length?`${edits.length} slot${edits.length===1?'':'s'} changed`:'No changes';}catch(error){valid=false;this.error(error);this.el('slot-summary').textContent='Resolve invalid intervals or names before applying.';}
    this.el<HTMLButtonElement>('slot-apply').disabled=!valid;
    try{this.draft!.pattern(this.kind,this.slot);this.el<HTMLButtonElement>('slot-copy').disabled=false;}catch{this.el<HTMLButtonElement>('slot-copy').disabled=true;}
    this.el<HTMLButtonElement>('slot-paste').disabled=this.slot===0||!this.clipboard.accepts(this.kind);
    this.el('slot-clipboard-label').textContent=this.clipboard.label;
    let reason='Cancel collection keeps the saved slot. The first reference stays fixed.';
    let disabled=this.slot===0||!valid;
    try{if(this.draft!.edits().length){disabled=true;reason='Apply or cancel draft edits before collecting pitches.';}captureSeed(this.draft!.pattern(this.kind,this.slot).notes);}catch(error){disabled=true;reason=(error as Error).message;}
    if(this.slot===0)reason='Slot 1 is protected.';
    this.el<HTMLButtonElement>('slot-recollect').disabled=disabled;this.el('slot-recollect-help').textContent=reason;
  }
  private render():void{
    const d=this.draft!.get(this.kind,this.slot);this.renderList();
    this.el('slot-chords').setAttribute('aria-pressed',String(this.kind==='chord'));this.el('slot-modes').setAttribute('aria-pressed',String(this.kind==='mode'));
    this.el('slot-caption').textContent=`${this.kind} · slot ${(this.slot+1)%10}`;this.el('slot-title').textContent=d.name;
    this.el<HTMLInputElement>('slot-name').value=d.name;this.el<HTMLTextAreaElement>('slot-intervals').value=d.text;
    this.el<HTMLInputElement>('slot-name').disabled=this.slot===0;this.el<HTMLTextAreaElement>('slot-intervals').disabled=this.slot===0;
    this.el('slot-interval-label').textContent=this.kind==='chord'?'Semitones from lead pitch':'Semitones from scale root';
    this.el('slot-help').textContent=this.slot===0?'This slot is protected. You can copy it to another slot.':`Use distinct whole numbers from ${this.kind==='chord'?'−127 to 127':'0 to 11'}. Zero does not need to be included.`;
    this.validate();
  }
}
