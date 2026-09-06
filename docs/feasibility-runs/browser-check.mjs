// Real Chromium browser smoke check. No package installation or user profile access.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));await mkdir(root,{recursive:true});
const profile=await mkdtemp(join(root,'.browser-profile-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--mute-audio','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let chromeError='';chrome.stderr.on('data',chunk=>chromeError+=chunk.toString());
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let socket,diagnose;const report={checks:[],errors:[]};
function check(condition,label){report.checks.push({label,pass:!!condition});if(!condition)throw Error(label);console.log(`PASS ${label}`);}
try{
 let port;for(let i=0;i<400;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(50);}}
 if(!port)throw Error(`Chrome did not start: ${chromeError}`);
 const targets=await(await fetch(`http://localhost:${port}/json`)).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 const pending=new Map();let serial=0;
 socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')report.errors.push(msg.params.exceptionDetails);const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout: '+String(params.expression??'')));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const state=()=>evaluate('window.harmonyGrid?.state');
 const exportTrace=async()=>{
  const length=await evaluate('window.__traceExport = window.harmonyGrid.exportTrace(); window.__traceExport.length');
  let result='';for(let offset=0;offset<length;offset+=65536)result+=await evaluate(`window.__traceExport.slice(${offset},${offset+65536})`);
  await evaluate('delete window.__traceExport');return result;
 };
 diagnose=async()=>{
  report.lastState=await state();report.environment=await evaluate('window.harmonyGrid?.environment');report.status=await evaluate('document.getElementById("status")?.textContent');
  await writeFile(join(root,'failure-trace.json'),await exportTrace());
  await writeFile(join(root,'failure.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 };
 const until=async(expression)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}throw Error('Timed out: '+expression);};
 const click=async id=>{
  const p=await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});
 };
 const key=async(k,down=true)=>send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:k,code:k===' '?'Space':k==='Escape'?'Escape':`Key${k.toUpperCase()}`,windowsVirtualKeyCode:k===' '?32:k==='Escape'?27:k.toUpperCase().charCodeAt(0)});
 const tap=async k=>{await key(k);await key(k,false);};
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:process.argv[2]??'http://127.0.0.1:5174/'});
 await until('!!window.harmonyGrid');await pause(200);await click('start');
 await until('window.harmonyGrid.environment.audio?.state === "running"');
 check(await evaluate('window.harmonyGrid.environment.health.renderer === "OffscreenCanvas worker"'),'OffscreenCanvas renderer starts');
 const geometry=await evaluate('(()=>{const r=document.getElementById("grid").getBoundingClientRect();const cell=Math.min(r.width/18,r.height/7);return {left:r.left+(r.width-cell*18)/2,top:r.top+(r.height-cell*7)/2,cell};})()');
 const move=async(col,row)=>send('Input.dispatchMouseEvent',{type:'mouseMoved',x:geometry.left+(col+.5)*geometry.cell,y:geometry.top+(row+.5)*geometry.cell});
 await move(6,2);await pause(400);await until('window.harmonyGrid.state?.played.join() === "60,64,67"');
 check((await state()).filtered.join()==='63','Free playing preserves the filtered chord tone');
 await writeFile(join(root,'01-live-playing.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 await tap('t');await until('window.harmonyGrid.state?.settings.metronome === true');
 const tick=(await state()).tick;await until(`window.harmonyGrid.state.tick > ${tick}`);
 await move(8,4);await pause(25);
 check((await state()).played.join()==='60,64,67','Between-tick drag does not preview the next chord');
 await until('window.harmonyGrid.state.played.join() === "62,65,69"');
 check((await state()).filtered.join()==='66','Next tick commits the moved chord and its filtered tone');
 await key(' ');await move(6,2);await until('window.harmonyGrid.state.controls.sustain && window.harmonyGrid.state.played.join() === "60,64,67"');
 check((await state()).sounding.some(n=>n.pitch===62),'Sustain preserves earlier individual pitches');
 await key(' ',false);await until('!window.harmonyGrid.state.controls.sustain');
 check((await state()).sounding.map(n=>n.pitch).sort((a,b)=>a-b).join()==='60,64,67','Sustain release preserves the current chord');
 await tap('y');await until('window.harmonyGrid.state.controls.drone');await move(8,4);await until('window.harmonyGrid.state.played.join() === "62,65,69"');
 check((await state()).sounding.some(n=>n.pitch===60),'Drone remains while the lead moves');
 await tap('Escape');await until('window.harmonyGrid.state.sounding.length === 0');
 check(Object.values((await state()).controls).every(x=>!x),'All Notes Off clears controls and sound');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'!',code:'Digit1',modifiers:8,windowsVirtualKeyCode:49});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'!',code:'Digit1',modifiers:8,windowsVirtualKeyCode:49});
 await until('window.harmonyGrid.state.settings.mode.length === 12');
 check((await state()).settings.mode.length===12,'Shift plus a number selects a mode using the physical digit key');
 await evaluate('document.querySelector("[data-mode=\\"1\\"]").click()');
 await click('metronome');await until('!window.harmonyGrid.state.settings.metronome');
 // Smooth Clavier changes only clavier gestures, including releases outside it.
 await click('smooth');
 const c4={x:geometry.left+6.5*geometry.cell,y:geometry.top+2.5*geometry.cell};
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...c4,button:'left',buttons:1,clickCount:1});
 await until('window.harmonyGrid.state.played.join() === "60,64,67"');
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',...c4,button:'left',buttons:0,clickCount:1});await pause(100);
 check((await state()).played.join()==='60,64,67','Smooth Clavier does not make Auto Button grid release stop playing');
 const clavier=await evaluate('(()=>{const r=document.getElementById("clavier").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*.8};})()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...clavier,button:'left',buttons:1,clickCount:1});
 await until('window.harmonyGrid.state.played.length > 0');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10,buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:10,y:10,button:'left',buttons:0,clickCount:1});
 await until('window.harmonyGrid.state.sounding.length === 0');
 check((await state()).sounding.length===0,'Smooth Clavier releases outside its bounds with Auto Button on');
 await click('smooth');
 for(let i=0;i<150;i++){await move(4+i%7,1+i%5);await pause(4);}
 await pause(300);
 await writeFile(join(root,'02-live-after-drag.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 check(await evaluate('document.documentElement.scrollHeight <= innerHeight'),'1280×800 surface fits without vertical scrolling');
 report.environment=await evaluate('window.harmonyGrid.environment');
 check(report.errors.length===0,'No uncaught browser errors');
 check((report.environment.health.queueOverflows??0)===0,'No engine queue overflow during smoke check');
 check((report.environment.health.renderOverflows??0)===0,'No renderer snapshot overflow during smoke check');
 check((report.environment.health.peak??0)>0,'The real worklet generated nonzero audio samples');
 check((report.environment.health.nonFiniteSamples??0)===0,'The real worklet generated no non-finite samples');
 await writeFile(join(root,'browser-trace.json'),await exportTrace());
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await pause(300);
 await writeFile(join(root,'03-live-wide.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 await click('panic');await pause(100);
 if(process.argv.includes('--stress')){
  report.scenes=[];
  for(const scene of ['normal','expanded']){
   console.log(`Profiling ${scene} scene with extended chords and Sustain`);
   await send('Page.navigate',{url:`http://127.0.0.1:5174/?scene=${scene}`});await pause(700);await until('!!window.harmonyGrid');await click('start');await until('window.harmonyGrid.environment.audio?.state === "running"');
   await evaluate('document.querySelector("[data-mode=\\"0\\"]").click();document.querySelector("[data-chord=\\"8\\"]").click();');await tap('f');
   const columns=scene==='normal'?16:24,rows=scene==='normal'?12:16;
   const g=await evaluate(`(()=>{const r=document.getElementById('grid').getBoundingClientRect();const cell=Math.min(r.width/${columns},r.height/${rows});return {left:r.left+(r.width-cell*${columns})/2,top:r.top+(r.height-cell*${rows})/2,cell};})()`);
   for(let i=0;i<2000;i++){
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:g.left+(.5+i%13)*g.cell,y:g.top+(.5+(i*7)%rows)*g.cell});await pause(10);
   }
   await pause(200);
   console.log(JSON.stringify(await evaluate('window.harmonyGrid.environment')));
   const raw=await exportTrace();await writeFile(join(root,`${scene}-trace.json`),raw);
   const data=JSON.parse(raw),draws=data.events.filter(e=>e.kind==='draw').map(e=>e.duration).sort((a,b)=>a-b);
   const metrics={scene,columns,rows,syntheticMoves:2000,drawSamples:draws.length,p50DrawMs:draws[Math.floor(draws.length*.5)],p95DrawMs:draws[Math.floor(draws.length*.95)],p99DrawMs:draws[Math.floor(draws.length*.99)],maxDrawMs:draws.at(-1),traceDropped:data.dropped,environment:data.environment};
   report.scenes.push(metrics);console.log(JSON.stringify(metrics));
   check(data.dropped===0,`${scene}: telemetry capture did not overflow`);
   check((data.environment.health.queueOverflows??0)===0&&data.environment.health.nonFiniteSamples===0,`${scene}: audio engine has no queue overflow or non-finite samples`);
   await writeFile(join(root,`${scene}-scene.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
   await click('panic');
  }
 }
 await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true});
}
