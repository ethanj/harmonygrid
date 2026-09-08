/*! Copyright (c) 2026 Ethan Joffe */
import {statusTemplate} from './status-template';
import type {GridOptions} from './model';
import './status.css';
/** Manual section 4.3: inline interval edits are staged until Set. */
export class GridStatus {
 private panel:HTMLElement;
 private draft:GridOptions|null=null;
 constructor(private read:()=>GridOptions,private apply:(value:GridOptions)=>void,private blocked:()=>boolean,private changed:()=>void){
  const root=document.querySelector<HTMLElement>('.sidebar>section')!,holder=document.createElement('div');holder.innerHTML=statusTemplate;this.panel=holder.firstElementChild as HTMLElement;
  document.querySelector('.sidebar')!.insertBefore(this.panel,document.querySelector('.metronome'));this.el('axis-scale').append(root);
  for(const [id,axis,delta]of [['left','horizontal',-1],['right','horizontal',1],['down','vertical',-1],['up','vertical',1]] as const)this.el('axis-'+id).onclick=()=>{
   if(this.blocked())return;
   this.draft??={...this.read()};this.draft[axis]=Math.max(1,Math.min(12,this.draft[axis]+delta));this.render();this.changed();
  };
  this.el('axis-set').onclick=()=>this.commit();this.el('axis-cancel').onclick=()=>this.cancel();
  window.addEventListener('keydown',e=>{if(!this.active||document.querySelector('dialog[open]'))return;if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')this.cancel();else this.commit();}},true);
  this.sync();
 }
 private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.panel.querySelector<T>('#'+id)!;}
 get active():boolean{return this.draft!==null;}
 sync():void{this.render();}
 target(mode:boolean|null):void{
  this.el('target-mode').classList.toggle('active',mode===true);this.el('target-chord').classList.toggle('active',mode===false);
  this.panel.querySelector('.axis-target')!.setAttribute('aria-label',mode===null?'Digit key target updates on the next key event':`Digit keys select ${mode?'modes':'chords'}`);
 }
 cancel():void{this.draft=null;this.render();this.changed();}
 private commit():void{if(!this.draft||this.blocked())return;const value=this.draft;this.draft=null;this.apply(value);this.render();this.changed();}
 private render():void{
  const v=this.draft??this.read();this.panel.dataset.editing=String(this.active);
  this.el('axis-info').hidden=this.active;this.el('axis-actions').hidden=!this.active;
  this.el('axis-horizontal').textContent=String(v.horizontal);this.el('axis-vertical').textContent=String(v.vertical);
  for(const [id,value,bound]of [['left',v.horizontal,1],['right',v.horizontal,12],['down',v.vertical,1],['up',v.vertical,12]] as const)this.el<HTMLButtonElement>('axis-'+id).disabled=value===bound;
 }
}
