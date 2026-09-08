/*! Copyright (c) 2026 Ethan Joffe */
import {expect,it} from 'vitest';
import {KeyboardControls} from '../../src/input/keyboard';
import type {Input} from '../../src/performance/model';
it('composes temporary tempo factors without losing a held factor on incremental changes',()=>{
 const out:Input[]=[];const k=new KeyboardControls(i=>out.push(i),()=>60,()=>true);
 k.tempo('q',true);k.increment(2);k.tempo('w',true);k.tempo('w',false);k.tempo('q',false);
 expect(out).toEqual([120,121,242,121,242].map(tempo=>({type:'settings',settings:{tempo}})));
});
it('keeps permanent tempo changes across release and panic reset',()=>{
 const out:Input[]=[];const k=new KeyboardControls(i=>out.push(i),()=>60,()=>true);
 k.tempo('q',true,true);k.tempo('q',false);k.reset();k.increment(1);
 expect(out.at(-1)).toEqual({type:'settings',settings:{tempo:121}});
});

it('accepts a fresh digit press after a lost keyup while suppressing auto-repeat',()=>{
 const listeners=new Map<string,(event:any)=>void>();
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 const previousSelect=globalThis.HTMLSelectElement,previousInput=globalThis.HTMLInputElement;
 Object.assign(globalThis,{window:{addEventListener:(name:string,fn:(event:any)=>void)=>listeners.set(name,fn)},document:{querySelector:()=>null},HTMLSelectElement:class {},HTMLInputElement:class {}});
 try {
  const selected:Array<[string,number]>=[];
  new KeyboardControls(()=>{},()=>60,()=>false,(kind,slot)=>selected.push([kind,slot])).bind();
  const press=(shiftKey=false,caps=false,repeat=false)=>listeners.get('keydown')!({key:shiftKey?'@':'2',code:'Digit2',target:{},shiftKey,repeat,getModifierState:()=>caps,preventDefault:()=>{}});
  press();press(false,false,true); // Browser repeat is ignored.
  press(); // Release occurred outside the window; the next physical press works.
  press(true);press(false,true);press(true,true);
  expect(selected).toEqual([['chord',1],['chord',1],['mode',1],['mode',1],['chord',1]]);
 } finally {
  Object.assign(globalThis,{window:previousWindow,document:previousDocument,HTMLSelectElement:previousSelect,HTMLInputElement:previousInput});
 }
});
