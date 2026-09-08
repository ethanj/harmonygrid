/*! Copyright (c) 2026 Ethan Joffe */
import {PitchCapture} from './capture';
import type {CaptureKind} from './model';
import {chordAt,pitchClass,validPitch} from './harmony';
import {defaults,type Action,type Control,type Frame,type Input,type Note,type Settings,type Snapshot} from './model';

interface Trigger {id:string;pitch:number;velocity:number;order:number;}
interface Source {lead:number;notes:Note[];filtered:number[];signature:string;}
interface Queued {sample:number;sequence:number;input:Input;}
const key=(note:Note)=>note.channel*128+note.pitch;
const controls=():Record<Control,boolean>=>({sustain:false,hold:false,drone:false,repeat:false});

/** Pure sample-clock engine. Browser event handlers never mutate committed display state. */
export class PerformanceEngine {
  settings:Settings;
  controls=controls();
  readonly queue:Queued[]=[];
  queueOverflows=0;
  lateInputs=0;
  private sequence=0;
  private eventId=0;
  private tick=0;
  private cursor=0;
  private nextTick:number;
  private tempoPending:number|null=null;
  private pointer=60;
  private pointerCeiling=127;
  private down=false;
  private tap=false;
  private mouseDirty=false;
  private midiDirty=false;
  private mouseConfigDirty=false;
  private heldMidi=new Map<string,Trigger>();
  private shortMidi:Trigger|null=null;
  private committedMidi=new Set<number>();
  private lastTrigger:string|null=null;
  private mouse:Source|null=null;
  private midi:Source|null=null;
  private midiSources=new Map<string,Source>();
  private scaleChanged=false;
  private sustain=new Map<number,Note>();
  private drone=new Map<number,Note>();
  private sounding=new Map<number,Note>();
  private output=new Map<number,Note>();
  private capture:{draft:PitchCapture;kind:CaptureKind;phase:'collect'|'naming'}|null=null;
  private audition=new Map<number,Note>();
  private captureAttacks=new Map<number,Note>();
  private previousControls=controls();
  snapshot:Snapshot;

  constructor(readonly sampleRate:number,settings:Partial<Settings>={}) {
    this.settings={...defaults(),...settings};this.pointerCeiling=this.settings.maxPitch;
    this.nextTick=this.interval();
    this.snapshot=this.makeSnapshot(0,[],[]);
  }

  enqueue(input:Input,sample:number):void {
    if(!Number.isFinite(sample))return;
    sample=Math.max(0,Math.round(sample));
    if(sample<this.cursor){this.lateInputs++;sample=this.cursor;}
    if(this.queue.length>=4096){
      // An observable fail-safe prevents lost note-offs when input exceeds capacity.
      this.queueOverflows++;this.queue.length=0;
      this.queue.push({sample:this.cursor,sequence:++this.sequence,input:{type:'panic'}});
      return;
    }
    this.queue.push({sample,sequence:++this.sequence,input});
    this.queue.sort((a,b)=>a.sample-b.sample||a.sequence-b.sequence);
  }

  /** Half-open sample interval: an event at end belongs to the following render block. */
  advance(start:number,end:number):Frame[] {
    if(end<start||start<this.cursor)throw Error('Non-monotonic audio interval');
    const frames:Frame[]=[];
    this.cursor=start;
    while(true){
      const eventSample=this.queue[0]?.sample??Infinity;
      const time=Math.max(this.cursor,Math.min(eventSample,this.nextTick));
      if(time>=end)break;
      this.cursor=time;
      // Events arriving exactly on a boundary participate in that boundary.
      while(this.queue.length&&this.queue[0].sample<=time){
        const {input,sequence}=this.queue.shift()!;
        const immediate=this.apply(input,time,sequence);
        if(immediate)frames.push(this.mix(immediate));
        else if(!this.settings.metronome)frames.push(this.mix(this.commit(time,false)));
      }
      if(this.nextTick<=time){
        this.tick++;
        if(this.tempoPending!==null){this.settings.tempo=this.tempoPending;this.tempoPending=null;}
        frames.push(this.mix(this.commit(time,true)));
        this.nextTick=time+this.interval();
      }
    }
    this.cursor=end;
    return frames;
  }

  private interval():number {return Math.max(1,Math.round(this.sampleRate*60/this.settings.tempo));}

