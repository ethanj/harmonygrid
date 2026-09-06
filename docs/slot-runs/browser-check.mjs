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
 const until=async(expression)=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await pause(50);}throw Error('Timed out: '+expression);};
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
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:process.argv[2]??'http://127.0.0.1:5174/'});await until('!!window.harmonyGrid');
 const shot=async name=>writeFile(join(root,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 const modal=()=>evaluate('document.getElementById("file-dialog").open');
 const choose=async op=>{await evaluate(`document.querySelector('[data-file-op="${op}"]').click()`);};
 const name=async value=>{await evaluate('document.getElementById("instrument-name").select()');await send('Input.insertText',{text:value});};
 const fileText=filename=>evaluate(`fileTest.read(${JSON.stringify(filename)})`);

 const edit=async(id,text)=>{await evaluate(`document.getElementById(${JSON.stringify(id)}).focus();document.getElementById(${JSON.stringify(id)}).select()`);await send('Input.insertText',{text});};
 const row=async(kind,index)=>evaluate(`document.querySelector('[data-${kind}="${index}"]').click()`);
 const patternName=(kind,index)=>evaluate(`document.querySelector('[data-${kind}="${index}"]').textContent`);
 const shortcut=async(key,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:'Key'+key.toUpperCase(),modifiers,windowsVirtualKeyCode:key.toUpperCase().charCodeAt(0)});};
 await click('start');await until('document.getElementById("start").textContent==="Stop Sound" && window.harmonyGrid.environment.audio?.state === "running"');
 await tap('v');check(await evaluate('document.getElementById("status").textContent.includes("Copy a pattern first")'),'Paste before copy is rejected');
 await click('edit-slots');await until('document.getElementById("slot-editor").open');
 check(await evaluate('document.getElementById("slot-apply").getBoundingClientRect().bottom <= innerHeight'),'Editor actions fit at 1280 × 800');
 await click('slot-row-5');await edit('slot-name','Open <voicing>');await edit('slot-intervals','-12, 4, 12');
 await click('slot-modes');await click('slot-row-6');await edit('slot-name','Colors');await edit('slot-intervals','1,4,9');
 await click('slot-chords');await click('slot-row-5');
 check(await evaluate('document.getElementById("slot-name").value === "Open <voicing>"'),'Draft survives slot and tab navigation');
 check(!(await patternName('chord',5)).includes('Open <voicing>'),'Draft does not mutate playing slots');
 await shot('01-staged-editor');await click('slot-cancel');
 await click('edit-slots');await click('slot-row-5');check(await evaluate('document.getElementById("slot-name").value !== "Open <voicing>"'),'Cancel discards all drafts');
 await edit('slot-name','Open <voicing>');await edit('slot-intervals','-12,4,12');await click('slot-copy');
 await click('slot-modes');check(await evaluate('document.getElementById("slot-paste").disabled'),'Chord clipboard cannot paste into a mode');
 await click('slot-chords');await click('slot-row-0');
 check(await evaluate('document.getElementById("slot-name").disabled && document.getElementById("slot-intervals").disabled && document.getElementById("slot-paste").disabled && !document.getElementById("slot-copy").disabled'),'Protected slot cannot rename, edit, or paste but can copy out');
 await click('slot-row-6');await click('slot-paste');await edit('slot-intervals','0,4,4');
 check(await evaluate('document.getElementById("slot-apply").disabled && document.getElementById("slot-error").textContent.includes("Repeated")'),'Invalid draft blocks the full transaction');await shot('02-invalid');
 await click('slot-row-5');check(await evaluate('document.getElementById("slot-apply").disabled'),'Navigating away does not hide an invalid draft');
 await click('slot-row-6');await edit('slot-intervals','-12,4,12');
 const before=(await state()).settings.chord;
 await click('slot-apply');await until('!document.getElementById("slot-editor").open');
 check((await patternName('chord',5)).includes('Open <voicing>')&&(await patternName('chord',6)).includes('Open <voicing>'),'Apply commits both slots with literal names');
 check(JSON.stringify((await state()).settings.chord)===JSON.stringify(before),'Editing inactive slots leaves playing pattern unchanged');
 await row('chord',5);await until('window.harmonyGrid.state.settings.chord.join() === "-12,4,12"');
 await row('chord',6);await pause(100);
 check(await evaluate('document.querySelectorAll("[data-chord].active").length===1 && document.querySelector("[data-chord].active").dataset.chord === "6"'),'Identical patterns retain a single explicit selected slot');
 await click('edit-slots');check(await evaluate('document.getElementById("slot-row-6").getAttribute("aria-pressed") === "true"'),'Editor opens at the explicit selected duplicate');
 await edit('slot-name','Renamed only');
 const traceBefore=JSON.parse(await exportTrace()).events;
 await click('slot-apply');await pause(100);
 // Count settings inputs, since any unchanged-pattern setting would needlessly reattack.
 const settingsCount=trace=>{const rows=Array.isArray(trace)?trace:(trace.rows??trace.events??trace.entries??[]);return rows.filter(r=>r.kind==='input'&&r.input?.type==='settings').length;};
 const traceAfter=JSON.parse(await exportTrace());
 check(settingsCount(traceBefore)===settingsCount(traceAfter),'Rename-only Apply sends no settings event or reattack');
 check((await patternName('chord',6)).includes('Renamed only'),'Renaming changes the selected slot label');
 await click('edit-slots');await edit('slot-intervals','-7, 5, 17');await click('slot-apply');await until('window.harmonyGrid.state.settings.chord.join() === "-7,5,17"');
 check((await state()).settings.chord.join()==='-7,5,17','Editing selected intervals reaches the audio engine');
 await tap('c');await row('chord',7);await tap('v');await until('window.harmonyGrid.state.settings.chord.join() === "-7,5,17"');
 check((await patternName('chord',7)).includes('Renamed only'),'Plain C/V copies the selected chord');
 await row('chord',0);await tap('v');check(await evaluate('document.getElementById("status").textContent.includes("protected")'),'Playing shortcut cannot replace protected slot');
 await row('mode',1);await shortcut('C',8);await row('mode',5);await shortcut('V',8);await pause(100);
 check((await patternName('mode',5)).includes('Major'),'Shift+C/V copies the selected mode');
 // Caps Lock is tested with explicit DOM keyboard events because CDP does not expose its lock-state bit.
 await evaluate(`window.dispatchEvent(Object.assign(new KeyboardEvent('keydown',{key:'c',bubbles:true}),{getModifierState:key=>key==='CapsLock'}))`);
 await row('mode',6);
 await evaluate(`window.dispatchEvent(Object.assign(new KeyboardEvent('keydown',{key:'v',bubbles:true}),{getModifierState:key=>key==='CapsLock'}))`);
 check((await patternName('mode',6)).includes('Major'),'Caps Lock alone targets modes');
 await row('chord',6);
 await evaluate(`window.dispatchEvent(Object.assign(new KeyboardEvent('keydown',{key:'c',shiftKey:true,bubbles:true}),{getModifierState:key=>key==='CapsLock'}))`);
 await row('chord',8);
 await evaluate(`window.dispatchEvent(Object.assign(new KeyboardEvent('keydown',{key:'v',shiftKey:true,bubbles:true}),{getModifierState:key=>key==='CapsLock'}))`);
 check((await patternName('chord',8)).includes('Renamed only'),'Shift plus Caps Lock targets chords');
 await shortcut('c',4);await row('chord',9);await shortcut('v',4);await pause(100);
 check((await patternName('chord',9)).includes('Renamed only'),'Command C/V supports pattern copy and paste');
 await click('edit-slots');await click('slot-row-5');await edit('slot-name','Native text');await shortcut('c',4);await click('slot-row-4');await click('slot-paste');
 check(await evaluate('document.getElementById("slot-name").value === "Renamed only"'),'Text-field Command+C leaves the pattern clipboard unchanged');
 await tap('Escape');await until('!document.getElementById("slot-editor").open');
 await until('!document.getElementById("file-menu").disabled');
 check(await evaluate('!document.getElementById("file-menu").disabled'),'Escape closes editor and restores File availability');
 await click('file-menu');await name('Slot instrument');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 const saved=JSON.parse(await fileText('saved.hgrid.json'));check(saved.selection.chord===9&&saved.chords[9].name==='Renamed only','Save preserves edited patterns and duplicate slot identity');
 await send('Page.navigate',{url:process.argv[2]??'http://127.0.0.1:5174/'});await until('!!window.harmonyGrid');await click('file-menu');await choose('open');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 await until('window.harmonyGrid.state?.settings.chord.join() === "-7,5,17"');
 check(await evaluate('document.querySelectorAll("[data-chord].active").length===1 && document.querySelector("[data-chord].active").dataset.chord === "9"'),'Reload and Open restore the exact duplicate slot');
 await click('edit-slots');await edit('slot-intervals','0,12');await click('slot-apply');
 await click('file-menu');await choose('revert');await click('file-confirm');await until('!document.getElementById("file-dialog").open');await until('window.harmonyGrid.state.settings.chord.join() === "-7,5,17"');
 check(await evaluate('document.querySelector("[data-chord].active").dataset.chord === "9"'),'Revert restores edited intervals and slot identity');
 await click('edit-slots');await send('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false});await pause(100);await shot('03-compact');
 check(await evaluate('document.getElementById("slot-editor").getBoundingClientRect().right <= innerWidth && document.querySelector("#slot-editor .slot-layout").scrollHeight > document.querySelector("#slot-editor .slot-layout").clientHeight && document.getElementById("slot-apply").getBoundingClientRect().bottom < innerHeight'),'Compact editor scrolls its content while keeping Apply visible');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await tap('Escape');await click('make-chord');await until('window.harmonyGrid.state?.capture?.phase === "collect"');
 check(await evaluate('document.getElementById("edit-slots").disabled && document.getElementById("auto").getAttribute("aria-pressed")==="false"'),'Capture blocks editing and retains Auto Button off by default');
 await tap('Escape');await pause(100);check(report.errors.length===0,'No browser runtime exceptions');
 await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:100,maxRetries:20,retryDelay:100});
}
