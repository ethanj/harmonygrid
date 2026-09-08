/*! Copyright (c) 2026 Ethan Joffe */
import {OutputLevel} from './output';
import {Palette} from './palette';
import type {Sound} from './sounds';
import {PerformanceEngine} from '../performance/engine';
import {Voices} from './voices';
import type {Input,Settings} from '../performance/model';
declare const sampleRate:number;
declare const currentFrame:number;
declare class AudioWorkletProcessor {port:MessagePort;constructor();}
declare function registerProcessor(name:string,processor:typeof AudioWorkletProcessor):void;

// Leave more headroom for overlapping attacks before the peak limiter.
const outputBoost=3;

class Instrument extends AudioWorkletProcessor {
  private engine:PerformanceEngine;
  private voices=new Voices(sampleRate,256);
  private palette=new Palette();
  private sound:Sound='organ';
  private right=new Float32Array(0);
  private nextHealth=0;
  private checkpoints:number[]=[];
  private peak=0;
  private outputLevel=new OutputLevel(sampleRate);
  private nonFiniteSamples=0;
  private lastBlock:number|null=null;
  private lastOutput=new Float32Array(0);
  private duplicateBlocks=0;
  constructor(){
    super();this.engine=new PerformanceEngine(sampleRate);
    this.port.onmessage=({data}:{data:{input?:Input;checkpoint?:number;settings?:Settings;sound?:Sound;bank?:ArrayBuffer;id?:number;sent?:number}})=>{
      if(data.checkpoint!==undefined)this.checkpoints.push(data.checkpoint);
      if(data.bank)void this.palette.load(data.bank,sampleRate).then(()=>this.port.postMessage({kind:'palette',ready:true})).catch(error=>this.port.postMessage({kind:'palette',ready:false,message:String(error)}));
      if(data.sound){this.sound=data.sound;this.voices.sound=data.sound==='pluck'?'pluck':'organ';}
      if(data.input){
        this.engine.enqueue(data.input,currentFrame);
        this.port.postMessage({kind:'receipt',id:data.id,sent:data.sent,sample:currentFrame});
      }
    };
  }
  process(_inputs:Float32Array[][],outputs:Float32Array[][]):boolean {
    try{return this.render(outputs);}
    catch(error){
      for(const output of outputs)for(const channel of output)channel.fill(0);
      this.port.postMessage({kind:'processor-fault',message:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined,sample:currentFrame,lastBlock:this.lastBlock});
      return false;
    }
  }
  private render(outputs:Float32Array[][]):boolean {
    const output=outputs[0];if(!output?.length)return true;
    const length=output[0].length;
    // A device/startup transition can request the same quantum again. Reuse its
    // samples without advancing musical time or attacking its notes twice.
    if(currentFrame===this.lastBlock&&length===this.lastOutput.length){
      this.duplicateBlocks++;
      output[0].set(this.lastOutput);if(output[1])output[1].set(this.right);
      return true;
    }
    if(this.lastOutput.length!==length){this.lastOutput=new Float32Array(length);this.right=new Float32Array(length);}
    this.lastOutput.fill(0);this.right.fill(0);
    const frames=this.engine.advance(currentFrame,currentFrame+length);
    for(const id of this.checkpoints)this.port.postMessage({kind:'checkpoint',id,settings:this.engine.settings});this.checkpoints=[];
    let offset=0;
    const render=(end:number)=>{
      if(end<=offset)return;
      this.palette.render(this.lastOutput,this.right,offset,end-offset);
      for(;offset<end;offset++){
        const fallback=this.voices.sample();
        // Average the sampled stereo signal before mixing so pitches stay centered.
        const mono=((this.lastOutput[offset]+this.right[offset])*.5+fallback)*outputBoost;
        const left=mono,right=mono;
        if(!Number.isFinite(left)||!Number.isFinite(right))this.nonFiniteSamples++;
        this.lastOutput[offset]=Number.isFinite(left)?left:0;this.right[offset]=Number.isFinite(right)?right:0;
      }
    };
    for(const frame of frames){
      render(Math.max(0,frame.sample-currentFrame));
      for(const action of frame.actions){
        this.voices.off(action.pitch,action.channel);this.palette.off(action.pitch,action.channel);
        if(action.type==='on'&&!this.palette.on(this.sound,action.pitch,action.velocity,action.channel))this.voices.on(action.pitch,action.velocity,action.channel);
      }
    }
    render(length);this.outputLevel.process(this.lastOutput,this.right);
    for(let i=0;i<length;i++)this.peak=Math.max(this.peak,Math.abs(this.lastOutput[i]),Math.abs(this.right[i]));
    output[0].set(this.lastOutput);if(output[1])output[1].set(this.right);
    if(frames.length)this.port.postMessage({kind:'frames',frames});
    if(currentFrame>=this.nextHealth){this.port.postMessage({kind:'health',queueOverflows:this.engine.queueOverflows,lateInputs:this.engine.lateInputs,voiceSteals:this.voices.steals,paletteVoices:this.palette.voiceCount,paletteVoiceCapacity:256,peak:this.peak,nonFiniteSamples:this.nonFiniteSamples,duplicateBlocks:this.duplicateBlocks,sample:currentFrame});this.peak=0;this.nextHealth=currentFrame+Math.round(sampleRate/2);}
    this.lastBlock=currentFrame;
    return true;
  }
}
registerProcessor('harmony-grid',Instrument);
