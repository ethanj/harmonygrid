import {expect,it} from 'vitest';
import {freshDocument,parseDocument,serializeDocument,selectionOf,changes} from '../../src/document/model';
import {applyEdits,PatternClipboard,parsePattern,SlotDraft} from '../../src/slots/model';
it('preserves exact chord offsets and permits patterns without zero',()=>{
  expect(parsePattern('Open','12, -12, 4','chord')).toEqual({name:'Open',notes:[-12,4,12]});
  expect(parsePattern('Colors','1 4 9','mode').notes).toEqual([1,4,9]);
});
it.each(['','0, 4, 4','0, 1.5','0, nope','128','0x10'])('rejects invalid chord intervals %s',text=>{
  expect(()=>parsePattern('Test',text,'chord')).toThrow();
});
it('rejects mode offsets outside one octave without silently folding',()=>{
  expect(()=>parsePattern('Test','0,12','mode')).toThrow();expect(()=>parsePattern('Test','-1,4','mode')).toThrow();
});
it('copies by value and protects slot 1 through both clipboard and transaction paths',()=>{
  const clipboard=new PatternClipboard(),doc=freshDocument();
  expect(()=>clipboard.paste('chord',1)).toThrow('first');
  clipboard.copy('chord',doc.chords[0]);doc.chords[0].notes.push(12);
  expect(clipboard.paste('chord',1).notes).toEqual([0]);
  const pasted=clipboard.paste('chord',1);pasted.notes.push(7);expect(clipboard.paste('chord',1).notes).toEqual([0]);
  expect(()=>clipboard.paste('chord',0)).toThrow('protected');expect(()=>clipboard.paste('mode',1)).toThrow('Copy a mode');
  expect(()=>applyEdits(freshDocument(),[{kind:'mode',slot:0,pattern:{name:'Replace',notes:[0]}}])).toThrow('protected');
});
it('retains drafts across kinds and slots without mutating the playing document',()=>{
  const doc=freshDocument(),draft=new SlotDraft(doc),original=structuredClone(doc);
  draft.set('chord',5,'Open','-12,4,12');draft.set('mode',6,'Color','1,4,9');
  expect(draft.get('chord',5).text).toBe('-12,4,12');expect(doc).toEqual(original);
  expect(draft.edits()).toHaveLength(2);expect(()=>draft.set('chord',0,'Rename','0')).toThrow('protected');
  draft.set('chord',7,'Invalid','0,0');expect(()=>draft.edits()).toThrow('Chord 8');expect(doc).toEqual(original);
});
it('applies edits atomically and only updates the selected playing pattern',()=>{
  const doc=freshDocument();doc.selection={chord:1,mode:1};const original=structuredClone(doc);
  const next=applyEdits(doc,[{kind:'chord',slot:5,pattern:{name:'Inactive',notes:[-12,12]}},{kind:'mode',slot:1,pattern:{name:'Selected',notes:[1,4,9]}}]);
  expect(next.settings.chord).toEqual(doc.settings.chord);expect(next.settings.mode).toEqual([1,4,9]);expect(doc).toEqual(original);
  expect(()=>applyEdits(doc,[{kind:'chord',slot:5,pattern:{name:'Valid',notes:[0]}},{kind:'mode',slot:6,pattern:{name:'Bad',notes:[12]}}])).toThrow();expect(doc).toEqual(original);
});
it('rejects edits that would make the document unsaveable',()=>{
  expect(()=>applyEdits(freshDocument(),[{kind:'chord',slot:5,pattern:{name:'x'.repeat(1024*1024),notes:[0]}}])).toThrow('1 MiB');
});
it('preserves the selected identity of duplicate patterns across save/load',()=>{
  const doc=freshDocument();doc.chords[5]=structuredClone(doc.chords[1]);doc.selection={chord:5,mode:1};
  const loaded=parseDocument(serializeDocument(doc));expect(selectionOf(loaded).chord).toBe(5);
  const edited=applyEdits(loaded,[{kind:'chord',slot:1,pattern:{name:'Other',notes:[0,12]}}]);expect(edited.settings.chord).toEqual(doc.settings.chord);
  const selected=applyEdits(loaded,[{kind:'chord',slot:5,pattern:{name:'Current',notes:[-12,12]}}]);expect(selected.settings.chord).toEqual([-12,12]);
  const previous=structuredClone(doc);previous.selection!.chord=1;expect(changes(previous,doc)).toEqual(['Selected chord slot changed']);
});
it('loads older documents without selection metadata and rejects contradictory identities',()=>{
  const doc=freshDocument();expect(selectionOf(parseDocument(serializeDocument(doc)))).toEqual({chord:1,mode:1});
  doc.selection={chord:0,mode:1};expect(()=>serializeDocument(doc)).toThrow('does not match');
  doc.selection.chord=10;expect(()=>serializeDocument(doc)).toThrow('selected slot');
});
