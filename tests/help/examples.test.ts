import {expect,it} from 'vitest';
import {studies,studyDocument} from '../../src/help/examples';
import {parseDocument,serializeDocument} from '../../src/document/model';
for(let i=0;i<studies.length;i++)it(`round-trips playable study ${studies[i].name}`,()=>{const d=studyDocument(i);expect(parseDocument(serializeDocument(d))).toEqual(d);expect(d.chords[1].notes).toEqual(d.settings.chord);expect(d.modes[1].notes).toEqual(d.settings.mode);});
