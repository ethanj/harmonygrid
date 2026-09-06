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
 check(await evaluate('document.querySelector("#axis-scale #root").textContent==="C" && document.querySelector("#target-chord").classList.contains("active")'),'Status combines scale and chord target beside the grid');
 check(await evaluate('document.querySelector(".tempo-bottom").getBoundingClientRect().bottom <= document.getElementById("review-bar").getBoundingClientRect().top'),'Complete sidebar fits 1280 × 800');
 await click('axis-right');check(await evaluate('document.getElementById("axis-horizontal").textContent==="5" && !document.getElementById("axis-actions").hidden && document.getElementById("axes").textContent.includes("→ 4")'),'Arrow stages a change and reveals Set/Cancel without changing the grid');
 await click('axis-up');await tap('2');check(await evaluate('document.getElementById("axis-vertical").textContent==="4" && document.getElementById("make-chord").disabled'),'Draft isolates other editing commands');await shot('pending');
 await click('axis-cancel');check(await evaluate('document.getElementById("axis-horizontal").textContent==="4" && document.getElementById("axis-vertical").textContent==="3"'),'Cancel restores both intervals');
 await click('axis-right');await click('axis-up');await click('axis-set');check(await evaluate('document.getElementById("axes").textContent.includes("→ 5 ↑ 4") && document.getElementById("axis-actions").hidden'),'Set commits both intervals and restores status');
 await click('axis-left');await tap('Escape');check(await evaluate('document.getElementById("axis-horizontal").textContent==="5"'),'Escape cancels the inline draft');
 for(let i=0;i<12;i++)await evaluate('document.getElementById("axis-right").click()');check(await evaluate('document.getElementById("axis-horizontal").textContent==="12" && document.getElementById("axis-right").disabled'),'Horizontal maximum is 12');await click('axis-cancel');
 for(let i=0;i<12;i++)await evaluate('document.getElementById("axis-down").click()');check(await evaluate('document.getElementById("axis-vertical").textContent==="1" && document.getElementById("axis-down").disabled'),'Vertical minimum is 1');await click('axis-cancel');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Shift',code:'ShiftLeft',modifiers:8,windowsVirtualKeyCode:16});check(await evaluate('document.getElementById("target-mode").classList.contains("active")'),'Shift highlights Mode');await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',modifiers:0,windowsVirtualKeyCode:16});check(await evaluate('document.getElementById("target-chord").classList.contains("active")'),'Releasing Shift restores Chord');
 await evaluate('window.dispatchEvent(Object.assign(new KeyboardEvent("keydown",{key:"CapsLock",bubbles:true}),{getModifierState:k=>k==="CapsLock"}))');check(await evaluate('document.getElementById("target-mode").classList.contains("active")'),'Caps Lock highlights Mode');
 await evaluate('window.dispatchEvent(Object.assign(new KeyboardEvent("keydown",{key:"Shift",shiftKey:true,bubbles:true}),{getModifierState:k=>k==="CapsLock"}))');check(await evaluate('document.getElementById("target-chord").classList.contains("active")'),'Shift plus Caps Lock highlights Chord');
 await shot('status-1280');await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await pause(100);await shot('status-1600');check(await evaluate('document.querySelector(".tempo-bottom").getBoundingClientRect().bottom <= document.getElementById("review-bar").getBoundingClientRect().top'),'Complete sidebar fits 1600 × 1000');
 await click('axes');await until('document.getElementById("grid-settings").open');await click('range-cancel');await click('axis-right');check(await evaluate('!document.getElementById("axis-actions").hidden'),'Inline arrows remain usable after closing Grid & register');await click('axis-cancel');
 check(report.errors.length===0,'No browser runtime exceptions');
 await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:100,maxRetries:20,retryDelay:100});
}
