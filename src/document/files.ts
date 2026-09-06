import {MAX_FILE_BYTES} from './model';
export interface FileHandle {
  name:string;
  getFile():Promise<File>;
  createWritable():Promise<{write(data:string):Promise<void>;close():Promise<void>;abort():Promise<void>}>;
  isSameEntry(other:FileHandle):Promise<boolean>;
}
interface Pickers {
  showOpenFilePicker?:(options:unknown)=>Promise<FileHandle[]>;
  showSaveFilePicker?:(options:unknown)=>Promise<FileHandle>;
}
const options={types:[{description:'Harmony Grid instrument',accept:{'application/json':['.json']}}]};
export interface OpenedFile {name:string;raw:string;handle:FileHandle|null;}
export async function readFile(file:File):Promise<string>{
  if(file.size>MAX_FILE_BYTES)throw Error('Instrument files must be 1 MiB or smaller.');
  return file.text();
}
export class BrowserFiles {
  get writable():boolean{return typeof (window as Pickers).showSaveFilePicker==='function';}
  async open():Promise<OpenedFile|null>{
    if((window as Pickers).showOpenFilePicker){
      const [handle]=await (window as Pickers).showOpenFilePicker!({...options,multiple:false});
      return {name:handle.name,raw:await readFile(await handle.getFile()),handle};
    }
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);
    try{
      const file=await new Promise<File|null>(resolve=>{input.onchange=()=>resolve(input.files?.[0]??null);input.oncancel=()=>resolve(null);input.click();});
      return file?{name:file.name,raw:await readFile(file),handle:null}:null;
    }finally{input.remove();}
  }
  chooseSave(name:string):Promise<FileHandle>{return (window as Pickers).showSaveFilePicker!({...options,suggestedName:name.replace(/[\\/:*?"<>|]/g,'-')+'.hgrid.json'});}
  download(name:string,raw:string):void {
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'-')+'.hgrid.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
