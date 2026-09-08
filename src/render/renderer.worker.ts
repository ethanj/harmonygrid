/*! Copyright (c) 2026 Ethan Joffe */
import {drawGrid,drawPiano} from './draw';
import type {GridGeometry} from './geometry';
import type {Snapshot} from '../performance/model';
let grid:OffscreenCanvas,piano:OffscreenCanvas;
let geometry:GridGeometry,keyboard={width:1,height:1,low:48,high:84,maximum:127};
let scale=1,snapshot:Snapshot|null=null,dirty=true;
let pending:{snapshot:Snapshot;time:number}[]=[];
let overflow=0,hidden=false;
let drawCount=0,totalDuration=0,maxDuration=0;
self.onmessage=({data})=>{
  if(data.kind==='visibility'){hidden=data.hidden;if(!hidden)dirty=true;}
  if(data.kind==='clear'){pending=[];snapshot=null;dirty=true;}
  if(data.kind==='init'){grid=data.grid;piano=data.piano;}
  if(data.kind==='resize'){
    geometry=data.geometry;keyboard=data.keyboard;scale=data.scale;
    grid.width=Math.round(geometry.width*scale);grid.height=Math.round(geometry.height*scale);
    piano.width=Math.round(keyboard.width*scale);piano.height=Math.round(keyboard.height*scale);dirty=true;
  }
  if(data.kind==='snapshot'){
    if(hidden){snapshot=data.snapshot;pending=[];dirty=true;return;}
    pending.push({snapshot:data.snapshot,time:data.time});
    if(pending.length>128){pending.shift();overflow++;}
  }
};
function draw(){
  const now=performance.timeOrigin+performance.now();
  while(pending.length&&pending[0].time<=now){snapshot=pending.shift()!.snapshot;dirty=true;}
  if(dirty&&geometry){
    const start=performance.now();
    const gc=grid.getContext('2d')!,pc=piano.getContext('2d')!;
    gc.setTransform(scale,0,0,scale,0,0);pc.setTransform(scale,0,0,scale,0,0);
    drawGrid(gc,geometry,snapshot);drawPiano(pc,keyboard.width,keyboard.height,snapshot,keyboard.low,keyboard.high,keyboard.maximum);dirty=false;
    const duration=performance.now()-start;drawCount++;totalDuration+=duration;maxDuration=Math.max(maxDuration,duration);
    self.postMessage({kind:'draw',eventId:snapshot?.eventId,sample:snapshot?.sample,duration,at:performance.timeOrigin+performance.now(),drawCount,totalDuration,maxDuration,overflow});
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
