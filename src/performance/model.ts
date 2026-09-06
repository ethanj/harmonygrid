import {defaultVariations,type Variations} from '../performance-settings/model';
export type Control = 'sustain' | 'hold' | 'drone' | 'repeat';
export type CaptureKind='chord'|'mode';
export interface CaptureSnapshot {kind:CaptureKind;phase:'collect'|'naming';reference:number|null;selected:number[];audition:Note[];performance:Note[];}
export interface Settings {
  maxPitch:number;
  variations:Variations;
  captureHoldNumber:number;
  captureLimit:boolean;
  chord: number[]; mode: number[]; root: number;
  metronome: boolean; tempo: number; holdNumber: number;
  mouseSolo: boolean; playChords: boolean; setsRoot: boolean;
  mouseChannel: number; midiChannel: number; velocity: number;
}
export type Input =
  | {type:'pointer';pitch:number;down?:boolean;strike?:boolean}
  | {type:'release'}
  | {type:'midiOn';id:string;pitch:number;velocity:number}
  | {type:'midiOff';id:string}
  | {type:'control';control:Control;active:boolean}
  | {type:'settings';settings:Partial<Settings>}
  | {type:'document';settings:Partial<Settings>}
  | {type:'captureStart';kind:CaptureKind;seed?:{reference:number;pitches:number[]}}
  | {type:'captureSelect';pitch:number;velocity?:number;channel?:number}
  | {type:'captureFinish'|'captureCancel'|'captureEdit'}
  | {type:'panic'};
export interface Note {pitch:number;channel:number;velocity:number;}
export interface Action extends Note {type:'on'|'off';sample:number;eventId:number;}
export interface Snapshot {
  capture?:CaptureSnapshot|null;
  sample:number;eventId:number;tick:number;lead:number;settings:Settings;
  controls:Record<Control,boolean>;played:number[];filtered:number[];sounding:Note[];midi:number[];
}
export interface Frame {sample:number;actions:Action[];snapshot:Snapshot;}
export const defaults = ():Settings => ({variations:defaultVariations(),captureHoldNumber:32,maxPitch:127,captureLimit:false,chord:[0,3,4,7],mode:[0,2,4,5,7,9,11],root:0,metronome:false,tempo:240,holdNumber:32,mouseSolo:false,playChords:true,setsRoot:false,mouseChannel:0,midiChannel:0,velocity:96});
