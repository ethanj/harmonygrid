/*! Copyright (c) 2026 Ethan Joffe */
export interface Variations {
  multiMidi:boolean;repeatDrone:'off'|'current'|'all';sustainRetrigger:boolean;retainAcrossScale:boolean;
  shortInput:'fullTick'|'ignore';sustainLimit:boolean;refreshSustainAge:boolean;
}
export const defaultVariations=():Variations=>({multiMidi:false,repeatDrone:'off',sustainRetrigger:false,retainAcrossScale:true,shortInput:'fullTick',sustainLimit:true,refreshSustainAge:false});
export interface OutputSettings {internal:boolean;generated:boolean;preserveThru:boolean;}
export const defaultOutputs=():OutputSettings=>({internal:true,generated:true,preserveThru:false});
export function validateVariations(v:unknown):Variations {
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid musical variations.');
  const value=v as Record<string,unknown>,expected=defaultVariations();
  if(Object.keys(value).length!==Object.keys(expected).length||Object.keys(value).some(k=>!(k in expected)))throw Error('Unsupported musical variation.');
  for(const key of ['multiMidi','sustainRetrigger','retainAcrossScale','sustainLimit','refreshSustainAge'])if(typeof value[key]!=='boolean')throw Error('Invalid musical variation.');
  if(!['off','current','all'].includes(String(value.repeatDrone))||!['fullTick','ignore'].includes(String(value.shortInput)))throw Error('Invalid musical variation choice.');
  return {...value} as unknown as Variations;
}
export function validateOutputs(value:unknown):OutputSettings {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid sound outputs.');
  const v=value as Record<string,unknown>;
  if(Object.keys(v).length!==3||Object.keys(v).some(k=>!['internal','generated','preserveThru'].includes(k))||Object.values(v).some(v=>typeof v!=='boolean'))throw Error('Invalid sound outputs.');
  return {...v} as unknown as OutputSettings;
}
