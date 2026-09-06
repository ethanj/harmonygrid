import {drawGrid,drawPiano,noteName} from '../render/draw';
import {validateGridOptions,type GridOptions} from './model';
export class GridSettingsUI {
  private dialog=document.createElement('dialog');
  private original!:GridOptions;
  private lastValid!:GridOptions;
  constructor(private read:()=>GridOptions,private apply:(value:GridOptions)=>void,private blocked:()=>boolean){
    this.dialog.id='grid-settings';this.dialog.setAttribute('aria-labelledby','grid-settings-title');
    this.dialog.innerHTML=`<header><div class="eyebrow">Instrument settings</div><h2 id="grid-settings-title">Grid & register</h2><p>Arrange the pitches under your hands.</p></header><div class="range-layout"><section class="range-settings"><div class="range-fields"><h3>Grid intervals</h3><p>Each step moves by this many semitones.</p><div class="range-pair"><label>Horizontal →<input id="range-horizontal" type="number" min="1" max="12"></label><label>Vertical ↑<input id="range-vertical" type="number" min="1" max="12"></label></div><div class="range-presets"><button data-axes="4,3">4 × 3</button><button data-axes="5,7">5 × 7</button><button data-axes="1,12">1 × 12</button></div><h3>Playing range</h3><label>Grid lower-left C<select id="range-gridLow"></select></label><label>Clavier lowest C<select id="range-clavierLow"></select></label><label>Highest playable pitch<input id="range-maximum" type="number" min="0" max="127"></label><p id="range-maximum-label"></p><p>Unavailable pitches are dimmed in the preview.</p><p id="range-error" role="alert"></p></div><footer><span id="range-status" role="status"></span><button id="range-cancel">Cancel</button><button id="range-apply" class="primary">Apply changes</button></footer></section><section class="range-preview"><div class="range-preview-heading"><div><div class="eyebrow">Layout preview</div><h3 id="range-layout-name"></h3></div><span id="range-preview-state"></span></div><div class="range-grid-wrap"><canvas id="range-grid" aria-label="Preview of grid pitches"></canvas></div><div class="range-clavier-heading"><strong>Clavier</strong><span id="range-clavier-label"></span></div><canvas id="range-clavier" aria-label="Preview of clavier register"></canvas><p>C major · Scale root C · Dimmed pitches unavailable</p><p>Preview updates here. The playing instrument changes only when you apply.</p><div class="range-current"><span>Applied layout</span><strong id="range-current"></strong></div></section></div>`;
    document.body.append(this.dialog);
    window.addEventListener('keydown',event=>{if(this.active&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.dialog.close();}},true);
    for(const [key,max]of [['gridLow',108],['clavierLow',72]] as const)for(let p=0;p<=max;p+=12)this.el<HTMLSelectElement>(`range-${key}`).add(new Option(`${noteName(p)} · MIDI ${p}`,String(p)));
    for(const key of ['horizontal','vertical','gridLow','clavierLow','maximum'])this.el(`range-${key}`).oninput=()=>this.render();
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-axes]').forEach(b=>b.onclick=()=>{const [h,v]=b.dataset.axes!.split(',');this.el<HTMLInputElement>('range-horizontal').value=h;this.el<HTMLInputElement>('range-vertical').value=v;this.render();});
    this.el('range-cancel').onclick=()=>this.dialog.close();
    this.el('range-apply').onclick=()=>{try{this.apply(validateGridOptions(this.values()));this.dialog.close();}catch(e){this.el('range-error').textContent=(e as Error).message;}};
    document.getElementById('axes')!.onclick=()=>this.show();
    new ResizeObserver(()=>{if(this.active)this.draw();}).observe(this.el('range-grid'));
  }
  get active():boolean{return this.dialog.open;}
  private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.dialog.querySelector<T>(`#${id}`)!;}
  private values():GridOptions {
    const get=(key:string)=>{const value=this.el<HTMLInputElement>(`range-${key}`).value;return value===''?NaN:Number(value);};
    return {horizontal:get('horizontal'),vertical:get('vertical'),gridLow:get('gridLow'),clavierLow:get('clavierLow'),maximum:get('maximum')};
  }
  show():void {
    if(this.blocked()||this.active)return;
    this.original=this.read();this.lastValid={...this.original};
    for(const key of Object.keys(this.original) as (keyof GridOptions)[])this.el<HTMLInputElement>(`range-${key}`).value=String(this.original[key]);
    this.dialog.showModal();this.render();
  }
  private render():void {
    const value=this.values();let error='';try{this.lastValid=validateGridOptions(value);}catch(e){error=(e as Error).message;}
    const dirty=JSON.stringify(value)!==JSON.stringify(this.original);
    this.el('range-error').textContent=error;this.el<HTMLButtonElement>('range-apply').disabled=!!error||!dirty;
    this.el('range-status').textContent=error?'Check values':dirty?'Unapplied changes':'No changes';
    this.el('range-preview-state').textContent=error?'Last valid preview':dirty?'Draft layout':'Current layout';
    this.el('range-maximum-label').textContent=Number.isInteger(value.maximum)&&value.maximum>=0&&value.maximum<=127?`${noteName(value.maximum)} · MIDI ${value.maximum}`:'Enter a MIDI pitch';
    this.dialog.querySelectorAll<HTMLElement>('[data-axes]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.axes===`${value.horizontal},${value.vertical}`)));
    const v=this.lastValid,o=this.original;
    this.el('range-layout-name').textContent=`${v.horizontal} × ${v.vertical}`;
    this.el('range-clavier-label').textContent=`${noteName(v.clavierLow)}–${noteName(v.clavierLow+36)} · MIDI ${v.clavierLow}–${v.clavierLow+36}`;
    this.el('range-current').textContent=`${o.horizontal} × ${o.vertical} · grid ${noteName(o.gridLow)} · clavier ${noteName(o.clavierLow)} · max ${noteName(o.maximum)}`;
    this.draw();
  }
  private draw():void {
    if(!this.lastValid)return;
    const v=this.lastValid,ratio=devicePixelRatio||1;
    for(const id of ['range-grid','range-clavier']){
      const c=this.el<HTMLCanvasElement>(id);c.width=Math.round(c.clientWidth*ratio);c.height=Math.round(c.clientHeight*ratio);
      const ctx=c.getContext('2d')!;ctx.setTransform(ratio,0,0,ratio,0,0);
      if(id==='range-grid')drawGrid(ctx,{width:c.clientWidth,height:c.clientHeight,columns:12,rows:6,base:v.gridLow,horizontal:v.horizontal,vertical:v.vertical,maximum:v.maximum},null);
      else drawPiano(ctx,c.clientWidth,c.clientHeight,null,v.clavierLow,v.clavierLow+36,v.maximum);
    }
  }
}
