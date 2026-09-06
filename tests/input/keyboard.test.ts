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
