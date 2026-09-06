// Local design renderer. Requires Node 22+ and installed Chrome; installs nothing.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join, dirname} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile=await mkdtemp(join(root,'.render-profile-'));
const processHandle=spawn(chrome,['--headless','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let chromeError='';processHandle.stderr.on('data',chunk=>{chromeError+=chunk.toString();});
const pause=ms=>new Promise(r=>setTimeout(r,ms));

const states=[
 {name:'07-collect-chord',scene:1},{name:'08-name-chord',scene:2},
 {name:'09-collect-mode',scene:3},{name:'10-edit-slots',scene:4},
 {name:'11-save-document',scene:5},{name:'12-unsaved-changes',scene:6},
 {name:'08b-name-mode',scene:2,extra:'&kind=mode'},
 {name:'10b-edit-modes',scene:4,extra:'&target=mode'},
 {name:'11b-open-document',scene:5,extra:'&operation=open'},
 {name:'12b-revert-document',scene:6,extra:'&operation=revert'},
 {name:'12c-many-changes',scene:6,extra:'&changes=many'}
];
let socket;
try {
  let port;
  for(let i=0;i<200;i++){
    try {port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;} catch {await pause(50);}
  }
  if(!port)throw Error(`Chrome did not start: ${chromeError}`);
  const targets=await (await fetch(`http://localhost:${port}/json`)).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let serial=0;const pending=new Map();
  socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  const version=await send('Browser.getVersion');
  const records=[],qaRecords=[];
  await send('Page.enable');
  for(const [width,height] of [[1280,800],[1600,1000]]){
    const destination=width===1280?root:join(root,'1600x1000');await mkdir(destination,{recursive:true});
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for(const {name,scene,extra=''} of states){
      await send('Page.navigate',{url:`${pathToFileURL(join(root,'index.html'))}?scene=${scene}${extra}&qa=1`});
      let qa;
      for(let attempt=0;attempt<100;attempt++){
        await pause(50);
        const result=await send('Runtime.evaluate',{expression:"document.getElementById('authoring-qa')?.textContent",returnByValue:true});
        if(result.result.value){const candidate=JSON.parse(result.result.value);if(candidate.state===String(scene)){qa=candidate;break;}}
      }
      if(!qa)throw Error(`Missing fixture: ${name}`);
      if(qa.viewport.width!==width||qa.viewport.height!==height)throw Error(`Viewport mismatch: ${name}`);
      if(qa.outside.length||qa.controlOverflow.length||qa.documentHeight>height)throw Error(`Clipped layout: ${name}: ${JSON.stringify({outside:qa.outside,overflow:qa.controlOverflow,documentHeight:qa.documentHeight})}`);
      if(qa.changesList){const c=qa.changesList;if(c.paddingLeft<32||!c.lastItemVisible||!c.footerStationary)throw Error(`Changes list layout failed: ${name}`);if(name==='12c-many-changes'&&c.scrollTop<=0)throw Error('Long changes list did not scroll');}
      const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
      const png=Buffer.from(capture.data,'base64');
      if(png.readUInt32BE(16)!==width||png.readUInt32BE(20)!==height)throw Error('PNG dimension mismatch');
      const file=`${width===1280?'':'1600x1000/'}${name}.png`;
      await writeFile(join(root,file),png);qaRecords.push({...qa,file});records.push({file,width,height,bytes:png.length});
      console.log(`Rendered and checked ${file}`);
    }
  }
  await writeFile(join(root,'render-manifest.json'),JSON.stringify({renderer:chrome,version,deviceScaleFactor:1,viewportNote:'1280x800 review baseline and 1600x1000 comparison; neither measures the user display.',images:records},null,2)+'\n');
  await writeFile(join(root,'visual-qa.json'),JSON.stringify(qaRecords,null,2)+'\n');
  await send('Browser.close');
} finally {
  socket?.close();processHandle.kill('SIGTERM');
  if(processHandle.exitCode===null)await Promise.race([new Promise(r=>processHandle.once('exit',r)),pause(2000)]);
  if(processHandle.exitCode===null)processHandle.kill('SIGKILL');
  await rm(profile,{recursive:true,force:true});
}
