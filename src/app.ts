import {GridStatus} from './grid-settings/status';
import {HelpUI} from './help/ui';
import paletteURL from '../assets/soundfonts/harmony-palette.sf2?url';
import {sounds,type Sound} from './audio/sounds';
import './performance-settings/style.css';
import {PerformanceSettingsUI} from './performance-settings/ui';
import {defaultOutputs,type OutputSettings} from './performance-settings/model';
import './style.css';
import './capture.css';
import './document/style.css';
import './slots/style.css';
import './grid-settings/style.css';
import {GridSettingsUI} from './grid-settings/ui';
import {validateGridOptions,type GridOptions} from './grid-settings/model';
import {SlotUI} from './slots/ui';
import {applyEdits,PatternClipboard,bank,type Kind,type Edit} from './slots/model';
import {DocumentUI} from './document/ui';
import {selectionOf,type InstrumentDocument} from './document/model';
import {CaptureUI} from './capture-ui';
import {mount} from './view';
import {chords,modes} from './fixtures/instruments';
import {defaults,type Frame,type Input,type Settings,type Snapshot,type Control} from './performance/model';
import {hitGrid,hitPiano,hitSmooth,type GridGeometry} from './render/geometry';
import {drawGrid,drawPiano,names,noteName} from './render/draw';
import {KeyboardControls} from './input/keyboard';
import {MidiRouter} from './input/midi';
import {Trace} from './diagnostics/trace';
import {AudioActivity} from './audio/activity';
import workletURL from './audio/instrument.worklet.ts?worker&url';

