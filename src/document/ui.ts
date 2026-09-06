import {sounds} from '../audio/sounds';
import {BrowserFiles,type OpenedFile} from './files';
import {changes,freshDocument,parseDocument,serializeDocument,type InstrumentDocument} from './model';
import {DocumentSession} from './session';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
type Operation='save'|'save-as'|'open'|'new'|'revert'|'unsaved';
export class DocumentUI {
  readonly session:DocumentSession;
  private files=new BrowserFiles();
  private dialog=document.createElement('dialog');
  private operation:Operation='save-as';
  private pending:{doc:InstrumentDocument;source:OpenedFile|null;saved:boolean}|null=null;
  private busy=false;
  private error='';
  private draftName='';
  private refreshSignature='';
  constructor(private peek:()=>InstrumentDocument,private read:()=>Promise<InstrumentDocument>,apply:(doc:InstrumentDocument)=>void,rename:(name:string)=>void,private capturing:()=>boolean){
    this.session=new DocumentSession(freshDocument(),read,apply,rename);
    this.dialog.id='file-dialog';this.dialog.className='file-dialog';this.dialog.setAttribute('aria-labelledby','file-title');document.body.append(this.dialog);
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();if(!this.busy)this.close();});
    document.getElementById('file-menu')!.onclick=()=>this.show();
    // File dialogs own key-downs. Existing held controls may still receive key-ups.
    window.addEventListener('keydown',event=>{
      if((event.metaKey||event.ctrlKey)&&['s','o'].includes(event.key.toLowerCase())){
        event.preventDefault();event.stopImmediatePropagation();if(this.busy||this.capturing())return;
        const op=event.key.toLowerCase()==='o'?'open':event.shiftKey?'save-as':'save';this.show(op);
        if(op==='save'&&this.session.source?.handle)void this.save(false);
        return;
      }
      if(this.active)event.stopImmediatePropagation();
    },true);
    window.addEventListener('beforeunload',event=>{if(this.session.dirty(this.peek())||this.capturing()){event.preventDefault();event.returnValue='';}});
    this.refresh();
  }
  get active():boolean{return this.dialog.open||this.busy;}
  refresh():void {
    const doc=this.peek(),dirty=this.session.dirty(doc);
    const signature=JSON.stringify([doc.name,dirty,this.session.saved,this.capturing()]);if(signature===this.refreshSignature)return;this.refreshSignature=signature;
    const title=document.querySelector<HTMLElement>('.document-title')!;title.textContent=`${doc.name}${dirty||!this.session.saved?' · Unsaved':''}`;title.title=title.textContent;
    const button=document.getElementById('file-menu')! as HTMLButtonElement;button.disabled=this.capturing();button.title=button.disabled?'Finish or cancel editing to work with files':'Open, save, or revert this instrument';
  }
  show(operation:Operation='save-as'):void {
    if(this.busy||this.capturing())return;
    this.pending=null;this.operation=operation;this.error='';this.draftName=this.peek().name;this.render();
  }
  openExample(doc:InstrumentDocument):void {if(this.busy||this.capturing())return;this.draftName=this.peek().name;void this.run(()=>this.consider(doc,null,false));}
  private close():void {this.dialog.close();this.pending=null;this.error='';this.refresh();}
  private render():void {
    const doc=this.peek(),op=this.operation,unsaved=op==='unsaved',revert=op==='revert',opening=op==='open';
    const title=unsaved?`Save changes to ${doc.name}?`:revert?'Restore the saved instrument?':opening?'Open an instrument':op==='new'?'Start a new instrument':this.session.saved?'Keep this instrument':'Save your instrument';
    this.dialog.classList.toggle('file-confirmation',unsaved||revert);
    const list=changes(this.session.baseline,doc);
    const saving=op==='save'||op==='save-as';
    const nameField=`<label class="file-name-label">Instrument name<input id="instrument-name" autocomplete="off"></label>`;
    const navigation=`<nav class="file-options" aria-label="File operations">${([['new','New instrument'],['open','Open…'],['save','Save'],['save-as','Save As…'],['revert','Revert to saved…']] as const).map(([id,label])=>`<button data-file-op="${id}" ${id==='revert'&&!this.session.saved?'disabled':''} class="${op===id?'selected':''}">${label}</button>`).join('')}</nav>`;
    const summary=`<div class="file-summary"><p>10 chord slots · 10 mode slots</p><p>${sounds[doc.sound]} · ${doc.settings.tempo} ticks / min</p><p>Grid axes → ${doc.surface.axes[0]} ↑ ${doc.surface.axes[1]}</p><p>Playing settings and layout included</p></div>`;
    const fallback=!this.files.writable?'<p class="file-note">This browser can download an instrument copy but cannot write directly to its file. A requested download does not confirm a save; changes stay marked unsaved.</p>':'';
    const body=unsaved?`<p>You have changes that have not been saved to a file.</p><ul class="file-changes" tabindex="0" aria-label="Unsaved changes">${list.map(s=>`<li>${escape(s)}</li>`).join('')}</ul><p class="file-note">The current instrument stays open until you choose. Your notes release when the next instrument opens.</p>${!this.session.source?.handle?nameField:''}${fallback}`:revert?`<p>Changes to ${escape(doc.name)} since the last save will be discarded.</p><p class="file-note">Restore the saved patterns, sound, and playing settings. Current notes release and live Sustain, Hold, Drone, and Repeat turn off.</p>`:`<div class="file-layout">${navigation}<div>${saving?`${nameField}<p>Choose ${op==='save-as'?'a separate file':'a location for this instrument'} in the next step.</p>${summary}${fallback}`:opening?'<p>Choose an instrument file from your computer.</p><div class="file-summary">The selected file is checked before it replaces the current instrument.</div><p class="file-note">Your current notes continue until the new instrument opens.</p>':'<p>Start with the original fixture slots and playing settings.</p><p class="file-note">Unsaved changes are checked before the current instrument is replaced.</p>'}</div></div>`;
    this.dialog.innerHTML=`<header><span class="eyebrow">${unsaved?'Open another instrument':'Instrument document'}</span><h1 id="file-title" title="${escape(title)}">${escape(title)}</h1>${!unsaved&&!revert?'<p>Your chords, modes, sound, and playing settings travel together.</p>':''}</header><section class="file-body">${this.error?`<div class="file-error" role="alert">${escape(this.error)}</div>`:''}${body}</section><footer><button id="file-cancel">Cancel</button>${unsaved?`<button id="file-discard" class="file-danger">Discard & ${this.pending?.doc.name!=='Untitled instrument'||this.pending?.saved?'open':'new'}</button><button id="file-confirm" class="capture-primary">Save & ${this.pending?.doc.name!=='Untitled instrument'||this.pending?.saved?'open':'new'}…</button>`:`<button id="file-confirm" class="${revert?'file-danger':'capture-primary'}" ${revert&&!this.session.saved?'disabled':''}>${opening?'Choose instrument file…':revert?'Revert to saved':op==='new'?'New instrument':!this.files.writable?'Download copy…':op==='save'&&this.session.source?.handle?'Save':'Choose location & save…'}</button>`}</footer>`;
    const input=this.dialog.querySelector<HTMLInputElement>('#instrument-name');if(input){input.value=this.draftName;input.oninput=()=>{this.draftName=input.value;};}
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-file-op]').forEach(b=>b.onclick=()=>{this.operation=b.dataset.fileOp as Operation;this.error='';this.render();});
    this.dialog.querySelector<HTMLButtonElement>('#file-cancel')!.onclick=()=>this.close();
    this.dialog.querySelector<HTMLButtonElement>('#file-discard')?.addEventListener('click',()=>this.replacePending());
    this.dialog.querySelector<HTMLButtonElement>('#file-confirm')!.onclick=()=>{
      if(unsaved)void this.save(false,true);
      else if(revert){this.session.revert();this.close();}
      else if(opening)void this.open();
      else if(op==='new')void this.run(()=>this.consider(freshDocument(),null,false));
      else void this.save(op==='save-as');
    };
    this.disable();if(!this.dialog.open)this.dialog.showModal();
    this.dialog.querySelector<HTMLButtonElement>('#file-cancel')!.focus();
  }
  private disable():void {this.dialog.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input').forEach(e=>{if(this.busy)e.disabled=true;});}
  private async run(work:()=>Promise<void>):Promise<void>{
    if(this.busy)return;this.busy=true;this.disable();
    try{await work();}catch(error){if((error as Error).name!=='AbortError')this.error=(error as Error).message||'The file operation failed. Your current instrument is still open.';}
    finally{this.busy=false;if(this.dialog.open)this.render();this.refresh();}
  }
  private async open():Promise<void>{await this.run(async()=>{const source=await this.files.open();if(source)await this.consider(parseDocument(source.raw),source,true);});}
  private async consider(doc:InstrumentDocument,source:OpenedFile|null,saved:boolean):Promise<void>{
    this.pending={doc,source,saved};
    if(this.session.dirty(await this.read())){this.operation='unsaved';this.error='';this.render();}
    else this.replacePending();
  }
  private replacePending():void {if(!this.pending)return;const {doc,source,saved}=this.pending;this.session.replace(doc,source,saved);this.close();}
  private async save(asNew:boolean,thenOpen=false):Promise<void>{
    await this.run(async()=>{
      const name=this.draftName.trim()||this.peek().name;
      if(!this.files.writable){const snapshot=await this.read();snapshot.name=name;this.files.download(name,serializeDocument(snapshot));this.error='Download requested. Keep the downloaded copy. The current instrument remains open and changes are still marked unsaved.';return;}
      const existing=this.session.source?.handle;
      const handle=asNew||!existing?await this.files.chooseSave(name):existing;
      if(thenOpen&&this.pending?.source?.handle&&await handle.isSameEntry(this.pending.source.handle))throw Error('This is the file you are opening. Cancel and save first, or choose Discard & open.');
      if(!await this.session.save(handle,name,asNew&&!!existing))return;
      if(thenOpen){
        if(this.session.dirty(await this.read())){this.error='The instrument changed during saving. Save the remaining changes or choose Discard & open.';return;}
        this.replacePending();
      }else this.close();
    });
  }
}
