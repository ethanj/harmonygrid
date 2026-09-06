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
 const movePoint=async(p,press=false)=>{await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});if(press){await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});}};
 const point=async(col,row,capture=false)=>evaluate(`(()=>{const r=document.getElementById('grid').getBoundingClientRect(),cols=${capture?14:18},rows=${capture?6:7},c=Math.min(r.width/cols,r.height/rows);return {x:r.left+(r.width-cols*c)/2+(${col}+.5)*c,y:r.top+(r.height-rows*c)/2+(${row}+.5)*c};})()`);
 const open=async()=>{await click('axes');await until('document.getElementById("grid-settings").open');};
 await open();check(await evaluate('document.getElementById("range-gridLow").value==="24" && document.getElementById("range-clavierLow").value==="48"'),'Defaults preserve the existing registers');
 check(await evaluate('document.getElementById("range-apply").getBoundingClientRect().bottom < innerHeight'),'Apply stays visible at 1280 × 800');await shot('01-default');
 await field('range-horizontal',5);await field('range-vertical',7);await field('range-gridLow',48);await field('range-clavierLow',60);
 check(await evaluate('document.getElementById("axes").textContent.includes("→ 4 ↑ 3")'),'Draft leaves playing geometry unchanged');await shot('02-draft');
 await click('range-cancel');await open();check(await evaluate('document.getElementById("range-horizontal").value==="4"'),'Cancel discards the draft');
 await field('range-horizontal',13);check(await evaluate('document.getElementById("range-apply").disabled && document.getElementById("range-error").textContent.includes("1 to 12")'),'Invalid interval blocks Apply');await shot('03-invalid');
 await field('range-horizontal',5);await field('range-vertical',7);await field('range-gridLow',48);await field('range-clavierLow',60);await field('range-maximum',84);await shot('04-ceiling');
 await click('range-apply');await until('!document.getElementById("grid-settings").open');
 check(await evaluate('document.getElementById("axes").textContent.includes("→ 5 ↑ 7") && document.getElementById("clavier-range").textContent.includes("C4")'),'Apply updates axes and clavier labels');
 await click('start');await until('document.getElementById("start").textContent==="Stop Sound" && window.harmonyGrid.environment.audio?.state==="running"');
 await evaluate('document.querySelector(`[data-chord="0"]`).click();document.querySelector(`[data-mode="0"]`).click()');
 await movePoint(await point(2,6));await until('window.harmonyGrid.state.played.join()==="58"');check((await state()).lead===58,'5 × 7 hit testing uses the configured grid register');
 await tap('y');await until('window.harmonyGrid.state.controls.drone');
 await open();await field('range-horizontal',1);await field('range-vertical',12);await field('range-maximum',72);await click('range-apply');await until('!document.getElementById("grid-settings").open');await pause(250);
 check((await state()).sounding.some(n=>n.pitch===58),'Applying layout preserves Drone-held notes');
 check(!(await state()).played.some(n=>n!==58),'Apply does not synthesize a newly mapped pitch at a stationary pointer');
 await movePoint(await point(2,6));await until('window.harmonyGrid.state.played.join()==="50"');
 check((await state()).sounding.some(n=>n.pitch===58)&&(await state()).sounding.some(n=>n.pitch===50),'Next gesture uses new mapping alongside retained notes');
 await movePoint(await point(0,0));await pause(150);check(!(await state()).played.includes(108),'Unavailable cells do not generate their displayed pitches');
 await tap('Escape');await click('make-chord');await until('window.harmonyGrid.state.capture?.phase==="collect"');await pause(120);
 check(await evaluate('document.getElementById("axes").disabled && document.getElementById("auto").getAttribute("aria-pressed")==="false"'),'Capture protects settings and starts Auto Button off');
 await movePoint(await point(2,5,true),true);await until('window.harmonyGrid.state.capture.selected.join()==="50"');
 check((await state()).capture.reference===50,'Capture uses the configured axes and register');
 await movePoint(await point(0,0,true),true);await pause(100);check((await state()).capture.selected.join()==='50','Capture rejects pointer pitches above the ceiling');
 await click('capture-cancel');await until('!window.harmonyGrid.state.capture');
 await click('smooth');
 const piano=await evaluate('(()=>{const r=document.getElementById("clavier").getBoundingClientRect();return{x:r.left+1,y:r.top+r.height*.8};})()');await movePoint(piano,true);await pause(100);
 const trace=JSON.parse(await exportTrace()).events;check(trace.some(r=>r.kind==='input'&&r.input?.type==='pointer'&&r.input.pitch===60),'Smooth Clavier uses the configured lowest C');await click('smooth');
 await click('file-menu');await name('Grid study');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 const saved=JSON.parse(await fileText('saved.hgrid.json'));check(saved.surface.axes.join()==='1,12'&&saved.surface.gridLow===48&&saved.surface.clavierLow===60&&saved.settings.maxPitch===72,'Save persists the complete grid and range configuration');
 await send('Page.navigate',{url:process.argv[2]??'http://127.0.0.1:5174/'});await until('!!window.harmonyGrid');await click('file-menu');await choose('open');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 await open();check(await evaluate('document.getElementById("range-horizontal").value==="1" && document.getElementById("range-vertical").value==="12" && document.getElementById("range-maximum").value==="72"'),'Reload and Open restore saved values');
 await field('range-horizontal',5);await click('range-apply');await click('file-menu');await choose('revert');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 check(await evaluate('document.getElementById("axes").textContent.includes("→ 1 ↑ 12")'),'Revert restores the saved geometry');
 await open();await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await pause(150);await shot('05-wide');
 check(await evaluate('document.getElementById("range-apply").getBoundingClientRect().bottom < innerHeight'),'Settings fit 1600 × 1000');
 await tap('y');check(!(await state()).controls.drone,'Resized modal blocks performance keys even after focus moves');
 await tap('Escape');await until('!document.getElementById("grid-settings").open');await until('!document.getElementById("file-menu").disabled');
 check(report.errors.length===0,'No browser runtime exceptions');
 await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:100,maxRetries:20,retryDelay:100});
}
