/*! Copyright (c) 2026 Ethan Joffe */
import {gridPitch,pitchClass} from '../performance/harmony';
export interface GridGeometry {width:number;height:number;columns:number;rows:number;base:number;horizontal:number;vertical:number;maximum?:number;}
export function hitGrid(x:number,y:number,g:GridGeometry):number|null {
  const cell=Math.min(g.width/g.columns,g.height/g.rows);
  const left=(g.width-cell*g.columns)/2,top=(g.height-cell*g.rows)/2;
  const column=Math.floor((x-left)/cell),row=Math.floor((y-top)/cell);
  if(column<0||column>=g.columns||row<0||row>=g.rows)return null;
  const pitch=gridPitch(column,g.rows-1-row,g.base,g.horizontal,g.vertical);
  return pitch!==null&&pitch<=(g.maximum??127)?pitch:null;
}
export interface PianoKey {pitch:number;x:number;width:number;height:number;black:boolean;}
export function pianoKeys(width:number,height:number,low=48,high=84):PianoKey[] {
  const white=[0,2,4,5,7,9,11],notes:number[]=[];
  for(let pitch=low;pitch<=high;pitch++)if(white.includes(pitchClass(pitch)))notes.push(pitch);
  const keyWidth=width/notes.length;
  const keys=notes.map((pitch,i)=>({pitch,x:i*keyWidth,width:keyWidth,height,black:false}));
  for(let pitch=low;pitch<=high;pitch++)if(!white.includes(pitchClass(pitch))){
    const before=notes.filter(n=>n<pitch).length;
    keys.push({pitch,x:before*keyWidth-keyWidth*.3,width:keyWidth*.6,height:height*.61,black:true});
  }
  return keys;
}
export function hitPiano(x:number,y:number,width:number,height:number,low=48,high=84):number|null {
  if(x<0||x>=width||y<0||y>=height)return null;
  return pianoKeys(width,height,low,high).reverse().find(k=>x>=k.x&&x<k.x+k.width&&y<k.height)?.pitch??null;
}
/** Equal subdivisions within each octave; the displayed clavier stays conventional. */
export function hitSmooth(x:number,width:number,low:number,high:number,root:number,mode:readonly number[]):number|null {
  if(x<0||x>=width||!mode.length)return null;
  const tones:number[]=[];
  for(let pitch=low;pitch<=high;pitch++)if(mode.includes(pitchClass(pitch-root)))tones.push(pitch);
  return tones[Math.min(tones.length-1,Math.floor(x/width*tones.length))]??null;
}
