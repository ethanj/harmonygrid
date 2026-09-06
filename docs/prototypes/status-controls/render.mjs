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
 await evaluate("(()=>{const root=document.querySelector('.sidebar>section'),holder=document.createElement('div');holder.innerHTML=\"<section id=\\\"grid-status\\\" aria-label=\\\"Scale status and grid axes\\\"><div class=\\\"eyebrow\\\">Status & grid axes</div><div class=\\\"axis-controls\\\"><div id=\\\"axis-info\\\"><div id=\\\"axis-scale\\\"></div><div class=\\\"axis-target\\\" aria-label=\\\"Digit key target\\\"><span id=\\\"target-mode\\\">Mode</span><span id=\\\"target-chord\\\" class=\\\"active\\\">Chord</span></div></div><div id=\\\"axis-actions\\\" hidden><button id=\\\"axis-set\\\">Set</button><button id=\\\"axis-cancel\\\">Cancel</button></div><button id=\\\"axis-up\\\" aria-label=\\\"Increase vertical interval\\\">\\u2191</button><output id=\\\"axis-vertical\\\" aria-label=\\\"Vertical semitones\\\">3</output><button id=\\\"axis-down\\\" aria-label=\\\"Decrease vertical interval\\\">\\u2193</button><div class=\\\"axis-horizontal\\\"><button id=\\\"axis-left\\\" aria-label=\\\"Decrease horizontal interval\\\">\\u2190</button><output id=\\\"axis-horizontal\\\" aria-label=\\\"Horizontal semitones\\\">4</output><button id=\\\"axis-right\\\" aria-label=\\\"Increase horizontal interval\\\">\\u2192</button></div></div></section>\\n\";const panel=holder.firstElementChild;document.querySelector('.sidebar').insertBefore(panel,document.querySelector('.metronome'));panel.querySelector('#axis-scale').append(root);const style=document.createElement('style');style.textContent=\"#grid-status{border-top:1px solid var(--line);padding-top:8px;flex:none}.axis-controls{display:grid;grid-template-columns:1fr 28px;grid-template-rows:25px 20px 25px;gap:2px 12px;margin-top:5px}#axis-info,#axis-actions{grid-column:1;grid-row:1/3;min-width:0}#axis-up{grid-column:2;grid-row:1}#axis-vertical{grid-column:2;grid-row:2}#axis-down{grid-column:2;grid-row:3}.axis-horizontal{grid-column:1;grid-row:3;display:flex;align-items:center;gap:9px}.axis-controls button{min-width:28px;height:25px;padding:0;font-size:19px;line-height:1}.axis-controls output{text-align:center;min-width:20px;font-size:13px;font-variant-numeric:tabular-nums}.axis-target{display:flex;margin-top:3px;font-size:10px;width:max-content;border:1px solid var(--line);border-radius:3px;overflow:hidden}.axis-target span{padding:2px 8px;color:var(--muted)}.axis-target .active{background:var(--mint);color:var(--ink)}#axis-info small{font-size:8px;color:var(--muted);display:block;margin-top:2px}#axis-scale .eyebrow,#axis-scale .scale-sub{display:none}#axis-scale .scale-heading{line-height:1;gap:5px}#axis-scale .tonic{font-size:17px;letter-spacing:0}#axis-scale .scale-name{font-size:12px;margin-left:5px}#axis-scale .scale-heading>div{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#axis-scale kbd{font-size:9px;min-width:18px;padding:2px}#axis-actions:not([hidden]){display:flex;flex-direction:column;align-items:flex-start;gap:3px}#axis-actions button{font-size:11px;padding:3px 12px;height:22px}#axis-set{background:var(--mint);color:var(--ink)}#grid-status button:disabled{opacity:.35}#grid-status [hidden]{display:none!important}@media(max-width:1449px){.sidebar{gap:8px}}.sidebar>section{flex-shrink:0}\\n\\n@media(max-height:850px){.sidebar .mode{height:22px}}\\n\";document.head.append(style);})()");
 await pause(150);await shot('status-1280');
 await evaluate('document.getElementById("axis-info").hidden=true;document.getElementById("axis-actions").hidden=false;document.getElementById("axis-horizontal").textContent="5"');await shot('draft-1280');
 await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:100,maxRetries:20,retryDelay:100});
}
