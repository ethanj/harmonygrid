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
 const key=async(k,down=true)=>send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:k,code:k===' '?'Space':k==='Escape'?'Escape':k==='Tab'?'Tab':/^\d$/.test(k)?`Digit${k}`:`Key${k.toUpperCase()}`,windowsVirtualKeyCode:k===' '?32:k==='Escape'?27:k.toUpperCase().charCodeAt(0)});
 const tap=async k=>{await key(k);await key(k,false);};
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:process.argv[2]??'http://127.0.0.1:5174/'});
 await until('!!window.harmonyGrid');await pause(200);await click('start');
 await until('window.harmonyGrid.environment.audio?.state === "running"');
 check(await evaluate('window.harmonyGrid.environment.health.renderer === "OffscreenCanvas worker"'),'OffscreenCanvas renderer starts');
 const shot=async name=>writeFile(join(root,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 const gridPoint=async(col,row,capture=false)=>evaluate(`(()=>{const r=document.getElementById('grid').getBoundingClientRect(),columns=${capture?14:18},rows=${capture?6:7},cell=Math.min(r.width/columns,r.height/rows);return{x:r.left+(r.width-cell*columns)/2+( ${col}+.5)*cell,y:r.top+(r.height-cell*rows)/2+(${row}+.5)*cell};})()`);
 const move=async(col,row,capture=false)=>send('Input.dispatchMouseEvent',{type:'mouseMoved',...await gridPoint(col,row,capture)});
 const press=async(col,row)=>{const p=await gridPoint(col,row,true);await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});await pause(80);};
 const capture=async()=> (await state()).capture;
 await until('!!window.harmonyGrid.state');
 await move(6,2);await until('window.harmonyGrid.state.played.includes(60)');await tap('y');await until('window.harmonyGrid.state.controls.drone');
 await click('auto');await until('window.harmonyGrid.state.played.length === 0');
 await key('n');await until('window.harmonyGrid.state.capture?.phase === "collect"');await pause(120);
 check((await capture()).selected.length===0,'Capture starts empty above Drone performance');
 check(await evaluate('!document.getElementById("capture-limit").checked'),'Audition limit is unchecked by default');
 check((await state()).sounding.map(n=>n.pitch).sort().join()==='60,64,67','Earlier Drone notes continue on entry');
 await shot('01-empty');
 // Capture geometry: base24 (configured playing register), x4/y3; bottom row columns9,10,12 = C4,E4,C5.
 await press(9,5);await until('window.harmonyGrid.state.capture.selected.join() === "60"');
 await press(10,5);await press(12,5);
 check((await capture()).selected.join()==='60,64,72','Real grid clicks collect exact pitches');
 const attacks=JSON.parse(await exportTrace()).events.filter(e=>e.kind==='commit').flatMap(e=>e.actions??[]);
 check(attacks.filter(a=>a.type==='on'&&a.pitch===60).length>=2,'Capturing a Drone pitch causes a new audio attack');
 await press(9,5);check((await capture()).reference===60&&(await capture()).selected.join()==='64,72','Removing anchor preserves fixed reference and other selections');
 await shot('02-chord');
 await key('m');await until('window.harmonyGrid.state.capture.kind === "mode"');await key('n',false);
 check((await capture()).phase==='collect','Releasing older N keeps the M capture open');
 await press(13,5);check((await capture()).selected.join()==='64,72,76','Mode collection retains octave-separated exact pitches');
 await shot('03-mode');
 await key('m',false);await until('window.harmonyGrid.state.capture.phase === "naming"');await until('document.querySelector("dialog").open');
 check((await capture()).audition.length===0&&(await state()).sounding.map(n=>n.pitch).sort().join()==='60,64,67','Naming releases audition and preserves Drone');
 await tap('1');check(await evaluate('document.querySelector("[data-slot=\\"0\\"]").disabled'),'Protected slot 1 cannot be selected');
 await tap('7');await tap('Tab');
 check(await evaluate('document.activeElement.id === "capture-name"'),'Slot digit then Tab focuses the name');
 await send('Input.insertText',{text:'Captured <mode>'});await shot('04-naming');
 await click('capture-edit');await until('window.harmonyGrid.state.capture.phase === "collect"');
 check((await capture()).audition.map(n=>n.pitch).join()==='64,72,76','Edit pitches resumes draft audition');
 await click('capture-finish');await until('document.querySelector("dialog").open');
 check(await evaluate('document.getElementById("capture-name").value === "Captured <mode>"'),'Name and slot survive Edit pitches');
 await click('capture-save');await until('!window.harmonyGrid.state.capture');await until('window.harmonyGrid.state.settings.mode.join() === "0,4"');
 check(await evaluate('document.querySelector("[data-mode=\\"6\\"]").textContent.includes("Captured <mode>")'),'Replace updates the requested mode slot with literal name text');
 await tap('Escape');await until('window.harmonyGrid.state.sounding.length === 0');
 // A second operation stores negative and octave-spaced chord intervals.
 await click('make-chord');await until('window.harmonyGrid.state.capture?.phase === "collect"');await pause(100);
 await press(12,5);await press(9,5);await press(13,5);await click('capture-finish');await until('document.querySelector("dialog").open');
 await tap('6');await tap('Tab');await send('Input.insertText',{text:'Open capture'});await click('capture-save');
 await until('!window.harmonyGrid.state.capture && window.harmonyGrid.state.settings.chord.join() === "-12,0,4"');
 check((await state()).settings.chord.join()==='-12,0,4','Chord creation keeps negative offsets and octave spacing');
 await shot('05-created');
 // Escape from a text field cancels capture, not the continuing performance.
 await click('make-chord');await until('window.harmonyGrid.state.capture?.phase === "collect"');await pause(100);await press(9,5);await click('capture-finish');await until('document.querySelector("dialog").open');await tap('Tab');await tap('Escape');
 await until('!window.harmonyGrid.state.capture');
 check((await state()).settings.chord.join()==='-12,0,4','Cancel from naming preserves the prior chord');
 await key('n');await until('!!window.harmonyGrid.state.capture');await key('n',false);await until('!window.harmonyGrid.state.capture');
 check(await evaluate('document.getElementById("capture-notice").textContent === "No pitches selected" && !document.getElementById("capture-notice").hidden'),'Empty capture shows the header notice');
 await shot('06-empty-finish');await pause(5200);
 check(await evaluate('document.getElementById("capture-notice").hidden'),'Empty notice disappears after five seconds');
 // Select enough exact pitches through real grid clicks to exceed the default Hold Number.
 await click('make-chord');await until('window.harmonyGrid.state.capture?.phase === "collect"');await pause(100);
 const unique=new Map();for(let row=0;row<6;row++)for(let col=0;col<14;col++){const pitch=24+4*col+3*(5-row);if(!unique.has(pitch))unique.set(pitch,[col,row]);}
 for(const [col,row]of [...unique.values()].slice(0,40))await press(col,row);
 check((await capture()).selected.length===40&&(await capture()).audition.length===40,'Forty real selections sustain with no default eviction');
 await click('capture-limit');await until('window.harmonyGrid.state.settings.captureLimit');
 check((await capture()).selected.length===40&&(await capture()).audition.length===32,'Enabling the optional limit stops only the oldest eight auditions');
 check(await evaluate('document.querySelector(".capture-notes").scrollHeight > document.querySelector(".capture-notes").clientHeight'),'Long pitch list scrolls');
 await evaluate('document.querySelector(".capture-notes").scrollTop=99999');
 check(await evaluate('(()=>{const r=document.querySelector(".capture-notes"),last=r.lastElementChild.getBoundingClientRect();return last.bottom <= r.getBoundingClientRect().bottom+1;})()'),'Final pitch row is reachable while actions remain fixed');
 await shot('07-limited-scroll');
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await pause(200);await shot('08-wide');
 check(await evaluate('document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth'),'Capture fits the larger viewport');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await pause(200);
 check(await evaluate('document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth'),'Capture fits 1280 by 800');
 await click('capture-cancel');await until('!window.harmonyGrid.state.capture');
 await click('file-menu');await evaluate('document.querySelector("[data-file-op=new]").click()');await click('file-confirm');await until('!!document.getElementById("file-discard")');await click('file-discard');await until('window.harmonyGrid.state.settings.chord.join() === "0,3,4,7"');
 check(!(await state()).settings.captureLimit,'Reset document restores default no eviction');
 // A fast key tap can begin and end capture inside one display frame.
 await tap('n');await pause(150);
 check(!(await capture())&&await evaluate('!document.body.classList.contains("capturing") && document.getElementById("capture-notice").textContent === "No pitches selected" && !document.getElementById("capture-notice").hidden'),'Quick N tap ends cleanly and still shows empty feedback');
 // Smooth Clavier must not remap raw capture selections.
 await click('smooth');await click('make-chord');await until('window.harmonyGrid.state.capture?.phase === "collect"');await pause(100);
 const db=await evaluate('(()=>{const r=document.getElementById("clavier").getBoundingClientRect();return {x:r.left+r.width/22,y:r.top+10};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...db});await send('Input.dispatchMouseEvent',{type:'mousePressed',...db,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...db,button:'left',buttons:0,clickCount:1});
 await until('window.harmonyGrid.state.capture.selected.length > 0');
 check((await capture()).selected.join()==='49','Capture clavier selects raw D flat even with Smooth Clavier enabled');
 await click('capture-cancel');await until('!window.harmonyGrid.state.capture');await click('smooth');
 await click('make-chord');await until('window.harmonyGrid.state.capture?.phase === "collect"');await pause(100);
 check(await evaluate('document.getElementById("auto").getAttribute("aria-pressed") === "false"'),'Capture Auto Button starts off independently of playing');
 await click('auto');
 await move(9,5,true);await until('window.harmonyGrid.state.capture.selected.includes(60)');
 await move(10,5,true);await until('window.harmonyGrid.state.capture.selected.includes(64)');
 check((await capture()).selected.join()==='60,64','Auto Button captures on cell entry without a held mouse button');
 const captureBegin=Date.now();let captureMoves=0;
 while(Date.now()-captureBegin<15000){await move(2+captureMoves%11,captureMoves%6,true);captureMoves++;await pause(12);}
 report.captureDragDurationMs=Date.now()-captureBegin;report.captureDragMoves=captureMoves;
 report.captureDragEnvironment=await evaluate('window.harmonyGrid.environment');
 check((await capture()).phase==='collect'&&report.captureDragEnvironment.audio.state==='running'&&!report.captureDragEnvironment.audio.fault,'Continuous capture dragging keeps collection, rendering, and audio alive');
 check((report.captureDragEnvironment.health.queueOverflows??0)===0&&(report.captureDragEnvironment.health.renderOverflows??0)===0,'Continuous capture dragging does not overflow either queue');
 await shot('09-after-capture-drag');
 await click('capture-cancel');await until('!window.harmonyGrid.state.capture');
 // Sustained real input exercises the same renderer/worklet used for performance.
 const begin=Date.now();let moves=0;while(Date.now()-begin<30000){await move(4+moves%7,1+moves%5);moves++;await pause(12);}
 report.dragDurationMs=Date.now()-begin;report.dragMoves=moves;report.environment=await evaluate('window.harmonyGrid.environment');
 check(report.environment.audio.state==='running'&&!report.environment.audio.fault,'Audio and dragging remain running after sustained input');
 check((report.environment.health.peak??0)>0,'Real AudioWorklet produces nonzero samples');
 check(report.environment.health.nonFiniteSamples===0,'Audio samples remain finite');
 check((report.environment.health.queueOverflows??0)===0&&(report.environment.health.renderOverflows??0)===0,'No input or renderer queue overflows');
 check(report.errors.length===0,'No uncaught browser errors');
 await writeFile(join(root,'browser-trace.json'),await exportTrace());await click('panic');await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:100});
}
