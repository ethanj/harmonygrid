/*! Copyright (c) 2026 Ethan Joffe */
import type {Action,Input} from '../performance/model';
export class MidiRouter {
  access:MIDIAccess|null=null;
  output:MIDIOutput|null=null;
  input:MIDIInput|null=null;
  enabled=true;
  thru=false;
  generated=true;
  preserveThru=true;
  thruChannel=0;
  private forwarded=new Map<string,{pitch:number;channel:number}[]>();
  private generatedTouched=new Map<string,{pitch:number;channel:number}>();
  private pendingGenerated:{action:Action;when:number}[]=[];
  private generatedNotes=new Map<string,{pitch:number;channel:number}>();
  configure(thru:boolean,generated:boolean,preserve:boolean,channel:number):void {
    if(this.thru&&!thru)this.releaseThru();
    if(this.generated&&!generated){try{(this.output as (MIDIOutput & {clear?:()=>void})|null)?.clear?.();}catch{}for(const n of this.generatedTouched.values())if(!this.hasThru(n.channel,n.pitch))this.write([0x80|n.channel,n.pitch,0]);this.generatedNotes.clear();this.generatedTouched.clear();this.pendingGenerated=[];}
    this.thru=thru;this.generated=generated;this.preserveThru=preserve;this.thruChannel=channel;
  }
  private releaseTime(channel:number,pitch:number):number|undefined {
    const next=this.pendingGenerated.filter(e=>e.action.channel===channel&&e.action.pitch===pitch&&e.action.type==='off'&&e.when>performance.now()).at(-1);
    return next?.when;
  }
  private requeueGenerated():void {
    this.pendingGenerated=this.pendingGenerated.filter(e=>e.when>performance.now());
    if(!this.pendingGenerated.length)return;
    // A new immediate Thru owner can invalidate an already queued generated off.
    // Web MIDI clear cancels pending messages, so reconstruct the short future queue.
    try{(this.output as (MIDIOutput & {clear?:()=>void})|null)?.clear?.();}catch(error){this.failed(error);return;}
    for(const {action:a,when}of this.pendingGenerated)if(a.type==='on'||!this.hasThru(a.channel,a.pitch))this.write([(a.type==='on'?0x90:0x80)|a.channel,a.pitch,a.type==='on'?a.velocity:0],when);
  }
  private hasThru(channel:number,pitch:number):boolean{return [...this.forwarded.values()].some(list=>list.some(n=>n.channel===channel&&n.pitch===pitch));}
  private releaseThru():void {
    const notes=[...this.forwarded.values()].flat();this.forwarded.clear();
    for(const n of notes)if(!this.generatedNotes.has(`${n.channel}:${n.pitch}`))this.write([0x80|n.channel,n.pitch,0],this.releaseTime(n.channel,n.pitch));
    this.requeueGenerated();
  }
  private forward(data:Uint8Array,id:string):void {
    const status=data[0]&0xf0,channel=this.preserveThru?(data[0]&15):this.thruChannel,pitch=data[1];
    if(status===0x80||(status===0x90&&data[2]===0)){
      const notes=this.forwarded.get(id),old=notes?.shift();if(notes&&!notes.length)this.forwarded.delete(id);
      if(old){if(!this.hasThru(old.channel,pitch)&&!this.generatedNotes.has(`${old.channel}:${pitch}`)){const copy=new Uint8Array(data);copy[0]=status|old.channel;this.write(copy,this.releaseTime(old.channel,pitch));}}
      else if(this.thru){const copy=new Uint8Array(data);copy[0]=status|channel;if(!this.hasThru(channel,pitch)&&!this.generatedNotes.has(`${channel}:${pitch}`))this.write(copy);}
      return;
    }
    if(status===0xb0&&(pitch===120||pitch===123)){
      const prefix=id.slice(0,id.lastIndexOf(':')+1),released:{pitch:number;channel:number}[]=[];
      for(const [key,notes]of this.forwarded)if(key.startsWith(prefix)){released.push(...notes);this.forwarded.delete(key);}
      for(const n of released)if(!this.hasThru(n.channel,n.pitch)&&!this.generatedNotes.has(`${n.channel}:${n.pitch}`))this.write([0x80|n.channel,n.pitch,0]);
      return;
    }
    if(!this.thru)return;
    if(status===0x90){
      const previous=this.forwarded.get(id)??[];this.forwarded.delete(id);
      for(const old of previous)if(!this.hasThru(old.channel,pitch)&&!this.generatedNotes.has(`${old.channel}:${pitch}`))this.write([0x80|old.channel,pitch,0]);
      this.forwarded.set(id,[{pitch,channel}]);
    }
    const copy=new Uint8Array(data);if(data[0]>=0x80&&data[0]<0xf0)copy[0]=status|channel;this.write(copy);
  }
  private notes=new Set<string>();
  lateOutputs=0;
  lastError:string|null=null;
  constructor(private send:(input:Input)=>void,private trace:(row:unknown)=>void){}
  async connect():Promise<void>{
    if(!navigator.requestMIDIAccess)throw Error('Web MIDI is unavailable in this browser');
    this.access=await navigator.requestMIDIAccess({sysex:false});
  }
  chooseInput(id:string):void {
    if(this.input)this.input.onmidimessage=null;
    this.releaseThru();
    for(const note of this.notes)this.send({type:'midiOff',id:note});this.notes.clear();
    this.input=this.access?.inputs.get(id)??null;
    if(this.input)this.input.onmidimessage=event=>{if(event.data)this.receive(event.data,event.timeStamp);};
  }
  chooseOutput(id:string):void {this.silenceOutput();this.output=this.access?.outputs.get(id)??null;}
  receive(data:Uint8Array,timestamp:number):void {
    if(!this.enabled)return;
    const start=performance.now();

    this.trace({kind:'midi-input',timestamp,receipt:start,bytes:Array.from(data),thru:this.thru});
    const status=data[0]&0xf0,channel=data[0]&15;
    const id=`${this.input?.id??'synthetic'}:${channel}:${data[1]}`;
    this.forward(data,id);this.requeueGenerated();
    if(status===0x90&&data[2]>0){this.notes.add(id);this.send({type:'midiOn',id,pitch:data[1],velocity:data[2]});}
    else if(status===0x80||(status===0x90&&data[2]===0)){this.notes.delete(id);this.send({type:'midiOff',id});}
    else if(status===0xb0&&(data[1]===120||data[1]===123)){for(const note of this.notes)if(note.startsWith(`${this.input?.id??'synthetic'}:${channel}:`)){this.send({type:'midiOff',id:note});this.notes.delete(note);}}
  }
  schedule(actions:Action[],when:number):void {
    if(!this.enabled||!this.output||!this.generated)return;
    this.pendingGenerated=this.pendingGenerated.filter(e=>e.when>performance.now());
    for(const action of actions){
      const late=performance.now()-when;if(late>0)this.lateOutputs++;
      if(when>performance.now())this.pendingGenerated.push({action,when});
      const key=`${action.channel}:${action.pitch}`;this.generatedTouched.set(key,action);
      if(action.type==='on')this.generatedNotes.set(key,action);else{this.generatedNotes.delete(key);if(this.hasThru(action.channel,action.pitch))continue;}
      this.write([ (action.type==='on'?0x90:0x80)|action.channel,action.pitch,action.type==='on'?action.velocity:0],Math.max(performance.now(),when));
      this.trace({kind:'midi-output',target:when,late:Math.max(0,late),action});
    }
  }
  silenceOutput():void {
    this.forwarded.clear();this.generatedNotes.clear();this.generatedTouched.clear();this.pendingGenerated=[];
    if(!this.output)return;
    try{(this.output as MIDIOutput & {clear?:()=>void}).clear?.();}catch(error){this.failed(error);}
    for(let channel=0;channel<16;channel++){this.write([0xb0|channel,123,0]);this.write([0xb0|channel,120,0]);}
  }
  private write(bytes:number[]|Uint8Array,time?:number):void {
    if(!this.enabled)return;
    try{this.output?.send(bytes,time);}catch(error){this.failed(error);}
  }
  private failed(error:unknown):void {
    this.lastError=(error as Error).message;this.trace({kind:'midi-output-error',message:this.lastError});this.output=null;
  }
}
