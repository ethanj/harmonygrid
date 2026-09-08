import {pitchClass,gridPitch} from '../performance/harmony';
import type {Snapshot} from '../performance/model';
import {pianoKeys,type GridGeometry} from './geometry';
type Context=CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;
const noteFill='#a0dfc8';
export const names=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
export const noteName=(pitch:number)=>`${names[pitchClass(pitch)]}${Math.floor(pitch/12)-1}`;
const circle=(c:Context,x:number,y:number,r:number,fill:string|null,stroke:string)=>{
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}c.strokeStyle=stroke;c.lineWidth=1;c.stroke();
};
function hatch(c:Context,cx:number,cy:number,r:number){
  const x=cx-r,y=cy-r,w=r*2,h=r*2;
  c.save();c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.clip();c.strokeStyle=noteFill;c.lineWidth=.8;
  for(let p=-h;p<w;p+=8){c.beginPath();c.moveTo(x+p,y+h);c.lineTo(x+p+h,y);c.stroke();}c.restore();
}
export function drawGrid(c:Context,g:GridGeometry,s:Snapshot|null):void {
  c.clearRect(0,0,g.width,g.height);c.fillStyle='#141e17';c.fillRect(0,0,g.width,g.height);
  const cell=Math.min(g.width/g.columns,g.height/g.rows),left=(g.width-g.columns*cell)/2,top=(g.height-g.rows*cell)/2;
  const sound=new Set(s?.sounding.map(n=>n.pitch)),filtered=new Set(s?.capture?[]:s?.filtered),raw=new Set(s?.midi),pcs=new Set(s?.midi.map(pitchClass));
  const root=s?.capture?(s.capture.reference===null?-1:pitchClass(s.capture.reference)):s?.settings.root??0,mode=s?.capture?Array.from({length:12},(_,i)=>i):s?.settings.mode??[0,2,4,5,7,9,11];
  for(let row=0;row<g.rows;row++)for(let column=0;column<g.columns;column++){
    const pitch=gridPitch(column,g.rows-1-row,g.base,g.horizontal,g.vertical),x=left+column*cell,y=top+row*cell;
    const unavailable=pitch===null||pitch>(g.maximum??127);
    const pc=pitch===null?-1:pitchClass(pitch),sc=pitch!==null&&mode.includes(pitchClass(pitch-root)),isRoot=pc===root;
    c.fillStyle=pcs.has(pc)?'#344839':sc?'#1b2920':'#152019';c.fillRect(x,y,cell,cell);c.strokeStyle='#334738';c.lineWidth=.8;c.strokeRect(x,y,cell,cell);
    if(unavailable){c.fillStyle='#111a15';c.fillRect(x+1,y+1,cell-2,cell-2);c.strokeStyle='#35453b';c.beginPath();c.moveTo(x+2,y+cell-2);c.lineTo(x+cell-2,y+2);c.stroke();}
    if(pitch===null)continue;
    const sounding=sound.has(pitch),filter=filtered.has(pitch);
    if(sc&&!unavailable||sounding)circle(c,x+cell/2,y+cell/2,cell*.35,sounding?noteFill:null,sounding?noteFill:isRoot?'#a0c6a4':'#45684d');
    if(isRoot&&!unavailable)circle(c,x+cell/2,y+cell/2,cell*.40,null,'#9ac2a0');
    if(filter){hatch(c,x+cell/2,y+cell/2,cell*.35);}
    if(raw.has(pitch)){
      c.strokeStyle='#e1eadd';c.lineWidth=2;c.beginPath();
      for(const [dx,dy,sx,sy]of [[3,3,1,1],[cell-3,3,-1,1],[3,cell-3,1,-1],[cell-3,cell-3,-1,-1]]){c.moveTo(x+dx,y+dy+sy*9);c.lineTo(x+dx,y+dy);c.lineTo(x+dx+sx*9,y+dy);}c.stroke();
    }
    c.fillStyle=sounding?'#123626':unavailable?'#58695e':isRoot?'#c4dfbf':sc?'#a6bba5':'#7f947f';
    c.font=`${sounding?650:450} ${Math.max(10,Math.min(16,cell*.28))}px -apple-system, sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(noteName(pitch),x+cell/2,y+cell/2+1);
  }
}
export function drawPiano(c:Context,width:number,height:number,s:Snapshot|null,low=48,high=84,maximum=127):void {
  c.clearRect(0,0,width,height);
  const sound=new Set(s?.sounding.map(n=>n.pitch)),raw=new Set(s?.midi);
  const root=s?.capture?(s.capture.reference===null?-1:pitchClass(s.capture.reference)):s?.settings.root??0,mode=s?.capture?Array.from({length:12},(_,i)=>i):s?.settings.mode??[0,2,4,5,7,9,11];
  for(const k of pianoKeys(width,height,low,high)){
    const sounding=sound.has(k.pitch),sc=mode.includes(pitchClass(k.pitch-root));
    c.fillStyle=sounding?noteFill:k.pitch>maximum?(k.black?'#303b32':'#3a463c'):k.black?'#18221b':'#c3ccbe';c.fillRect(k.x+.7,0,k.width-1.4,k.height);c.strokeStyle='#526650';c.lineWidth=1;c.strokeRect(k.x+.7,0,k.width-1.4,k.height);
    if(s?.capture?.selected.includes(k.pitch)){c.fillStyle=sounding||!k.black?'#304d37':'#dfe8d9';c.fillRect(k.x+4,4,k.width-8,4);}
    if(raw.has(k.pitch)&&!s?.capture){c.fillStyle=sounding||!k.black?'#304d37':'#dfe8d9';c.fillRect(k.x+4,4,k.width-8,6);}
    if(sc&&k.pitch<=maximum)circle(c,k.x+k.width/2,k.height-22,3.8,pitchClass(k.pitch)===root?(k.black&&!sounding?'#9cae97':'#365541'):null,sounding||!k.black?'#486b51':'#9cae97');
  }
}
