/*! Copyright (c) 2026 Ethan Joffe */
import {SoundBankLoader,SpessaSynthProcessor} from 'spessasynth_core';
import {soundPrograms,type Sound} from './sounds';
/** Prepared once before the performance is connected. No bank parsing during playing. */
export class Palette {
  private synth:SpessaSynthProcessor|null=null;
  private programs=new Int16Array(16).fill(-1);
  async load(bytes:ArrayBuffer,sampleRate:number):Promise<void>{
    const synth=new SpessaSynthProcessor(sampleRate,{effectsEnabled:false,eventsEnabled:false});
    await synth.processorInitialized;
    synth.setSystemParameter('voiceCap',256);synth.setSystemParameter('autoAllocateVoices',false);
    synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(bytes),'harmony');
    for(const channel of synth.midiChannels)channel.setDrums(false);
    this.synth=synth;
  }
  on(sound:Sound,pitch:number,velocity:number,channel:number):boolean{
    const program=soundPrograms[sound];if(!this.synth||program===undefined)return false;
    // MIDI channel ten is a melodic instrument here, just like the other fifteen.
    if(this.programs[channel]!==program){this.synth.programChange(channel,program);this.programs[channel]=program;}
    this.synth.noteOn(channel,pitch,velocity);return true;
  }
  get voiceCount():number{return this.synth?.voiceCount??0;}
  off(pitch:number,channel:number):void{this.synth?.noteOff(channel,pitch);}
  render(left:Float32Array,right:Float32Array,start:number,count:number):void{this.synth?.process(left,right,start,count);}
}
