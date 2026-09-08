/*! Copyright (c) 2026 Ethan Joffe */
import {expect,it,vi} from 'vitest';
import {DocumentSession} from '../../src/document/session';
import {freshDocument,serializeDocument,parseDocument} from '../../src/document/model';
import type {FileHandle} from '../../src/document/files';
function file(initial='',failure:'write'|'close'|null=null){
  let raw=initial,staged='';
  const handle:FileHandle={name:'instrument.hgrid.json',getFile:async()=>new File([raw],'instrument.hgrid.json'),isSameEntry:async other=>other===handle,
    createWritable:async()=>({write:async value=>{if(failure==='write')throw Error('Disk full');staged=value;},close:async()=>{if(failure==='close')throw Error('Commit failed');raw=staged;},abort:async()=>{staged='';}})};
  return {handle,get raw(){return raw;},set raw(value:string){raw=value;}};
}
function rig(){
  let doc=freshDocument();const apply=vi.fn(next=>{doc=structuredClone(next);});
  const session=new DocumentSession(doc,async()=>structuredClone(doc),apply,name=>{doc.name=name;});
  return {session,apply,get doc(){return doc;}};
}
it('saves the exact current snapshot and only then establishes a clean saved baseline',async()=>{
  const r=rig(),target=file();r.doc.chords[5]={name:'Custom',notes:[4,7,12]};
  expect(r.session.dirty(r.doc)).toBe(true);
  await r.session.save(target.handle,'Voicings');
  expect(parseDocument(target.raw)).toEqual(r.doc);expect(r.session.saved).toBe(true);expect(r.session.dirty(r.doc)).toBe(false);
  r.doc.settings.root=2;await r.session.save(target.handle,'Voicings');expect(parseDocument(target.raw).settings.root).toBe(2);
});
it.each(['write','close'] as const)('preserves original file, destination, and dirty state if %s fails',async failure=>{
  const r=rig(),original=file();await r.session.save(original.handle,'First');r.doc.chords[6]={name:'Changed',notes:[0,12]};
  const baseline=structuredClone(r.session.baseline),next=file('original contents',failure);
  await expect(r.session.save(next.handle,'Other',true)).rejects.toThrow();
  expect(next.raw).toBe('original contents');expect(r.session.source?.handle).toBe(original.handle);expect(r.session.baseline).toEqual(baseline);expect(r.doc.name).toBe('First');expect(r.session.dirty(r.doc)).toBe(true);
});
it('refuses to overwrite an externally changed file',async()=>{
  const r=rig(),target=file();await r.session.save(target.handle,'First');target.raw='external edit';r.doc.settings.root=2;
  await expect(r.session.save(target.handle,'First')).rejects.toThrow('outside Harmony Grid');expect(target.raw).toBe('external edit');expect(r.session.dirty(r.doc)).toBe(true);
});
it('Save As requires a separate destination and keeps the original file intact',async()=>{
  const r=rig(),first=file(),second=file();await r.session.save(first.handle,'First');const raw=first.raw;
  r.doc.settings.tempo=480;await expect(r.session.save(first.handle,'Second',true)).rejects.toThrow('different file');
  await r.session.save(second.handle,'Second',true);expect(first.raw).toBe(raw);expect(parseDocument(second.raw).settings.tempo).toBe(480);expect(r.session.source?.handle).toBe(second.handle);
});
it('keeps edits made during a slow save dirty instead of claiming they were written',async()=>{
  const r=rig(),target=file();let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});const create=target.handle.createWritable;
  target.handle.createWritable=async()=>{await gate;return create();};
  const saving=r.session.save(target.handle,'First');await vi.waitFor(()=>expect(r.session.busy).toBe(true));
  await Promise.resolve();r.doc.settings.root=7;finish();await saving;
  expect(parseDocument(target.raw).settings.root).toBe(0);expect(r.doc.settings.root).toBe(7);expect(r.session.dirty(r.doc)).toBe(true);
});
it('reverts using an isolated saved snapshot and never accepts an invalid replacement',async()=>{
  const r=rig(),target=file();await r.session.save(target.handle,'First');r.doc.chords[5].notes.push(12);r.session.revert();
  expect(r.apply).toHaveBeenCalledOnce();expect(r.session.dirty(r.doc)).toBe(false);
  r.doc.settings.tempo=360;expect(r.session.baseline.settings.tempo).toBe(240);
  const invalid=freshDocument();invalid.chords[0].notes=[7];expect(()=>r.session.replace(invalid,null,true)).toThrow();expect(r.doc.settings.tempo).toBe(360);
});
it('loads a valid document and keeps its source for the next Save',()=>{
  const r=rig(),next=freshDocument();next.name='Loaded';next.sound='pluck';next.surface.axes=[2,1];const raw=serializeDocument(next),target=file(raw);
  r.session.replace(next,{name:target.handle.name,raw,handle:target.handle},true);
  expect(r.doc).toEqual(next);expect(r.session.saved).toBe(true);expect(r.session.dirty(r.doc)).toBe(false);
});
