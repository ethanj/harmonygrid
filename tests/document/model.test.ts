/*! Copyright (c) 2026 Ethan Joffe */
import {expect,it} from 'vitest';
import {freshDocument,parseDocument,serializeDocument,changes,MAX_FILE_BYTES} from '../../src/document/model';
import {readFile} from '../../src/document/files';
import {chords} from '../../src/fixtures/instruments';
it('round-trips captured intervals, all settings and layout without live latches or device identities',()=>{
  const doc=freshDocument();doc.name='Open <voicings>';doc.chords[5]={name:'Open',notes:[-12,4,12]};doc.modes[5]={name:'Colors',notes:[1,4,9]};doc.settings.chord=[-12,4,12];doc.settings.captureLimit=true;doc.settings.tempo=360;doc.surface.autoButton=true;doc.surface.axes=[2,3];doc.sound='pluck';
  const loaded=parseDocument(serializeDocument(doc));expect(loaded).toEqual(doc);
  expect(Object.keys(loaded)).toEqual(['format','version','outputs','name','chords','modes','settings','sound','surface']);
  expect('controls' in loaded).toBe(false);
});
it('preserves immutable initial fixtures when the live slots change',()=>{
  const prior=chords[5];try{chords[5]={name:'Captured',notes:[0,12]};expect(freshDocument().chords[5]).toEqual(prior);}finally{chords[5]=prior;}
});
it.each([
 ['version',(d:any)=>{d.version=2;}],['format',(d:any)=>{d.format='unrelated';}],['protected chord',(d:any)=>{d.chords[0].notes=[7];}],['protected mode',(d:any)=>{d.modes[0].notes=[0];}],['slots',(d:any)=>d.chords.pop()],['empty mode',(d:any)=>{d.settings.mode=[];}],['duplicate notes',(d:any)=>{d.settings.chord=[0,0];}],['pitch bounds',(d:any)=>{d.chords[3].notes=[128];}],['channel',(d:any)=>{d.settings.midiChannel=16;}],['tempo',(d:any)=>{d.settings.tempo=0;}],['velocity',(d:any)=>{d.settings.velocity='96';}],['boolean',(d:any)=>{d.surface.autoButton='false';}],['axes',(d:any)=>{d.surface.axes=[1000,3];}],['unknown field',(d:any)=>{d.controls={drone:true};}],['missing field',(d:any)=>{delete d.settings.captureLimit;}],['empty name',(d:any)=>{d.name=' ';}],
])('rejects invalid %s before applying any content',(_label,mutate)=>{
  const doc=freshDocument();mutate(doc);expect(()=>parseDocument(JSON.stringify(doc))).toThrow();
});
it('rejects malformed and oversized files',async()=>{
  expect(()=>parseDocument('{bad')).toThrow('valid JSON');
  expect(()=>parseDocument(' '.repeat(MAX_FILE_BYTES+1))).toThrow('1 MiB');
  await expect(readFile(new File([' '.repeat(MAX_FILE_BYTES+1)],'large.json'))).rejects.toThrow('1 MiB');
});
it('tracks reverted values as clean and reports each changed slot and setting',()=>{
  const old=freshDocument(),doc=structuredClone(old);doc.chords[5]={name:'Open',notes:[0,12]};doc.settings.tempo=360;doc.surface.autoButton=true;
  expect(changes(old,doc)).toEqual(['Chord 6 changed to Open','Tempo changed to 360 ticks / min','Auto Button changed']);
  doc.chords[5]=old.chords[5];doc.settings.tempo=240;doc.surface.autoButton=false;expect(changes(old,doc)).toEqual([]);
});

it('migrates legacy performance fields and validates the new saved policies',()=>{
 const old=JSON.parse(serializeDocument(freshDocument()));delete old.outputs;delete old.settings.variations;delete old.settings.captureHoldNumber;old.settings.holdNumber=7;const migrated=parseDocument(JSON.stringify(old));expect(migrated.settings.captureHoldNumber).toBe(7);expect(migrated.outputs).toBeUndefined();expect(migrated.settings.variations.repeatDrone).toBe('off');
 old.settings.variations={...migrated.settings.variations,repeatDrone:'unknown'};expect(()=>parseDocument(JSON.stringify(old))).toThrow();
});