mount();
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const grid=el<HTMLCanvasElement>('grid'),piano=el<HTMLCanvasElement>('clavier');
const trace=new Trace();
let outputGain:GainNode|null=null;
let outputs=defaultOutputs();
let context:AudioContext|null=null,node:AudioWorkletNode|null=null,starting:Promise<void>|null=null;
const activity=new AudioActivity();
const fetchPalette=()=>fetch(paletteURL,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error('Palette download failed');return r.arrayBuffer();}).catch(()=>null);
let downloadedPalette:ArrayBuffer|null=null;
let paletteBytes=fetchPalette().then(bytes=>downloadedPalette=bytes);
let paletteReady:(value:boolean)=>void=()=>{};
let audioFault:string|null=null,audioSession=0,stopping=false;
let settings=defaults(),current:Snapshot|null=null,lastPitch=60,auto=false,smooth=false,showPiano=true;
const scene=new URLSearchParams(location.search).get('scene');
const benchmarkRows=scene==='normal'?12:scene==='expanded'?16:null;
const benchmarkColumns=scene==='normal'?16:scene==='expanded'?24:18;
let geometry:GridGeometry={width:1,height:1,columns:benchmarkColumns,rows:benchmarkRows??7,base:24,horizontal:4,vertical:3};
let worker:Worker|null=null,inputId=0;
let queue:{snapshot:Snapshot;when:number}[]=[];
const health:Record<string,unknown>={renderer:'initializing'};
const status=(message:string)=>{el('status').textContent=message;};
const keyboard=new KeyboardControls(send,()=>lastPitch,()=>settings.metronome,selectPattern);
const midi=new MidiRouter(send,row=>trace.record(row));midi.configure(false,outputs.generated,outputs.preserveThru,0);
let documentName='Untitled instrument',rootPending:number|null=null,rootPendingSample=0;
let documents:DocumentUI,slots:SlotUI,gridSettings:GridSettingsUI,performanceSettings:PerformanceSettingsUI;
const editing=()=>!!document.querySelector('#slot-editor[open],#grid-settings[open],#performance-settings[open],#help-dialog[open],#grid-status[data-editing="true"]');
let gridLow=24,clavierLow=48;
let gridStatus:GridStatus|undefined;
let selection:{chord:number|null;mode:number|null}={chord:1,mode:1};
const clipboard=new PatternClipboard();
let checkpointId=0;
const checkpoints=new Map<number,{resolve:(settings:Settings)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
let lastCapturePitch:number|null=null,capturePointer=false;
const captureUI=new CaptureUI(send,start,()=>{lastCapturePitch=null;updateAutoButton();requestAnimationFrame(resize);},(kind,slot,name,notes)=>{
  (kind==='chord'?chords:modes)[slot]={name,notes};refreshPatterns();
  selectPattern(kind,slot);
  documents.refresh();
});
function updateAutoButton():void {
  el<HTMLButtonElement>('edit-slots').disabled=captureUI.active||!!gridStatus?.active;
  el<HTMLButtonElement>('axes').disabled=captureUI.active||!!gridStatus?.active;
  el<HTMLButtonElement>('performance-settings-button').disabled=captureUI.active||!!gridStatus?.active;
  for(const id of ['make-chord','make-mode'])el<HTMLButtonElement>(id).disabled=!!gridStatus?.active;
  gridStatus?.sync();
  const enabled=captureUI.active?captureUI.autoButton:auto;
  el('auto').setAttribute('aria-pressed',String(enabled));
  el('auto').textContent=`${enabled?'●':'○'} Auto Button`;
}
function refreshPatterns():void {
  for(const [kind,patterns]of [['chord',chords],['mode',modes]] as const){
    document.querySelectorAll<HTMLElement>(`[data-${kind}]`).forEach(button=>{
      const pattern=patterns[Number(button.dataset[kind])];
      const label=document.createElement('span');label.className='pattern-name';label.textContent=pattern.name;
      const digit=button.querySelector('.slot')!,radio=button.querySelector('.radio');
      button.replaceChildren(...(kind==='chord'?[digit,label]:[radio!,label,digit]));button.title=pattern.name;
    });
  }
}

function documentSnapshot(engineSettings:Settings=settings):InstrumentDocument {
  return {format:'harmony-grid',version:1,outputs:{...outputs},name:documentName,chords:structuredClone(chords),modes:structuredClone(modes),selection:{...selection},
    settings:{...structuredClone(engineSettings),tempo:keyboard.baseTempo},sound:el<HTMLSelectElement>('sound').value as Sound,
    surface:{autoButton:auto,smoothClavier:smooth,showClavier:showPiano,axes:[geometry.horizontal,geometry.vertical],gridLow,clavierLow,thru:midi.thru}};
}
async function readDocument():Promise<InstrumentDocument>{
  if(!node||context?.state!=='running'||audioFault)return documentSnapshot({...settings,root:rootPending??current?.settings.root??settings.root});
  const id=++checkpointId;
  const committed=await new Promise<Settings>((resolve,reject)=>{
    const timer=setTimeout(()=>{checkpoints.delete(id);reject(Error('The instrument could not prepare its settings for saving. Try again.'));},2000);
    checkpoints.set(id,{resolve,reject,timer});node!.port.postMessage({checkpoint:id});
  });
  return documentSnapshot(committed);
}
function applyDocument(doc:InstrumentDocument):void {
  selection=selectionOf(doc);documentName=doc.name;chords.splice(0,chords.length,...structuredClone(doc.chords));modes.splice(0,modes.length,...structuredClone(doc.modes));refreshPatterns();
  outputs=doc.outputs??{internal:true,generated:true,preserveThru:true};
  auto=doc.surface.autoButton;smooth=doc.surface.smoothClavier;showPiano=doc.surface.showClavier;midi.configure(doc.surface.thru,outputs.generated,outputs.preserveThru,doc.settings.midiChannel);
  updateOutputGain();
  gridLow=doc.surface.gridLow??24;clavierLow=doc.surface.clavierLow??48;
  geometry={...geometry,horizontal:doc.surface.axes[0],vertical:doc.surface.axes[1],base:gridLow,maximum:doc.settings.maxPitch};
  updateRangeLabels();el<HTMLSelectElement>('sound').value=doc.sound;
  el('smooth').setAttribute('aria-pressed',String(smooth));el('smooth').textContent=`Smooth Clavier ${smooth?'●':'○'}`;
  el('show-clavier').setAttribute('aria-pressed',String(showPiano));el('show-clavier').textContent=`Show ${showPiano?'●':'○'}`;
  piano.parentElement!.classList.toggle('hidden',!showPiano);el('thru').setAttribute('aria-pressed',String(midi.thru));
  activePointer=null;capturePointer=false;pointerReleaseRequired=physicalPointerDown;lastCapturePitch=null;
  send({type:'document',settings:doc.settings});node?.port.postMessage({sound:doc.sound});updateAutoButton();resize();
}
documents=new DocumentUI(()=>documentSnapshot({...settings,root:rootPending??current?.settings.root??settings.root}),readDocument,applyDocument,name=>{documentName=name;},()=>captureUI.active||editing());

slots=new SlotUI(()=>documentSnapshot(),commitEdits,()=>captureUI.active||documents.active||editing(),clipboard,(...args)=>captureUI.editPattern(...args));
document.getElementById('slot-editor')!.addEventListener('close',()=>documents.refresh());
gridSettings=new GridSettingsUI(()=>({horizontal:geometry.horizontal,vertical:geometry.vertical,gridLow,clavierLow,maximum:settings.maxPitch}),applyGridOptions,()=>captureUI.active||documents.active||slots.active);
document.getElementById('grid-settings')!.addEventListener('close',()=>documents.refresh());
performanceSettings=new PerformanceSettingsUI(()=>documentSnapshot(),(next,out,thru)=>{outputs=out;midi.configure(thru,out.generated,out.preserveThru,next.midiChannel);updateOutputGain();const patch:Partial<Settings>={};for(const key of Object.keys(next) as (keyof Settings)[])if(JSON.stringify(next[key])!==JSON.stringify(settings[key]))Object.assign(patch,{[key]:next[key]});if(Object.keys(patch).length)send({type:'settings',settings:patch});el('thru').setAttribute('aria-pressed',String(thru));documents.refresh();},()=>captureUI.active||documents.active||editing(),()=>midi.output?.name??null);
document.getElementById('performance-settings')!.addEventListener('close',()=>documents.refresh());
gridStatus=new GridStatus(()=>({horizontal:geometry.horizontal,vertical:geometry.vertical,gridLow,clavierLow,maximum:settings.maxPitch}),applyGridOptions,()=>captureUI.active||documents.active||!!document.querySelector('dialog[open]'),()=>{updateAutoButton();documents.refresh();});
new HelpUI(()=>captureUI.active||documents.active||editing(),doc=>documents.openExample(doc));
function updateOutputGain():void {if(context&&outputGain)outputGain.gain.setTargetAtTime(outputs.internal?1:0,context.currentTime,.005);}
function updateRangeLabels():void {
  gridStatus?.sync();
  el('axes').textContent=`→ ${geometry.horizontal} ↑ ${geometry.vertical} · Grid & register…`;
  el('clavier-range').textContent=`${noteName(clavierLow)} – ${noteName(clavierLow+36)}`;
  piano.setAttribute('aria-label',`Clavier: ${noteName(clavierLow)} through ${noteName(clavierLow+36)}`);
}
function applyGridOptions(value:GridOptions):void {
  const v=validateGridOptions(value);
  gridLow=v.gridLow;clavierLow=v.clavierLow;geometry={...geometry,base:gridLow,horizontal:v.horizontal,vertical:v.vertical,maximum:v.maximum};
  activePointer=null;capturePointer=false;pointerReleaseRequired=physicalPointerDown;mappingPointer={...lastPointerPosition};lastCapturePitch=null;
  if(settings.maxPitch!==v.maximum)send({type:'settings',settings:{maxPitch:v.maximum}});
  updateRangeLabels();resize();documents.refresh();
}
function selectPattern(kind:Kind,slot:number):void {
  selection[kind]=slot;
  send({type:'settings',settings:{[kind]:(kind==='chord'?chords:modes)[slot].notes}});
  if(current)updateLabels(current);
}
function commitEdits(edits:Edit[]):void {
  const before=documentSnapshot(),next=applyEdits(before,edits);
  chords.splice(0,chords.length,...next.chords);modes.splice(0,modes.length,...next.modes);refreshPatterns();
  const patch:Partial<Settings>={};
  for(const kind of ['chord','mode'] as const)if(before.settings[kind].join()!==next.settings[kind].join())patch[kind]=next.settings[kind];
  if(Object.keys(patch).length)send({type:'settings',settings:patch});
  if(current)updateLabels(current);documents.refresh();
}
window.addEventListener('keydown',event=>{
  if(editing()||documents.active||captureUI.active||event.altKey||event.repeat)return;
  if((event.target as HTMLElement).closest?.('input,textarea,select,dialog,[contenteditable]'))return;
  const key=event.key.toLowerCase();if(key!=='c'&&key!=='v')return;
  event.preventDefault();
  const kind:Kind=event.shiftKey!==event.getModifierState('CapsLock')?'mode':'chord',slot=selection[kind];
  try{
    if(slot===null)throw Error(`Select a ${kind} slot first.`);
    if(key==='c'){clipboard.copy(kind,documentSnapshot()[bank(kind)][slot]);status(clipboard.label);}
    else{commitEdits([{kind,slot,pattern:clipboard.paste(kind,slot)}]);status(`Pasted ${kind} into slot ${(slot+1)%10}`);}
  }catch(error){status((error as Error).message);}
});

function send(input:Input):void {
  if((documents?.active||editing())&&(input.type==='pointer'||input.type==='midiOn'))return;
  if(input.type==='settings'){settings={...settings,...input.settings};if(input.settings.root!==undefined){rootPending=input.settings.root;rootPendingSample=Math.ceil((context?.currentTime??0)*(context?.sampleRate??1));}}
  if(input.type==='document'){captureUI.reset();settings={...defaults(),...input.settings};rootPending=settings.root;rootPendingSample=Math.ceil((context?.currentTime??0)*(context?.sampleRate??1));keyboard.reset(settings.tempo);queue=[];midi.silenceOutput();}
  if(input.type==='panic'){captureUI.reset();keyboard.reset();queue=[];midi.silenceOutput();}
  const id=++inputId,sent=performance.now();trace.record({kind:'input',id,sent,input});
  if(node)node.port.postMessage({input,id,sent});
  else if(input.type==='settings'||input.type==='document'||input.type==='panic'){
    const snapshot:Snapshot={sample:0,eventId:0,tick:0,lead:lastPitch,settings,controls:{sustain:false,hold:false,drone:false,repeat:false},played:[],filtered:[],sounding:[],midi:[]};
    present(snapshot,performance.now());
  }
}

function outputTime(sample:number):number {
  if(!context)return performance.now();
  const stamp=context.getOutputTimestamp();
  if(stamp.performanceTime!==undefined&&stamp.performanceTime>0&&stamp.contextTime!==undefined)return stamp.performanceTime+(sample/context.sampleRate-stamp.contextTime)*1000;
  return performance.now()+(sample/context.sampleRate-context.currentTime+context.baseLatency+(context.outputLatency||0))*1000;
}

function failedAudio(message:string,details:unknown=null):void {
  if(audioFault)return;
  audioFault=message;
  health.audioFault={message,details,at:performance.now()};
  trace.record({kind:'audio-fault',...health.audioFault as object});
  node?.disconnect();midi.silenceOutput();
  el<HTMLButtonElement>('start').disabled=false;el('start').textContent='Restart sound';
  status(`${message} · click Restart sound`);
}
setInterval(()=>{
  if(!context||starting||audioFault)return;
  const problem=activity.check(performance.now(),context.currentTime,context.state);
  if(problem)failedAudio(problem,{clock:context.currentTime,lastSample:health.sample});
},500);

let automaticSound=true;
async function start(automatic=false):Promise<void>{
  if(stopping)return;
  if(starting)return starting;
  el<HTMLButtonElement>('start').disabled=true;
  starting=(async()=>{
    try{
      if(audioFault||context?.state==='closed'){
        const old=context;context=null;
        if(node){node.port.onmessage=null;node.port.close();node.disconnect();node=null;}
        if(old){old.onstatechange=null;void old.close().catch(()=>{});}
        audioFault=null;queue=[];current=null;worker?.postMessage({kind:'clear'});
        keyboard.reset(settings.tempo);midi.silenceOutput();
      }
      if(!context){
        context=new AudioContext({latencyHint:'interactive'});
        const session=++audioSession;
        await context.audioWorklet.addModule(workletURL);
        node=new AudioWorkletNode(context,'harmony-grid',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
        outputGain=context.createGain();outputGain.gain.value=outputs.internal?1:0;node.connect(outputGain);outputGain.connect(context.destination);
        node.onprocessorerror=()=>{if(session===audioSession)failedAudio('Audio processor failed');};
        node.port.onmessage=({data})=>{
          if(session!==audioSession||audioFault)return;
          if(data.kind==='palette'){health.palette=data.ready?'ready':'unavailable';paletteReady(data.ready);return;}
          if(data.kind==='checkpoint'){const request=checkpoints.get(data.id);if(request){clearTimeout(request.timer);checkpoints.delete(data.id);request.resolve(data.settings);}return;}
          if(data.kind==='processor-fault'){failedAudio('Audio processor failed',data);return;}
          if(data.kind==='frames'||data.kind==='health')activity.received(performance.now());
          if(data.kind==='frames')for(const frame of data.frames as Frame[]){
            const when=outputTime(frame.sample);
            trace.record({kind:'commit',eventId:frame.snapshot.eventId,sample:frame.sample,received:performance.now(),target:when,actions:frame.actions});
            midi.schedule(frame.actions,when);present(frame.snapshot,when);
          } else {trace.record(data);if(data.kind==='health')Object.assign(health,data);}
        };
        const bank=downloadedPalette;
        if(bank){status('Preparing sound palette…');await new Promise<boolean>(resolve=>{const timer=setTimeout(()=>resolve(false),10000);paletteReady=value=>{clearTimeout(timer);resolve(value);};node!.port.postMessage({bank:bank.slice(0)});});}else health.palette='unavailable';
        el<HTMLButtonElement>('retry-palette').hidden=health.palette==='ready';
        el('sound').title=health.palette==='ready'?'Palette ready · new attacks use the selected sound':'Sampled palette unavailable · instant organ fallback';
        node.port.postMessage({input:{type:'document',settings}});
        node.port.postMessage({sound:el<HTMLSelectElement>('sound').value});
        context.onstatechange=()=>{
          trace.record({kind:'audio-state',state:context?.state,at:performance.now(),clock:context?.currentTime});
          if(audioFault)return;
          activity.reset(performance.now(),context?.currentTime??0);
          el<HTMLButtonElement>('start').disabled=false;el('start').textContent=context?.state==='running'?'Stop Sound':'Resume sound';status(context?.state==='running'?'Ready · drag the grid':`Audio ${context?.state} · click Resume sound`);
        };
      }
      if(automatic && context.state!=='running'){
        // Autoplay may stay suspended until a trusted pointer/key gesture.
        void context.resume().catch(()=>{});
        el<HTMLButtonElement>('start').disabled=false;
        el('start').textContent='Start sound';
        status('Sound ready · click the grid or press a key to play');
        return;
      }
      await context.resume();
      activity.reset(performance.now(),context.currentTime);
      if(audioFault)return;
      midi.enabled=true;el<HTMLButtonElement>('start').disabled=false;el('start').textContent='Stop Sound';status(health.palette==='ready'?'Ready · drag the grid':'Ready · instant sounds · Retry palette for sampled sounds');
    }catch(error){failedAudio(`Audio unavailable: ${(error as Error).message}`);throw error;}
    finally{starting=null;}
  })();return starting;
}

function present(snapshot:Snapshot,when:number):void {
  if(document.hidden)queue=[];
  queue.push({snapshot,when});if(queue.length>128){queue.shift();health.presentationOverflows=Number(health.presentationOverflows??0)+1;}
  worker?.postMessage({kind:'snapshot',snapshot,time:performance.timeOrigin+when});
}
function updateLabels(snapshot:Snapshot):void {
  const s=snapshot.settings;
  if(snapshot.sample>=rootPendingSample)rootPending=null;
  captureUI.update(snapshot);
  documents.refresh();
  el('root').textContent=names[s.root];el('mode-name').textContent=(selection.mode!==null&&modes[selection.mode].notes.join()===s.mode.join()?modes[selection.mode]:modes.find(m=>m.notes.join()===s.mode.join()))?.name??'Custom';
  el('tempo').textContent=String(s.tempo);el('metro-state').textContent=s.metronome?'ON':'OFF';el('metronome').setAttribute('aria-pressed',String(s.metronome));
  el('lead').textContent=`Lead ${noteName(snapshot.lead)}`;
  document.querySelectorAll<HTMLElement>('[data-chord]').forEach(button=>button.classList.toggle('active',Number(button.dataset.chord)===selection.chord&&chords[Number(button.dataset.chord)].notes.join()===s.chord.join()));
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach(button=>button.classList.toggle('active',Number(button.dataset.mode)===selection.mode&&modes[Number(button.dataset.mode)].notes.join()===s.mode.join()));
  document.querySelectorAll<HTMLElement>('[data-control]').forEach(button=>{const active=snapshot.controls[button.dataset.control as Control];button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('.pulse').forEach((pulse,i)=>pulse.classList.toggle('lit',snapshot.tick%2===i));
  for(const key of ['playChords','mouseSolo','setsRoot'] as const)el(key).setAttribute('aria-pressed',String(s[key]));
}
function animate(){
  let changed=false;
  while(queue.length&&queue[0].when<=performance.now()){
    const next=queue.shift()!.snapshot;
    // Preserve short-lived capture transitions even if they share a display frame.
    if(current?.capture?.phase!==next.capture?.phase)captureUI.update(next);
    current=next;changed=true;
  }
  if(changed&&current){updateLabels(current);if(!worker)drawFallback();}
  requestAnimationFrame(animate);
}
function drawFallback(){
  const ratio=devicePixelRatio||1;
  const gc=grid.getContext('2d')!,pc=piano.getContext('2d')!;
  gc.setTransform(ratio,0,0,ratio,0,0);pc.setTransform(ratio,0,0,ratio,0,0);
  drawGrid(gc,geometry,current);drawPiano(pc,piano.clientWidth,piano.clientHeight,current,clavierLow,clavierLow+36,geometry.maximum);
}
function resize(){
  geometry={...geometry,width:grid.clientWidth,height:grid.clientHeight,columns:captureUI.active?14:benchmarkColumns,base:gridLow,maximum:settings.maxPitch,rows:captureUI.active?6:benchmarkRows??((innerWidth>=1450?8:7)+(showPiano?0:2))};
  document.documentElement.style.setProperty('--beat-size',`${Math.min(geometry.width/geometry.columns,geometry.height/geometry.rows)/2}px`);
  const keyboardSize={width:piano.clientWidth||grid.clientWidth,height:piano.clientHeight||95,low:clavierLow,high:clavierLow+36,maximum:settings.maxPitch};
  if(worker)worker.postMessage({kind:'resize',geometry,keyboard:keyboardSize,scale:devicePixelRatio||1});
  else{grid.width=geometry.width*devicePixelRatio;grid.height=geometry.height*devicePixelRatio;piano.width=keyboardSize.width*devicePixelRatio;piano.height=keyboardSize.height*devicePixelRatio;drawFallback();}
}
if('transferControlToOffscreen' in grid){
  worker=new Worker(new URL('./render/renderer.worker.ts',import.meta.url),{type:'module'});
  const offgrid=grid.transferControlToOffscreen(),offpiano=piano.transferControlToOffscreen();
  worker.postMessage({kind:'init',grid:offgrid,piano:offpiano},[offgrid,offpiano]);health.renderer='OffscreenCanvas worker';
  worker.onmessage=({data})=>{trace.record(data);Object.assign(health,{drawCount:data.drawCount,maxDrawMs:data.maxDuration,meanDrawMs:data.totalDuration/data.drawCount,renderOverflows:data.overflow});};
  worker.onerror=event=>status(`Rendering stopped: ${event.message}`);
}else health.renderer='main-thread Canvas fallback';
new ResizeObserver(resize).observe(el('instrument'));resize();requestAnimationFrame(animate);

function pointerPitch(event:PointerEvent):{pitch:number|null;clavier:boolean}{
  const r=piano.getBoundingClientRect();
  if(showPiano&&event.clientX>=r.left&&event.clientX<r.right&&event.clientY>=r.top&&event.clientY<r.bottom){
    const x=event.clientX-r.left,y=event.clientY-r.top;
    const pitch=smooth&&!captureUI.active?hitSmooth(x,r.width,clavierLow,clavierLow+36,current?.settings.root??settings.root,current?.settings.mode??settings.mode):hitPiano(x,y,r.width,r.height,clavierLow,clavierLow+36);
    return {pitch:pitch!==null&&pitch<=settings.maxPitch?pitch:null,clavier:true};
  }
  const g=grid.getBoundingClientRect();return {pitch:hitGrid(event.clientX-g.left,event.clientY-g.top,geometry),clavier:false};
}
let lastPointerPosition={x:0,y:0},mappingPointer:{x:number;y:number}|null=null;
window.addEventListener('pointermove',event=>{lastPointerPosition={x:event.clientX,y:event.clientY};},true);
let activePointer:number|null=null,pointerNeedsButton=false,physicalPointerDown=false,pointerReleaseRequired=false;
window.addEventListener('pointerdown',()=>{physicalPointerDown=true;},true);
window.addEventListener('pointerup',()=>{physicalPointerDown=false;pointerReleaseRequired=false;},true);
window.addEventListener('pointercancel',()=>{physicalPointerDown=false;pointerReleaseRequired=false;},true);
function move(event:PointerEvent,press=false){
  if(documents.active||editing())return;
  if(mappingPointer){if(!press&&event.clientX===mappingPointer.x&&event.clientY===mappingPointer.y)return;mappingPointer=null;}
  if(pointerReleaseRequired){if(event.buttons)return;pointerReleaseRequired=false;}
  const hit=pointerPitch(event);if(hit.pitch===null){lastCapturePitch=null;if(!captureUI.active)send({type:'release'});return;}
  if(captureUI.active){
    if(captureUI.collecting&&(captureUI.autoButton||activePointer!==null)&&(press||hit.pitch!==lastCapturePitch))captureUI.select(hit.pitch);
    lastCapturePitch=hit.pitch;return;
  }
  lastPitch=hit.pitch;
  pointerNeedsButton=hit.clavier&&smooth;
  if(press&&auto&&!(hit.clavier&&smooth))send({type:'settings',settings:{root:lastPitch%12}});
  const down=pointerNeedsButton?activePointer!==null:auto||activePointer!==null;
  send({type:'pointer',pitch:lastPitch,down,strike:press});
  piano.classList.toggle('smooth-drag',hit.clavier&&smooth&&activePointer!==null);
}
for(const canvas of [grid,piano]){
  canvas.addEventListener('blur',()=>canvas.classList.remove('pointer-focus'));
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0||pointerReleaseRequired)return;event.preventDefault();canvas.classList.add('pointer-focus');canvas.focus({preventScroll:true});capturePointer=captureUI.active;activePointer=event.pointerId;canvas.setPointerCapture(event.pointerId);move(event,true);});
  canvas.addEventListener('pointermove',event=>{
    if(activePointer!==null&&(event.buttons&1)===0){activePointer=null;trace.record({kind:'pointer-release-resynchronized',at:performance.now()});}
    if(activePointer===null&&(event.buttons&1)!==0)activePointer=event.pointerId;
    move(event);
  });
  canvas.addEventListener('pointerleave',()=>{
    lastCapturePitch=null;piano.classList.remove('smooth-drag');
    if(!captureUI.active)send({type:'release'});
  });
  canvas.addEventListener('pointercancel',()=>{activePointer=null;lastCapturePitch=null;piano.classList.remove('smooth-drag');if(!capturePointer)send({type:'release'});capturePointer=false;});
}
window.addEventListener('pointerup',event=>{
  if(activePointer!==event.pointerId)return;
  activePointer=null;piano.classList.remove('smooth-drag');
  if(capturePointer){capturePointer=false;if(!captureUI.autoButton)lastCapturePitch=null;return;}
  if(!auto||pointerNeedsButton)send({type:'release'});
});
window.addEventListener('blur',()=>trace.record({kind:'blur',at:performance.now()}));
window.addEventListener('focus',()=>trace.record({kind:'focus',at:performance.now()}));
keyboard.bind();
async function stopSound():Promise<void>{
  if(stopping||starting)return;
  automaticSound=false;
  stopping=true;el<HTMLButtonElement>('start').disabled=true;
  settings={...settings,root:rootPending??current?.settings.root??settings.root,tempo:keyboard.baseTempo};
  const old=context;context=null;audioSession++;
  if(old)old.onstatechange=null;
  if(node){node.port.onmessage=null;node.port.close();node.disconnect();node=null;}
  outputGain?.disconnect();outputGain=null;
  activePointer=null;capturePointer=false;lastCapturePitch=null;
  piano.classList.remove('smooth-drag');
  worker?.postMessage({kind:'clear'});audioFault=null;
  send({type:'panic'});midi.enabled=false;
  try{if(old&&old.state!=='closed')await old.close();}
  finally{stopping=false;el<HTMLButtonElement>('start').disabled=false;el('start').textContent='Start sound';status('Sound stopped · click Start sound to play');}
}
el('start').onclick=()=>{void (context?.state==='running'&&!audioFault?stopSound():start()).catch(()=>{});};
el('panic').onclick=()=>send({type:'panic'});

el('set-root').onclick=()=>send({type:'settings',settings:{root:lastPitch%12}});
el('metronome').onclick=()=>send({type:'settings',settings:{metronome:!settings.metronome}});
document.querySelectorAll<HTMLElement>('[data-chord]').forEach(button=>button.onclick=()=>selectPattern('chord',Number(button.dataset.chord)));
document.querySelectorAll<HTMLElement>('[data-mode]').forEach(button=>button.onclick=()=>selectPattern('mode',Number(button.dataset.mode)));
document.querySelectorAll<HTMLElement>('[data-control]').forEach(button=>button.onclick=()=>keyboard.toggle(button.dataset.control as Control));
document.querySelectorAll<HTMLElement>('[data-tempo]').forEach(button=>{
  button.onpointerdown=event=>{button.setPointerCapture(event.pointerId);keyboard.tempo(button.dataset.tempo!,true,event.metaKey);};
  button.onpointerup=()=>keyboard.tempo(button.dataset.tempo!,false);
  button.onpointercancel=()=>keyboard.tempo(button.dataset.tempo!,false);
});
el('slower').onclick=()=>keyboard.increment(-1);el('faster').onclick=()=>keyboard.increment(1);
el<HTMLSelectElement>('sound').onchange=event=>{node?.port.postMessage({sound:(event.target as HTMLSelectElement).value});documents.refresh();const sound=(event.target as HTMLSelectElement).value as Sound;if(health.palette!=='ready'&&sound!=='organ'&&sound!=='pluck')status(`${sounds[sound]} requested · Organ fallback · Retry palette`);};
el('retry-palette').onclick=async()=>{send({type:'panic'});failedAudio('Reloading sound palette');paletteBytes=fetchPalette().then(bytes=>downloadedPalette=bytes);await paletteBytes;await start();};

el('auto').onclick=()=>{
  if(captureUI.active){captureUI.autoButton=!captureUI.autoButton;lastCapturePitch=null;}
  else{auto=!auto;if(!auto&&activePointer===null)send({type:'release'});}
  updateAutoButton();
};
el('smooth').onclick=()=>{smooth=!smooth;el('smooth').setAttribute('aria-pressed',String(smooth));el('smooth').textContent=`Smooth Clavier ${smooth?'●':'○'}`;};
el('show-clavier').onclick=()=>{showPiano=!showPiano;el('show-clavier').setAttribute('aria-pressed',String(showPiano));el('show-clavier').textContent=`Show ${showPiano?'●':'○'}`;piano.parentElement!.classList.toggle('hidden',!showPiano);resize();};
for(const key of ['playChords','mouseSolo','setsRoot'] as const)el(key).onclick=()=>send({type:'settings',settings:{[key]:!settings[key]}});
el('thru').onclick=()=>{midi.configure(!midi.thru,outputs.generated,outputs.preserveThru,settings.midiChannel);el('thru').setAttribute('aria-pressed',String(midi.thru));};
function ports(){
  for(const [id,ports]of [['midi-input',midi.access?.inputs],['midi-output',midi.access?.outputs]] as const){
    const select=el<HTMLSelectElement>(id),previous=select.value;select.replaceChildren(new Option(id==='midi-input'?'MIDI input':'MIDI output',''));
    ports?.forEach(port=>{if(port.state==='connected')select.add(new Option(port.name??port.id,port.id));});select.value=previous;
  }
  if(midi.input?.state==='disconnected')midi.chooseInput('');
  if(midi.output?.state==='disconnected'){midi.chooseOutput('');status('MIDI output disconnected · choose an output to reconnect');}
}
el('connect-midi').onclick=async()=>{try{await start();await midi.connect();ports();if(midi.access)midi.access.onstatechange=ports;status('MIDI ready · select ports');}catch(error){status((error as Error).message);}};
el<HTMLSelectElement>('midi-input').onchange=event=>midi.chooseInput((event.target as HTMLSelectElement).value);
el<HTMLSelectElement>('midi-output').onchange=event=>midi.chooseOutput((event.target as HTMLSelectElement).value);
const environment=()=>({userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,scale:devicePixelRatio},audio:context?{session:audioSession,fault:audioFault,state:context.state,currentTime:context.currentTime,outputTimestamp:context.getOutputTimestamp(),sampleRate:context.sampleRate,baseLatency:context.baseLatency,outputLatency:context.outputLatency}:null,health,midi:{input:midi.input?.name,output:midi.output?.name,lateOutputs:midi.lateOutputs,lastError:midi.lastError}});
el('export').onclick=()=>{const url=URL.createObjectURL(new Blob([trace.export(environment())],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='harmonygrid-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
// Read-only diagnostics exposed for local verification; browser input still uses real adapters.
Object.assign(window,{harmonyGrid:{get state(){return current;},get environment(){return environment();},exportTrace:()=>trace.export(environment())}});

document.addEventListener('click',()=>documents.refresh());
document.addEventListener('change',()=>documents.refresh());

function keyboardTarget(event:KeyboardEvent):void {
  const mode=event.shiftKey!==event.getModifierState('CapsLock');
  gridStatus?.target(mode);
  el('selection-target').textContent=`Digits → ${mode?'Modes':'Chords'}`;
  el('selection-target').classList.toggle('target-active',mode);
}
window.addEventListener('keydown',keyboardTarget,true);window.addEventListener('keyup',keyboardTarget,true);
window.addEventListener('blur',()=>{gridStatus?.target(null);el('selection-target').textContent='Shift / Caps + 0–9';});

document.addEventListener('visibilitychange',()=>{
  trace.record({kind:'visibility',hidden:document.hidden,at:performance.now()});
  worker?.postMessage({kind:'visibility',hidden:document.hidden});
  if(!document.hidden){queue=queue.slice(-1);resize();}
});

// Prepare audio by default; a browser autoplay gate is unlocked by the first
// gesture. Explicit Stop disables this behavior for the remainder of the visit.
function unlockDefaultSound(event:Event):void {
  if(!automaticSound||audioFault||stopping||context?.state==='running')return;
  if(event.target instanceof Element&&event.target.closest('#start'))return;
  if(context)void context.resume().catch(()=>{});
  if(!starting)void start().catch(()=>{});
}
window.addEventListener('pointerdown',unlockDefaultSound,true);
window.addEventListener('keydown',unlockDefaultSound,true);
void start(true).catch(()=>{});