  private apply(input:Input,sample:number,sequence:number):Frame|null {
    switch(input.type){
      case 'captureStart':
        if(this.capture){this.capture.kind=input.kind;return null;}
        else this.capture={draft:new PitchCapture(),kind:input.kind,phase:'collect'};
        if(input.seed&&validPitch(input.seed.reference)&&input.seed.pitches.every(validPitch)){
          this.capture.draft.reference=input.seed.reference;
          this.capture.draft.pitches=[...new Set(input.seed.pitches)].sort((a,b)=>a-b);
          for(const pitch of this.capture.draft.pitches)this.addAudition({pitch,velocity:this.settings.velocity,channel:this.settings.mouseChannel});
        }
        return this.captureFrame(sample);
      case 'captureSelect':
        if(input.pitch>this.settings.maxPitch&&!this.capture?.draft.pitches.includes(input.pitch))break;
        this.selectCapture(input.pitch,input.velocity??this.settings.velocity,input.channel??this.settings.mouseChannel);
        break;
      case 'captureFinish':
        if(this.capture){if(this.capture.draft.pitches.length)this.capture.phase='naming';else this.capture=null;}
        this.audition.clear();this.captureAttacks.clear();return this.captureFrame(sample);
      case 'captureCancel':
        this.capture=null;this.audition.clear();this.captureAttacks.clear();return this.captureFrame(sample);
      case 'captureEdit':
        if(this.capture){this.capture.phase='collect';for(const pitch of this.capture.draft.pitches)this.addAudition({pitch,velocity:this.settings.velocity,channel:this.settings.mouseChannel});}
        return null;

      case 'pointer':
        if(!validPitch(input.pitch)||input.pitch>this.settings.maxPitch)break;
        if(input.pitch!==this.pointer||input.strike)this.mouseDirty=true;
        this.pointer=input.pitch;this.pointerCeiling=this.settings.maxPitch;
        if(input.down!==undefined){if(input.down&&!this.down){this.tap=true;this.mouseDirty=true;}this.down=input.down;}
        break;
      case 'release':this.down=false;if(this.settings.variations.shortInput==='ignore')this.tap=false;break;
      case 'midiOn':
        if(this.capture){if(this.capture.phase==='collect')this.selectCapture(input.pitch,input.velocity,this.settings.midiChannel);break;}
        if(!validPitch(input.pitch)||input.velocity<=0)break;
        {const previous=this.heldMidi.get(input.id);if(previous)this.committedMidi.delete(previous.order);}
        this.heldMidi.delete(input.id);
        this.heldMidi.set(input.id,{...input,order:sequence});
        break;
      case 'midiOff':{
        const note=this.heldMidi.get(input.id);
        if(this.settings.variations.shortInput==='fullTick'&&note&&!this.committedMidi.has(note.order)&&(!this.shortMidi||note.order>this.shortMidi.order))this.shortMidi=note;
        if(note)this.committedMidi.delete(note.order);
        this.heldMidi.delete(input.id);
        break;
      }
      case 'control':this.controls[input.control]=input.active;break;
      case 'settings':{
        const changes={...input.settings};
        if(changes.tempo!==undefined){this.tempoPending=Math.max(20,Math.min(960,Math.round(changes.tempo)));delete changes.tempo;}
        this.settings={...this.settings,...changes};
        if(changes.maxPitch!==undefined)this.pointerCeiling=Math.min(this.pointerCeiling,changes.maxPitch);
        if(changes.captureLimit===true||changes.captureHoldNumber!==undefined)this.trimAudition();
        if(changes.root!==undefined||changes.mode)this.scaleChanged=true;
        if(changes.root!==undefined)this.settings.root=pitchClass(changes.root);
        if(changes.chord||changes.mode||changes.root!==undefined||changes.mouseSolo!==undefined||changes.mouseChannel!==undefined)this.mouseDirty=true;
        if(changes.chord||changes.mode||changes.root!==undefined||changes.playChords!==undefined||changes.midiChannel!==undefined)this.midiDirty=true;
        if(changes.chord||changes.mode||changes.root!==undefined||changes.mouseSolo!==undefined||changes.mouseChannel!==undefined)this.mouseConfigDirty=true;
        break;
      }
      case 'document':{
        const frame=this.reset(sample);
        this.settings={...defaults(),...input.settings};this.pointerCeiling=this.settings.maxPitch;this.tempoPending=null;
        this.nextTick=sample+this.interval();
        frame.snapshot=this.makeSnapshot(sample,[],[]);this.snapshot=frame.snapshot;
        return frame;
      }
      case 'panic':return this.reset(sample);
    }
    return null;
  }

  private reset(sample:number):Frame {
    const actions:Action[]=[...this.sounding.values()].map(note=>({...note,type:'off',sample,eventId:this.eventId+1}));
    this.capture=null;this.audition.clear();this.captureAttacks.clear();
    this.down=false;this.tap=false;this.shortMidi=null;this.heldMidi.clear();this.committedMidi.clear();this.lastTrigger=null;
    this.mouse=null;this.midi=null;this.midiSources.clear();this.scaleChanged=false;this.sustain.clear();this.drone.clear();this.sounding.clear();
    this.controls=controls();this.previousControls=controls();this.mouseDirty=false;this.midiDirty=false;this.mouseConfigDirty=false;
    this.snapshot=this.makeSnapshot(sample,[],[]);
    return {sample,actions,snapshot:this.snapshot};
  }

