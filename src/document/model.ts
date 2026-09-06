import {isSound,sounds,type Sound} from '../audio/sounds';
import {defaultOutputs,defaultVariations,validateOutputs,validateVariations,type OutputSettings} from '../performance-settings/model';
import {defaults,type Settings} from '../performance/model';
import {validateGridOptions} from '../grid-settings/model';
import {chords,modes} from '../fixtures/instruments';
export interface Pattern {name:string;notes:number[];}
export interface InstrumentDocument {
  format:'harmony-grid';version:1;name:string;chords:Pattern[];modes:Pattern[];settings:Settings;
  outputs?:OutputSettings;
  selection?:{chord:number|null;mode:number|null};
  sound:Sound;surface:{autoButton:boolean;smoothClavier:boolean;showClavier:boolean;axes:[number,number];gridLow?:number;clavierLow?:number;thru:boolean};
}
export const MAX_FILE_BYTES=1024*1024;
const factoryChords=structuredClone(chords),factoryModes=structuredClone(modes);
export const freshDocument=():InstrumentDocument=>({format:'harmony-grid',version:1,outputs:defaultOutputs(),name:'Untitled instrument',chords:structuredClone(factoryChords),modes:structuredClone(factoryModes),settings:defaults(),sound:'organ',surface:{autoButton:true,smoothClavier:false,showClavier:true,axes:[4,3],thru:false}});
const fail=(message:string):never=>{throw Error(message);};
function object(value:unknown,keys:string[],label:string,optional:string[]=[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))fail(`Invalid ${label}.`);
  const result=value as Record<string,unknown>;
  if(Object.keys(result).some(k=>!keys.includes(k)&&!optional.includes(k))||keys.some(k=>!(k in result)))fail(`Missing or unsupported fields in ${label}.`);
  return result;
}
const integer=(v:unknown,min:number,max:number,label:string):number=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max?v:fail(`Invalid ${label}; expected ${min}–${max}.`);
const boolean=(v:unknown,label:string):boolean=>typeof v==='boolean'?v:fail(`Invalid ${label}.`);
const name=(v:unknown):string=>typeof v==='string'&&v.trim().length>0?v:fail('Names must contain text.');
function notes(value:unknown,mode:boolean):number[]{
  if(!Array.isArray(value)||!value.length||value.length>(mode?12:128))fail('Invalid pattern size.');
  const result=(value as unknown[]).map(v=>integer(v,mode?0:-127,mode?11:127,'pitch interval'));
  if(new Set(result).size!==result.length)fail('Repeated intervals in a pattern.');
  return result.sort((a,b)=>a-b);
}
function patterns(value:unknown,mode:boolean):Pattern[]{
  if(!Array.isArray(value)||value.length!==10)fail('Each instrument needs ten chord slots and ten mode slots.');
  const result=(value as unknown[]).map(v=>{const p=object(v,['name','notes'],'pattern');return {name:name(p.name),notes:notes(p.notes,mode)};});
  if(result[0].name!==(mode?'Chromatic':'Solo')||result[0].notes.join()!==(mode?'0,1,2,3,4,5,6,7,8,9,10,11':'0'))fail('Slot 1 must remain Solo / Chromatic.');
  return result;
}
export function validateDocument(value:unknown):InstrumentDocument {
  const d=object(value,['format','version','name','chords','modes','settings','sound','surface'],'instrument',['selection','outputs']);
  if(d.format!=='harmony-grid')fail('This is not a Harmony Grid instrument file.');
  if(d.version!==1)fail('This file uses an unsupported Harmony Grid format version.');
  const s=object(d.settings,Object.keys(defaults()).filter(k=>!['maxPitch','variations','captureHoldNumber'].includes(k)),'playing settings',['maxPitch','variations','captureHoldNumber']);
  const settings:Settings={
    variations:s.variations===undefined?defaultVariations():validateVariations(s.variations),
    captureHoldNumber:integer(s.captureHoldNumber===undefined?s.holdNumber:s.captureHoldNumber,0,128,'capture allowance'),
    maxPitch:s.maxPitch===undefined?127:integer(s.maxPitch,0,127,'highest playable pitch'),
    chord:notes(s.chord,false),mode:notes(s.mode,true),root:integer(s.root,0,11,'scale root'),tempo:integer(s.tempo,20,960,'tempo'),holdNumber:integer(s.holdNumber,0,128,'Hold Number'),
    mouseChannel:integer(s.mouseChannel,0,15,'mouse channel'),midiChannel:integer(s.midiChannel,0,15,'MIDI channel'),velocity:integer(s.velocity,1,127,'velocity'),
    captureLimit:boolean(s.captureLimit,'capture limit'),metronome:boolean(s.metronome,'metronome'),mouseSolo:boolean(s.mouseSolo,'Mouse Solo'),playChords:boolean(s.playChords,'Play Chords'),setsRoot:boolean(s.setsRoot,'Sets Root'),
  };
  const u=object(d.surface,['autoButton','smoothClavier','showClavier','axes','thru'],'surface settings',['gridLow','clavierLow']);
  if(!Array.isArray(u.axes)||u.axes.length!==2||u.axes.some(v=>typeof v!=='number'||!Number.isInteger(v)||v<1||v>12))fail('Unsupported grid axes.');
  const range=validateGridOptions({horizontal:(u.axes as number[])[0],vertical:(u.axes as number[])[1],gridLow:u.gridLow===undefined?24:integer(u.gridLow,0,108,'grid lowest C'),clavierLow:u.clavierLow===undefined?48:integer(u.clavierLow,0,72,'clavier lowest C'),maximum:settings.maxPitch});
  if(!isSound(d.sound))fail('Unsupported internal sound.');
  const library={chords:patterns(d.chords,false),modes:patterns(d.modes,true)};
  let selection:InstrumentDocument['selection'];
  if(d.selection!==undefined){
    const v=object(d.selection,['chord','mode'],'slot selection');
    selection={chord:null,mode:null};
    for(const kind of ['chord','mode'] as const){
      const index=v[kind]===null?null:integer(v[kind],0,9,'selected slot');
      if(index!==null&&library[kind==='chord'?'chords':'modes'][index].notes.join()!==settings[kind].join())fail('Selected slot does not match the playing pattern.');
      selection[kind]=index;
    }
  }
  return {format:'harmony-grid',version:1,...(d.outputs!==undefined?{outputs:validateOutputs(d.outputs)}:{}),name:name(d.name),...library,...(selection?{selection}:{}),settings,sound:d.sound as Sound,surface:{autoButton:boolean(u.autoButton,'Auto Button'),smoothClavier:boolean(u.smoothClavier,'Smooth Clavier'),showClavier:boolean(u.showClavier,'Show Clavier'),axes:[...(u.axes as [number,number])],...(u.gridLow!==undefined?{gridLow:range.gridLow}:{}),...(u.clavierLow!==undefined?{clavierLow:range.clavierLow}:{}),thru:boolean(u.thru,'MIDI Thru')}};
}
export function parseDocument(text:string):InstrumentDocument {
  if(new TextEncoder().encode(text).length>MAX_FILE_BYTES)fail('Instrument files must be 1 MiB or smaller.');
  let value:unknown;try{value=JSON.parse(text);}catch{fail('This file is not valid JSON.');}
  return validateDocument(value);
}
export function serializeDocument(doc:InstrumentDocument):string {
  const text=JSON.stringify(validateDocument(doc),null,2)+'\n';
  if(new TextEncoder().encode(text).length>MAX_FILE_BYTES)fail('Instrument files must be 1 MiB or smaller.');
  return text;
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function changes(previous:InstrumentDocument,current:InstrumentDocument):string[]{
  const result:string[]=[];
  if(previous.name!==current.name)result.push(`Instrument renamed to ${current.name}`);
  for(const key of ['chords','modes'] as const)current[key].forEach((p,i)=>{if(!equal(previous[key][i],p))result.push(`${key==='chords'?'Chord':'Mode'} ${(i+1)%10} changed to ${p.name}`);});
  const labels:Record<keyof Settings,string>={variations:'Musical variations',captureHoldNumber:'Capture audition allowance',maxPitch:'Highest playable pitch',chord:'Selected chord',mode:'Selected mode',root:'Scale root',tempo:'Tempo',holdNumber:'Hold Number',mouseChannel:'Mouse channel',midiChannel:'MIDI channel',velocity:'Mouse velocity',captureLimit:'Limit capture audition notes',metronome:'Metronome',mouseSolo:'Mouse Solo',playChords:'Play Chords',setsRoot:'Sets Root'};
  for(const key of Object.keys(labels) as (keyof Settings)[])if(!equal(previous.settings[key],current.settings[key]))result.push(`${labels[key]} changed${key==='tempo'?` to ${current.settings.tempo} ticks / min`:''}`);
  for(const kind of ['chord','mode'] as const)if(selectionOf(previous)[kind]!==selectionOf(current)[kind]&&equal(previous.settings[kind],current.settings[kind]))result.push(`Selected ${kind} slot changed`);
  if(!equal(previous.outputs??{internal:true,generated:true,preserveThru:true},current.outputs??{internal:true,generated:true,preserveThru:true}))result.push('Sound outputs or Thru routing changed');
  if(previous.sound!==current.sound)result.push(`Sound changed to ${sounds[current.sound]}`);
  for(const [key,initial,label]of [['gridLow',24,'Grid register'],['clavierLow',48,'Clavier register']] as const)if((previous.surface[key]??initial)!==(current.surface[key]??initial))result.push(`${label} changed`);
  const surfaceLabels={autoButton:'Auto Button',smoothClavier:'Smooth Clavier',showClavier:'Clavier visibility',axes:'Grid axes',thru:'MIDI Thru'};
  for(const key of Object.keys(surfaceLabels) as (keyof typeof surfaceLabels)[])if(!equal(previous.surface[key],current.surface[key]))result.push(`${surfaceLabels[key]} changed`);
  return result;
}

export function selectionOf(doc:InstrumentDocument):{chord:number|null;mode:number|null}{
  if(doc.selection)return {...doc.selection};
  const find=(patterns:Pattern[],notes:number[])=>{const i=patterns.findIndex(p=>p.notes.join()===notes.join());return i<0?null:i;};
  return {chord:find(doc.chords,doc.settings.chord),mode:find(doc.modes,doc.settings.mode)};
}
export function validatePattern(pattern:Pattern,kind:'chord'|'mode'):Pattern {
  return {name:name(pattern.name),notes:notes(pattern.notes,kind==='mode')};
}
