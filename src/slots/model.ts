/*! Copyright (c) 2026 Ethan Joffe */
import {serializeDocument,selectionOf,validatePattern,type InstrumentDocument,type Pattern} from '../document/model';
export type Kind='chord'|'mode';
export const bank=(kind:Kind)=>kind==='chord'?'chords':'modes';
export function parsePattern(name:string,text:string,kind:Kind):Pattern {
  const tokens=text.trim().split(/[\s,]+/);
  if(!text.trim()||tokens.some(t=>!/^[-+]?\d+$/.test(t)))throw Error('Enter whole-number intervals separated by commas or spaces.');
  return validatePattern({name,notes:tokens.map(Number)},kind);
}
export class PatternClipboard {
  private value:{kind:Kind;pattern:Pattern}|null=null;
  get label():string{return this.value?`Copied ${this.value.kind}: ${this.value.pattern.name}`:'No pattern copied';}
  accepts(kind:Kind):boolean{return this.value?.kind===kind;}
  copy(kind:Kind,pattern:Pattern):void{this.value={kind,pattern:validatePattern(pattern,kind)};}
  paste(kind:Kind,slot:number):Pattern {
    if(slot===0)throw Error('Slot 1 is protected.');
    if(!this.value)throw Error('Copy a pattern first.');
    if(this.value.kind!==kind)throw Error(`Copy a ${kind} before pasting into ${kind} slots.`);
    return structuredClone(this.value.pattern);
  }
}
export interface Edit {kind:Kind;slot:number;pattern:Pattern;}
export function applyEdits(source:InstrumentDocument,edits:Edit[]):InstrumentDocument {
  const doc=structuredClone(source);doc.selection=selectionOf(source);
  for(const {kind,slot,pattern} of edits){
    if(!Number.isInteger(slot)||slot<1||slot>9)throw Error('Slot 1 is protected; choose slots 2–0.');
    const next=validatePattern(pattern,kind);doc[bank(kind)][slot]=next;
    if(doc.selection[kind]===slot)doc.settings[kind]=[...next.notes];
  }
  serializeDocument(doc); // Validate the complete transaction, including the file size bound.
  return doc;
}
export class SlotDraft {
  private drafts:Record<Kind,{name:string;text:string}[]>;
  constructor(private original:InstrumentDocument){
    this.original=structuredClone(original);
    const rows=(patterns:Pattern[])=>patterns.map(p=>({name:p.name,text:p.notes.join(', ')}));
    this.drafts={chord:rows(original.chords),mode:rows(original.modes)};
  }
  get(kind:Kind,slot:number):{name:string;text:string}{return {...this.drafts[kind][slot]};}
  set(kind:Kind,slot:number,name:string,text:string):void{
    if(slot===0)throw Error('Slot 1 is protected.');
    this.drafts[kind][slot]={name,text};
  }
  pattern(kind:Kind,slot:number):Pattern{const d=this.get(kind,slot);return parsePattern(d.name,d.text,kind);}
  edits():Edit[]{
    const edits:Edit[]=[];
    for(const kind of ['chord','mode'] as const)for(let slot=1;slot<10;slot++){
      let pattern:Pattern;try{pattern=this.pattern(kind,slot);}catch(error){throw Error(`${kind==='chord'?'Chord':'Mode'} ${(slot+1)%10}: ${(error as Error).message}`);}
      if(JSON.stringify(pattern)!==JSON.stringify(this.original[bank(kind)][slot]))edits.push({kind,slot,pattern});
    }
    return edits;
  }
}
