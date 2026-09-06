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
 await click('file-menu');await until('document.getElementById("file-dialog").open');
 check(await evaluate('document.querySelector("[data-file-op=\\"revert\\"]").disabled'),'First instrument has no saved version to revert to');
 await name('My instrument');await shot('01-first-save');
 await evaluate('fileTest.controls.abortSave=true');await click('file-confirm');await pause(200);
 check(await modal()&&await evaluate('document.querySelector(".document-title").textContent.includes("Untitled")'),'Canceling first save keeps instrument name and state');
 await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 const original=JSON.parse(await fileText('saved.hgrid.json'));await writeFile(join(root,'saved-instrument.hgrid.json'),JSON.stringify(original,null,2)+'\n');
 check(original.name==='My instrument'&&original.chords.length===10&&original.modes.length===10,'First save writes a complete versioned instrument file');
 check(await evaluate('document.querySelector(".document-title").textContent === "My instrument"'),'Successful save establishes a clean named document');
 // Capture a real chord, then Save to the existing handle.
 await click('make-chord');await until('window.harmonyGrid.state?.capture?.phase === "collect"');await pause(120);
 const piano=await evaluate('(()=>{const r=document.getElementById("clavier").getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};})()');
 for(const index of [7,9,14]){
  const point={x:piano.left+(index+.5)*piano.width/22,y:piano.top+piano.height*.85};
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});await pause(70);
 }
 await click('capture-finish');await until('document.querySelector(".capture-naming").open');await click('capture-save');await until('!window.harmonyGrid.state.capture');
 await click('smooth');await click('auto');await evaluate('document.getElementById("sound").value="pluck";document.getElementById("sound").dispatchEvent(new Event("change",{bubbles:true}));');
 const saveCount=await evaluate('fileTest.controls.saveCount');
 await click('file-menu');await choose('save');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 const captured=JSON.parse(await fileText('saved.hgrid.json'));
 check(captured.chords[5].notes.join()==='0,4,12'&&captured.settings.chord.join()==='0,4,12','Save includes actual captured slot and its active selection');
 check(captured.sound==='pluck'&&captured.surface.smoothClavier&&captured.surface.autoButton===false,'Save includes sound and playing surface preferences');
 check(await evaluate('fileTest.controls.saveCount')===saveCount,'Save reuses the existing file destination');
 // Fresh page and opening the saved file prove persistence beyond session memory.
 await send('Page.navigate',{url:'http://127.0.0.1:5174/'});await until('!!window.harmonyGrid');await click('file-menu');await choose('open');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 await until('window.harmonyGrid.state?.settings.chord.join() === "0,4,12"');
 check(await evaluate('document.querySelector("[data-chord=\\"5\\"]").textContent.includes("New chord") && document.getElementById("sound").value === "pluck" && document.getElementById("auto").getAttribute("aria-pressed") === "false"'),'Reload and Open restore captured patterns and surface preferences');
 await click('start');await until('document.getElementById("start").textContent==="Stop Sound" && window.harmonyGrid.environment.audio?.state === "running"');
 // Set up retained sound, change a persisted setting, and open another file.
 await evaluate('document.getElementById("sound").value="organ";document.getElementById("sound").dispatchEvent(new Event("change",{bubbles:true}));');
 await click('auto');await evaluate('document.querySelector("[data-chord=\\"1\\"]").click()');
 const g=await evaluate('(()=>{const r=document.getElementById("grid").getBoundingClientRect(),c=Math.min(r.width/18,r.height/7);return {x:r.left+(r.width-18*c)/2+6.5*c,y:r.top+(r.height-7*c)/2+2.5*c};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...g});await until('window.harmonyGrid.state.sounding.length > 0');await tap('y');await until('window.harmonyGrid.state.controls.drone');
 const incoming=structuredClone(original);incoming.name='Incoming';incoming.settings.root=2;incoming.settings.tempo=300;incoming.surface.autoButton=false;
 await evaluate(`fileTest.write('incoming.hgrid.json',${JSON.stringify(JSON.stringify(incoming))}).then(()=>{fileTest.controls.openName='incoming.hgrid.json'})`);
 await click('file-menu');await choose('open');await click('file-confirm');await until('!!document.getElementById("file-discard")');
 check((await state()).controls.drone&&(await state()).sounding.length>0,'Open confirmation keeps old Drone notes sounding');
 check(await evaluate('getComputedStyle(document.querySelector(".file-changes")).paddingLeft === "36px"'),'Unsaved changes list preserves the approved padding');
 await shot('02-unsaved-open');await click('file-cancel');
 check((await state()).controls.drone&&await evaluate('document.querySelector(".document-title").textContent.includes("My instrument")'),'Cancel preserves the current instrument and live controls');
 await click('file-menu');await choose('open');await click('file-confirm');await until('!!document.getElementById("file-discard")');
 await evaluate('fileTest.controls.failClose=true');await click('file-confirm');await until('!!document.querySelector(".file-error")');
 check((await state()).controls.drone&&await modal(),'Failed Save & open keeps the current instrument and notes');
 check(JSON.parse(await fileText('saved.hgrid.json')).sound==='pluck','Failed close leaves the previously saved bytes intact');await shot('03-save-error');
 await click('file-confirm');await until('!document.getElementById("file-dialog").open');await until('window.harmonyGrid.state.settings.root === 2');
 check((await state()).sounding.length===0&&Object.values((await state()).controls).every(v=>!v),'Successful Save & open releases old notes and clears every live control');
 check(JSON.parse(await fileText('saved.hgrid.json')).sound==='organ','Save & open writes the outgoing changes before replacing it');
 // Revert returns to the saved snapshot and resets performance at once.
 await click('auto');await send('Input.dispatchMouseEvent',{type:'mouseMoved',...g});await until('window.harmonyGrid.state.sounding.length > 0');await tap('y');await until('window.harmonyGrid.state.controls.drone');
 await click('file-menu');await choose('revert');await shot('04-revert');await click('file-cancel');check((await state()).controls.drone,'Canceling Revert leaves the performance intact');
 await click('file-menu');await choose('revert');await click('file-confirm');await until('!document.getElementById("file-dialog").open');await until('window.harmonyGrid.state.sounding.length === 0');
 check(!(await state()).controls.drone&&await evaluate('document.getElementById("auto").getAttribute("aria-pressed") === "false"'),'Revert restores saved settings and clears notes and Drone');
 // Invalid file and chooser cancel are non-mutating.
 await evaluate('fileTest.write("invalid.json", "{bad").then(()=>{fileTest.controls.openName="invalid.json";})');await click('file-menu');await choose('open');await click('file-confirm');await until('!!document.querySelector(".file-error")');
 check(await evaluate('document.querySelector(".document-title").textContent === "Incoming"'),'Invalid input preserves the current document');await shot('05-invalid');
 await evaluate('fileTest.controls.abortOpen=true');await click('file-confirm');await pause(200);check(await modal(),'Canceled Open leaves the file panel available');await click('file-cancel');
 // Save As produces a separate file; external edits must not be overwritten.
 await click('file-menu');await name('A separate instrument');await evaluate('fileTest.controls.saveName="separate.hgrid.json"');await click('file-confirm');await until('!document.getElementById("file-dialog").open');
 check(JSON.parse(await fileText('incoming.hgrid.json')).name==='Incoming'&&JSON.parse(await fileText('separate.hgrid.json')).name==='A separate instrument','Save As preserves the original file and names a separate file');
 await evaluate('fileTest.write("separate.hgrid.json", "External edit")');await click('file-menu');await choose('save');await click('file-confirm');await until('!!document.querySelector(".file-error")');
 check(await fileText('separate.hgrid.json')==='External edit','Save refuses to overwrite a file changed outside the instrument');await click('file-cancel');
 // Download fallback is explicit and never silently authorizes replacement.
 await evaluate('window.showSaveFilePicker=undefined');await click('auto');await click('file-menu');await shot('06-download-fallback');
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:join(root,'downloads')});await click('file-confirm');await until('document.querySelector(".file-error")?.textContent.includes("Download requested")');
 check(await modal()&&await evaluate('document.querySelector(".document-title").textContent.includes("Unsaved")'),'Download fallback keeps changes unsaved and the current instrument open');await click('file-cancel');
 // The fallback Open uses a real file input and an actual file under docs/.
 await evaluate('window.showOpenFilePicker=undefined');await send('Page.setInterceptFileChooserDialog',{enabled:true});
 await click('file-menu');await choose('open');await click('file-confirm');await until('!!document.querySelector("input[type=file]")');
 const dom=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'input[type=file]'});
 await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[join(root,'saved-instrument.hgrid.json')]});
 await until('!!document.getElementById("file-discard")');await click('file-discard');await until('!document.getElementById("file-dialog").open');
 check(await evaluate('document.querySelector(".document-title").textContent === "My instrument"'),'Fallback file input reads and opens a real instrument file');
 await click('auto');await click('file-menu');await choose('new');await click('file-confirm');await until('!!document.getElementById("file-discard")');
 check(await evaluate('document.getElementById("file-title").textContent.includes("Save changes")'),'New instrument checks unsaved changes');await click('file-cancel');
 check(await evaluate('document.querySelector(".document-title").textContent.includes("My instrument")'),'Canceling New keeps the current instrument');
 await click('file-menu');await choose('new');await click('file-confirm');await until('!!document.getElementById("file-discard")');await click('file-discard');await until('!document.getElementById("file-dialog").open');
 check(await evaluate('document.querySelector(".document-title").textContent.includes("Untitled instrument") && document.getElementById("auto").getAttribute("aria-pressed") === "true"'),'Confirmed New restores original fixtures and playing defaults');
 await click('file-menu');
 for(const [width,height]of [[1280,800],[1600,1000]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(150);
  check(await evaluate('(()=>{const r=document.getElementById("file-dialog").getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()'),`File panel fits ${width} by ${height}`);
  await shot('07-file-panel-'+width);
 }
 await click('file-cancel');
 check(report.errors.length===0,'No uncaught browser errors');report.environment=await evaluate('window.harmonyGrid.environment');
 await writeFile(join(root,'browser-trace.json'),await exportTrace());await click('panic');await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:100});
}