  private selectCapture(pitch:number,velocity:number,channel:number):void {
    if(!this.capture||this.capture.phase!=='collect'||!validPitch(pitch))return;
    const removing=this.capture.draft.pitches.includes(pitch);
    this.capture.draft.select(pitch);
    if(removing){this.audition.delete(pitch);for(const [k,n]of this.captureAttacks)if(n.pitch===pitch)this.captureAttacks.delete(k);}
    else this.addAudition({pitch,velocity,channel});
  }
  private addAudition(note:Note):void {
    this.audition.set(note.pitch,note);this.captureAttacks.set(key(note),note);this.trimAudition();
  }
  private trimAudition():void {
    if(!this.settings.captureLimit)return;
    while(this.audition.size>Math.max(0,this.settings.captureHoldNumber)){
      const pitch=this.audition.keys().next().value!,note=this.audition.get(pitch)!;
      this.audition.delete(pitch);this.captureAttacks.delete(key(note));
    }
  }
  private captureFrame(sample:number):Frame {
    this.snapshot=this.makeSnapshot(sample,this.snapshot.played,this.snapshot.filtered);
    return {sample,actions:[],snapshot:this.snapshot};
  }
  /** Merge owners before emitting note-offs; audition reattacks never erase performance ownership. */
  private mix(frame:Frame):Frame {
    const wanted=new Map(this.sounding);
    for(const note of this.audition.values())wanted.set(key(note),note);
    const attacks=new Map(frame.actions.filter(a=>a.type==='on').map(a=>[key(a),a as Note]));
    for(const [k,n]of this.captureAttacks)if(wanted.has(k))attacks.set(k,n);
    for(const [k,n]of wanted)if(!this.output.has(k))attacks.set(k,n);
    const actions:Action[]=[];
    for(const [k,n]of this.output)if(!wanted.has(k)||attacks.has(k))actions.push({...n,type:'off',sample:frame.sample,eventId:frame.snapshot.eventId});
    for(const [k,n]of attacks)if(wanted.has(k))actions.push({...n,type:'on',sample:frame.sample,eventId:frame.snapshot.eventId});
    this.output=wanted;this.captureAttacks.clear();
    frame.actions=actions;frame.snapshot.sounding=[...wanted.values()];
    return frame;
  }

  private source(lead:number,channel:number,velocity:number,offsets:number[],signature:string,maximum=127):Source {
    const chord=chordAt(lead,offsets.filter(offset=>lead+offset<=maximum),this.settings.root,this.settings.mode);
    return {lead,notes:chord.played.map(pitch=>({pitch,channel,velocity})),filtered:chord.filtered,signature};
  }

