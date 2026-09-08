/*! Copyright (c) 2026 Ethan Joffe */
import {changes,parseDocument,serializeDocument,type InstrumentDocument} from './model';
import {readFile,type FileHandle,type OpenedFile} from './files';
export class DocumentSession {
  baseline:InstrumentDocument;
  source:OpenedFile|null=null;
  saved=false;
  busy=false;
  constructor(initial:InstrumentDocument,private read:()=>Promise<InstrumentDocument>,private apply:(doc:InstrumentDocument)=>void,private rename:(name:string)=>void){this.baseline=structuredClone(initial);}
  dirty(current:InstrumentDocument):boolean{return changes(this.baseline,current).length>0;}
  replace(doc:InstrumentDocument,source:OpenedFile|null,saved:boolean):void {
    const copy=parseDocument(serializeDocument(doc));
    this.apply(structuredClone(copy));this.baseline=copy;this.source=source;this.saved=saved;
  }
  revert():void {if(this.saved)this.apply(structuredClone(this.baseline));}
  async save(handle:FileHandle,name:string,asNew=false):Promise<boolean>{
    if(this.busy)return false;
    this.busy=true;
    try{
      if(asNew&&this.source?.handle&&await handle.isSameEntry(this.source.handle))throw Error('Save As needs a different file. Use Save to update this instrument file.');
      const snapshot=await this.read();snapshot.name=name.trim()||snapshot.name;
      const raw=serializeDocument(snapshot);
      if(!asNew&&this.source?.handle){
        if(await readFile(await this.source.handle.getFile())!==this.source.raw)throw Error('This file changed outside Harmony Grid. Use Save As to keep your version in a separate file.');
      }
      const stream=await handle.createWritable();
      try{await stream.write(raw);await stream.close();}catch(error){try{await stream.abort();}catch{}throw error;}
      this.baseline=parseDocument(raw);this.source={name:handle.name,handle,raw};this.saved=true;this.rename(snapshot.name);
      return true;
    }finally{this.busy=false;}
  }
}
