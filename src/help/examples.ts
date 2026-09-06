import {freshDocument,validateDocument,type InstrumentDocument} from '../document/model';
import type {Sound} from '../audio/sounds';
interface Study {name:string;description:string;chord:number[];mode:number[];axes:[number,number];sound:Sound;}
export const studies:Study[]=[
 {name:'Open voicings',description:'Wide major chords. Drag with Sustain, then set a new scale root with Tab.',chord:[0,7,16],mode:[0,2,4,5,7,9,11],axes:[4,3],sound:'piano'},
 {name:'Pentatonic space',description:'Five mode tones and sparse chords. Turn on the metronome and hold Repeat.',chord:[0,7,12],mode:[0,2,4,7,9],axes:[5,7],sound:'electric'},
 {name:'Modal colour',description:'Dorian colour on the fourths/fifths grid. Move the lead while a Drone continues.',chord:[0,3,7,10],mode:[0,2,3,5,7,9,10],axes:[5,7],sound:'tonewheel'},
 {name:'Chromatic columns',description:'Semitones to the right, octaves upward. Compare repeated occurrences of the same pitch.',chord:[0,4,7],mode:[0,1,2,3,4,5,6,7,8,9,10,11],axes:[1,12],sound:'vibes'},
 {name:'Whole tone motion',description:'Six evenly spaced mode tones. The complete chord shows which pitches the mode filters.',chord:[0,4,7,10],mode:[0,2,4,6,8,10],axes:[2,3],sound:'electric'},
 {name:'Minor ninths',description:'An extended minor voicing. Try the Smooth Clavier with Auto Button off.',chord:[0,3,7,10,14],mode:[0,2,3,5,7,8,10],axes:[4,3],sound:'piano'},
];
export function studyDocument(index:number):InstrumentDocument {
 const study=studies[index];if(!study)throw Error('Unknown example.');
 const d=freshDocument();d.name=study.name;d.chords[1]={name:study.name,notes:[...study.chord]};d.modes[1]={name:study.name,notes:[...study.mode]};d.settings.chord=[...study.chord];d.settings.mode=[...study.mode];d.surface.axes=[...study.axes];d.sound=study.sound;d.selection={chord:1,mode:1};return validateDocument(d);
}
