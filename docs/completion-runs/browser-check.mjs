// Real Chromium browser smoke check. No package installation or user profile access.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),process.argv.includes('--fallback')?'fallback':'.');await mkdir(root,{recursive:true});
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
  await evaluate(`document.getElementById(${JSON.stringify(id)}).scrollIntoView({block:'nearest'})`);
  const p=await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});
 };
 const key=async(k,down=true)=>send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:k,code:k===' '?'Space':k==='Escape'?'Escape':k==='Tab'?'Tab':/^\d$/.test(k)?`Digit${k}`:`Key${k.toUpperCase()}`,windowsVirtualKeyCode:k===' '?32:k==='Escape'?27:k.toUpperCase().charCodeAt(0)});
 const tap=async k=>{await key(k);await key(k,false);};
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 // Real browser file streams in an isolated origin-private filesystem. Only the
 // picker boundary and explicitly injected failures are simulated; no app hooks.
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
 const controls={saveName:'saved.hgrid.json',openName:'saved.hgrid.json',abortSave:false,abortOpen:false,failClose:false,saveCount:0,openCount:0};
 const root=()=>navigator.storage.getDirectory();
 const get=async name=>(await root()).getFileHandle(name,{create:true});
 const wrap=(handle)=>({name:handle.name,getFile:()=>handle.getFile(),isSameEntry:async other=>handle.name===other.name,createWritable:async()=>{
  const stream=await handle.createWritable();return {write:data=>stream.write(data),close:async()=>{if(controls.failClose){controls.failClose=false;throw Error('Simulated disk commit failure');}await stream.close();},abort:()=>stream.abort()};
 }});
 window.showSaveFilePicker=async()=>{controls.saveCount++;if(controls.abortSave){controls.abortSave=false;throw new DOMException('Canceled','AbortError');}return wrap(await get(controls.saveName));};
 window.showOpenFilePicker=async()=>{controls.openCount++;if(controls.abortOpen){controls.abortOpen=false;throw new DOMException('Canceled','AbortError');}return [wrap(await get(controls.openName))];};
 window.fileTest={controls,read:async name=>(await (await get(name)).getFile()).text(),write:async(name,text)=>{const stream=await (await get(name)).createWritable();await stream.write(text);await stream.close();}};
 })();`});
 if(process.argv.includes('--fallback'))await send('Page.addScriptToEvaluateOnNewDocument',{source:'delete HTMLCanvasElement.prototype.transferControlToOffscreen;'});
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:process.argv[2]??'http://127.0.0.1:5174/'});await until('!!window.harmonyGrid');
 const shot=async name=>writeFile(join(root,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 const modal=()=>evaluate('document.getElementById("file-dialog").open');
 const choose=async op=>{await evaluate(`document.querySelector('[data-file-op="${op}"]').click()`);};
 const name=async value=>{await evaluate('document.getElementById("instrument-name").select()');await send('Input.insertText',{text:value});};
 const fileText=filename=>evaluate(`fileTest.read(${JSON.stringify(filename)})`);


 const field=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const checkbox=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.checked=${value};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await click('start');await until('window.harmonyGrid.environment.audio?.state === "running" && document.getElementById("start").textContent==="Stop Sound"');
 await until('window.harmonyGrid.environment.health.palette === "ready"');check(true,'Sampled bank initializes in the real AudioWorklet');
 await shot('01-playing');
 await click('performance-settings-button');await until('document.getElementById("performance-settings").open');
 check(await evaluate('!document.getElementById("perf-preserve").checked && !document.getElementById("perf-capture-limit").checked'),'New instruments default to shared Thru channel and no capture eviction');
 check(await evaluate('document.getElementById("perf-apply").getBoundingClientRect().bottom < innerHeight'),'Performance settings actions fit 1280 × 800');
 await shot('02-performance');await field('perf-velocity',70);await click('perf-cancel');
 await click('performance-settings-button');check(await evaluate('document.getElementById("perf-velocity").value === "96"'),'Cancel restores performance draft');
 await field('perf-velocity',200);check(await evaluate('document.getElementById("perf-apply").disabled'),'Invalid velocity blocks Apply');
 await field('perf-velocity',70);await field('perf-mouse',3);await field('perf-midi',5);await checkbox('perf-multiMidi',true);await field('perf-repeatDrone','all');await checkbox('perf-sustainLimit',false);await click('perf-apply');
 await until('window.harmonyGrid.state.settings.velocity === 70');check(await evaluate('window.harmonyGrid.state.settings.mouseChannel===2 && window.harmonyGrid.state.settings.variations.repeatDrone==="all" && !window.harmonyGrid.state.settings.variations.sustainLimit'),'Apply reaches committed settings');
 await click('edit-slots');await until('document.getElementById("slot-editor").open');await shot('03-recollect');await click('slot-recollect');
 await until('window.harmonyGrid.state.capture?.selected.length > 0');check(await evaluate('window.harmonyGrid.state.capture.reference===60 && !document.getElementById("auto").getAttribute("aria-pressed").includes("true")'),'Saved slot reopens selected pitches with fixed reference and Auto off');await shot('04-seeded-capture');await click('capture-cancel');await until('!window.harmonyGrid.state.capture');
 await click('help');await until('document.getElementById("help-dialog").open');await shot('05-help');await evaluate(`document.querySelector('[data-help="examples"]').click()`);await shot('06-examples');await evaluate(`document.querySelector('[data-study="0"]').click()`);
 await until('document.getElementById("file-dialog").open');check(await evaluate('document.getElementById("file-discard").textContent.includes("open")'),'Examples honor unsaved changes');await click('file-discard');await until('!document.getElementById("file-dialog").open');await until('document.getElementById("sound").value==="piano"');
 await until('window.harmonyGrid.state.settings.chord.join() === "0,7,16"');check(true,'Example opens its actual chord and sound');
 for(const sound of ['piano','electric','vibes','tonewheel','organ','pluck']){
  await evaluate(`(()=>{const e=document.getElementById('sound');e.value='${sound}';e.dispatchEvent(new Event('change'));})()`);
  const r=await evaluate('(()=>{const r=document.getElementById("grid").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...r});await send('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',buttons:1,clickCount:1});await pause(600);
  check(await evaluate('window.harmonyGrid.environment.health.peak > 0 && window.harmonyGrid.environment.health.nonFiniteSamples===0 && !window.harmonyGrid.environment.audio.fault'),sound+' produces finite audio');
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...r,button:'left',buttons:0,clickCount:1});await click('panic');
 }
 await click('file-menu');await name('Completion review');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 const saved=JSON.parse(await fileText('saved.hgrid.json'));check(saved.outputs.internal && saved.settings.variations && saved.sound==='pluck','New settings and sound persist through the real file flow');
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await click('performance-settings-button');await shot('07-performance-large');await tap('Escape');
 check(report.errors.length===0,'No browser runtime exceptions');report.environment=await evaluate('window.harmonyGrid.environment');await writeFile(join(root,'trace.json'),await exportTrace());
 await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:100,maxRetries:20,retryDelay:100});
}
