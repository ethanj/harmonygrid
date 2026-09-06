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
 report.browser=await send('Browser.getVersion');await send('Page.enable');
 for(const state of ['first','error','invalid','fallback']){
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:new URL('index.html?state='+state,import.meta.url).href});await pause(300);
  check(await evaluate('document.querySelector(".dialog").getBoundingClientRect().bottom <= innerHeight'),state+' fits viewport');
  await writeFile(join(root,state+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 }
 await send('Browser.close');
}catch(error){report.failure=error.message;try{await diagnose?.();}catch{}throw error;}
finally{
 await writeFile(join(root,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
 socket?.close();chrome.kill('SIGTERM');if(chrome.exitCode===null)await Promise.race([new Promise(r=>chrome.once('exit',r)),pause(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');await rm(profile,{recursive:true,force:true});
}
