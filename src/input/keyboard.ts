import type {Control,Input} from '../performance/model';
import {chords,modes} from '../fixtures/instruments';
export class KeyboardControls {
  private pressed=new Set<string>();
  private latched:Record<Control,boolean>={sustain:false,hold:false,drone:false,repeat:false};
  private temporary=new Map<string,number>();
  baseTempo=240;
  constructor(private send:(input:Input)=>void,private root:()=>number,private metro:()=>boolean,private select?:(kind:'chord'|'mode',slot:number)=>void){}
  reset(tempo=this.baseTempo):void {this.pressed.clear();this.temporary.clear();this.latched={sustain:false,hold:false,drone:false,repeat:false};this.baseTempo=tempo;}
  private control(c:Control):void {
    const key={sustain:' ',hold:'g',drone:'y',repeat:'d'}[c];
    this.send({type:'control',control:c,active:this.latched[c]||(c!=='drone'&&this.pressed.has(key))});
  }
  toggle(c:Control):void {this.latched[c]=!this.latched[c];this.control(c);}
  tempo(key:string,down:boolean,latch=false):void {
    const factors:Record<string,number>={q:.5,w:2,e:2/3,r:1.5};
    if(down){if(latch)this.baseTempo=Math.max(20,Math.min(960,Math.round(this.baseTempo*factors[key])));else this.temporary.set(key,factors[key]);}
    else this.temporary.delete(key);
    this.applyTempo();
  }
  private applyTempo():void {
    let tempo=this.baseTempo;for(const factor of this.temporary.values())tempo*=factor;
    this.send({type:'settings',settings:{tempo:Math.max(20,Math.min(960,Math.round(tempo)))}});
  }
  increment(delta:number):void {this.baseTempo=Math.max(20,Math.min(960,this.baseTempo+delta));this.applyTempo();}
  bind():void {
    window.addEventListener('keydown',event=>{
      const key=/^Digit[0-9]$/.test(event.code)?event.code.slice(-1):event.key.toLowerCase();
      if(document.querySelector('dialog[open],#grid-status[data-editing="true"]')||(event.target as HTMLElement).closest?.('dialog'))return;
      if(event.target instanceof HTMLSelectElement||event.target instanceof HTMLInputElement)return;
      const managed='0123456789 fgydtqweras'.includes(key)||key==='tab'||key==='escape';
      if(!managed)return;
      // A fresh keydown is evidence of a new press even if its previous keyup
      // was lost outside the window. Repeats alone must not retrigger controls.
      event.preventDefault();if(event.repeat)return;
      this.pressed.add(key);
      if(/^\d$/.test(key)){
        const slot=(Number(key)+9)%10;
        const mode=event.shiftKey!==event.getModifierState('CapsLock');
        if(this.select)this.select(mode?'mode':'chord',slot);
        else this.send({type:'settings',settings:mode?{mode:modes[slot].notes}:{chord:chords[slot].notes}});
      } else if(key==='tab')this.send({type:'settings',settings:{root:this.root()%12}});
      else if(key==='escape'){this.reset();this.send({type:'panic'});}
      else if(key==='t')this.send({type:'settings',settings:{metronome:!this.metro()}});
      else if(key==='f')this.toggle('sustain');
      else if(key==='y')this.toggle('drone');
      else if(key===' '||key==='g'||key==='d'){
        const control=key===' '?'sustain':key==='g'?'hold':'repeat';
        if(event.metaKey&&key!==' ')this.toggle(control);else this.control(control);
      } else if('qwer'.includes(key))this.tempo(key,true,event.metaKey);
      else if(key==='a'||key==='s')this.increment(key==='a'?-1:1);
    });
    window.addEventListener('keyup',event=>{
      const key=/^Digit[0-9]$/.test(event.code)?event.code.slice(-1):event.key.toLowerCase();if(!this.pressed.delete(key))return;
      if(key===' '||key==='g'||key==='d')this.control(key===' '?'sustain':key==='g'?'hold':'repeat');
      if('qwer'.includes(key))this.tempo(key,false);
    });
  }
}