  private commit(sample:number,isTick:boolean):Frame {
    const trigger=[...this.heldMidi.values()].at(-1)??this.shortMidi;
    const triggerSignature=trigger?`${trigger.id}:${trigger.order}`:null;
    if(trigger&&this.settings.setsRoot&&triggerSignature!==this.lastTrigger&&pitchClass(trigger.pitch)!==this.settings.root){
      this.settings.root=pitchClass(trigger.pitch);this.scaleChanged=true;this.mouseDirty=true;this.midiDirty=true;this.mouseConfigDirty=true;
    }
    const oldMouse=this.mouse,oldMidi=this.midi;
    const mouseActive=this.down||this.tap;
    if(mouseActive)this.mouse=this.source(this.pointer,this.settings.mouseChannel,this.settings.velocity,this.settings.mouseSolo?[0]:this.settings.chord,`mouse:${this.pointer}`,this.pointerCeiling);
    else if(this.controls.hold&&this.mouse&&this.mouseConfigDirty)this.mouse=this.source(this.mouse.lead,this.settings.mouseChannel,this.settings.velocity,this.settings.mouseSolo?[0]:this.settings.chord,this.mouse.signature,this.pointerCeiling);
    else if(!this.controls.hold)this.mouse=null;
    const oldMidiSources=this.midiSources;
    const triggers=this.settings.variations.multiMidi?([...this.heldMidi.values()].length?[...this.heldMidi.values()]:this.shortMidi?[this.shortMidi]:[]):trigger?[trigger]:[];
    let nextMidi=new Map<string,Source>();
    if(this.settings.playChords&&triggers.length){
      for(const t of triggers){nextMidi.set(t.id,this.source(t.pitch,this.settings.midiChannel,t.velocity,this.settings.chord,`${t.id}:${t.order}`));if(this.heldMidi.has(t.id))this.committedMidi.add(t.order);}
    }else if(this.controls.hold&&this.settings.playChords){
      nextMidi=new Map([...oldMidiSources].map(([id,source])=>[id,this.midiDirty?this.source(source.lead,this.settings.midiChannel,source.notes[0]?.velocity??96,this.settings.chord,source.signature):source]));
    }
    this.midiSources=nextMidi;
    this.midi=nextMidi.size?{lead:trigger?.pitch??oldMidi?.lead??60,notes:[...nextMidi.values()].flatMap(s=>s.notes),filtered:[...nextMidi.values()].flatMap(s=>s.filtered),signature:[...nextMidi.values()].map(s=>s.signature).join('|')}:null;
    this.lastTrigger=triggerSignature;

    if(this.controls.drone&&!this.previousControls.drone)for(const [k,note]of this.sounding)this.drone.set(k,note);
    if(!this.controls.drone)this.drone.clear();
    if(this.controls.sustain&&!this.previousControls.sustain)for(const [k,note]of this.sounding)this.sustain.set(k,note);
    if(!this.controls.sustain)this.sustain.clear();

    if(this.scaleChanged&&!this.settings.variations.retainAcrossScale){this.sustain.clear();this.drone.clear();}
    this.scaleChanged=false;
    const current=[...(this.mouse?.notes??[]),...(this.midi?.notes??[])];
    const newMouse=this.mouse&&(this.mouseConfigDirty||this.mouseDirty&&mouseActive||!oldMouse||this.mouse.signature!==oldMouse.signature);
    const newMidiNotes=[...this.midiSources].flatMap(([id,source])=>this.midiDirty||oldMidiSources.get(id)?.signature!==source.signature?source.notes:[]);
    const enteringSustain=!this.previousControls.sustain;
    const toRetain=enteringSustain?current:[...(newMouse?this.mouse?.notes??[]:[]),...newMidiNotes];
    if(this.controls.sustain)for(const note of toRetain){const k=key(note);if(this.settings.variations.refreshSustainAge)this.sustain.delete(k);if(!this.sustain.has(k))this.sustain.set(k,note);}
    while(this.settings.variations.sustainLimit&&this.sustain.size>Math.max(0,this.settings.holdNumber))this.sustain.delete(this.sustain.keys().next().value!);
    const wanted=new Map<number,Note>([...this.sustain,...this.drone]);
    for(const note of current)wanted.set(key(note),note);
    const attacks=new Map<number,Note>();
    const repeat=this.controls.repeat&&isTick;
    const request=(source:Source|null,old:Source|null,dirty:boolean)=>{
      if(!source)return;
      if(repeat||dirty||!old||source.signature!==old.signature){
        for(const note of source.notes){
          const k=key(note);
          if(this.drone.has(k)&&!(repeat&&this.settings.variations.repeatDrone!=='off'))continue;
          if(!repeat&&!this.settings.variations.sustainRetrigger&&this.controls.sustain&&this.sounding.has(k))continue;
          attacks.set(k,note);
        }
      }
    };
    request(this.mouse,oldMouse,this.mouseConfigDirty||this.mouseDirty&&mouseActive);
    for(const [id,source]of this.midiSources)request(source,oldMidiSources.get(id)??null,this.midiDirty);
    if(repeat&&this.settings.variations.repeatDrone==='all')for(const [k,note]of this.drone)attacks.set(k,note);
    for(const [k,note]of wanted)if(!this.sounding.has(k))attacks.set(k,note);
    const actions:Action[]=[];
    for(const [k,note]of this.sounding)if(!wanted.has(k)||attacks.has(k))actions.push({...note,type:'off',sample,eventId:this.eventId+1});
    for(const note of attacks.values())actions.push({...note,type:'on',sample,eventId:this.eventId+1});
    this.sounding=wanted;
    const played=[...new Set(current.map(n=>n.pitch))].sort((a,b)=>a-b);
    const filtered=[...new Set([...(this.mouse?.filtered??[]),...(this.midi?.filtered??[])])].sort((a,b)=>a-b);
    this.snapshot=this.makeSnapshot(sample,played,filtered);
    this.previousControls={...this.controls};this.tap=false;this.shortMidi=null;this.mouseDirty=false;this.midiDirty=false;this.mouseConfigDirty=false;
    return {sample,actions,snapshot:this.snapshot};
  }

  private makeSnapshot(sample:number,played:number[],filtered:number[]):Snapshot {
    return {sample,eventId:++this.eventId,tick:this.tick,lead:this.pointer,
      capture:this.capture?{kind:this.capture.kind,phase:this.capture.phase,reference:this.capture.draft.reference,selected:[...this.capture.draft.pitches],audition:[...this.audition.values()],performance:[...this.sounding.values()]}:null,
      settings:{...this.settings,chord:[...this.settings.chord],mode:[...this.settings.mode]},
      controls:{...this.controls},played,filtered,sounding:[...this.sounding.values()],midi:[...new Set([...this.heldMidi.values()].map(n=>n.pitch))]};
  }
}
