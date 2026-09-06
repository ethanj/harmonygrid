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
 {name:'13-capture-no-eviction',scene:1},
 {name:'14-capture-optional-limit',scene:2},
 {name:'14b-capture-limit-after-click',scene:2,activateLimit:true},
 {name:'15-capture-empty-start',scene:3},
 {name:'16-capture-naming',scene:4},
 {name:'17-capture-empty-finish',scene:5},
 {name:'18-capture-mode',scene:6}
];
const expected={
 1:{selected:[64,67,71,72],audition:[64,67,71,72],sound:[48,55,64,67,71,72]},
 2:{selected:[64,67,71,72],audition:[64,67,71,72],sound:[48,55,64,67,71,72]},
 3:{selected:[],audition:[],sound:[48,55,64]},
 4:{selected:[64,67,71,72],audition:[],sound:[48,55,64]},
 5:{selected:[],audition:[],sound:[48,55,64]},
 6:{selected:[60,62,64,67,69,72],audition:[60,62,64,67,69,72],sound:[48,55,60,62,64,67,69,72]}
};
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
    for(const {name,scene,extra='',activateLimit=false} of states){
      await send('Page.navigate',{url:`${pathToFileURL(join(root,'index.html'))}?scene=${scene}${extra}&qa=1`});
      let qa;
      for(let attempt=0;attempt<100;attempt++){
        await pause(50);
        const result=await send('Runtime.evaluate',{expression:"document.getElementById('capture-qa')?.textContent",returnByValue:true});
        if(result.result.value){const candidate=JSON.parse(result.result.value);if(candidate.state===String(scene)){qa=candidate;break;}}
      }
      if(!qa)throw Error(`Missing fixture: ${name}`);
      const defaultState=await send('Runtime.evaluate',{expression:"captureFixture.limited===false && !document.querySelector('#capture-limit')?.checked",returnByValue:true});
      if(defaultState.result.value!==true)throw Error(`Capture limit must start unchecked: ${name}`);
      if(activateLimit){
        const enabled=await send('Runtime.evaluate',{expression:"document.querySelector('#capture-limit').click();window.captureQA()",returnByValue:true});
        qa=enabled.result.value;
        if(!qa.limited)throw Error('Click did not enable the optional limit');
      }
      qa.defaultLimitUnchecked=true;qa.reviewAction=activateLimit?'Checked Limit capture audition notes after page load':'None';
      if(qa.viewport.width!==width||qa.viewport.height!==height)throw Error(`Viewport mismatch: ${name}`);
      if(qa.outside.length||qa.controlOverflow.length||qa.documentHeight>height)throw Error(`Clipped layout: ${name}: ${JSON.stringify({outside:qa.outside,overflow:qa.controlOverflow,documentHeight:qa.documentHeight})}`);
      const fixture=activateLimit?{selected:[64,67,71,72],audition:[71,72],sound:[48,55,64,71,72]}:expected[scene];
      for(const entry of [...qa.cells,...qa.keys]){
        if(entry.sounding!==fixture.sound.includes(entry.pitch))throw Error(`Incorrect sound marker: ${name} ${entry.pitch}`);
        if(scene!==5&&(entry.selected!==fixture.selected.includes(entry.pitch)||entry.audition!==fixture.audition.includes(entry.pitch)))throw Error(`Incorrect draft marker: ${name} ${entry.pitch}`);
      }
      if(scene===5&&qa.notice!=='No pitches selected')throw Error('Missing empty-capture notice');
      const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
      const png=Buffer.from(capture.data,'base64');
      if(png.readUInt32BE(16)!==width||png.readUInt32BE(20)!==height)throw Error('PNG dimension mismatch');
      const file=`${width===1280?'':'1600x1000/'}${name}.png`;
      await writeFile(join(root,file),png);qaRecords.push({...qa,file});records.push({file,width,height,bytes:png.length,reviewAction:qa.reviewAction});
      console.log(`Rendered and checked ${file}`);
    }
  }
  await writeFile(join(root,'render-manifest.json'),JSON.stringify({renderer:chrome,version,deviceScaleFactor:1,viewportNote:'1280x800 review baseline and 1600x1000 comparison; neither measures the user display.',images:records},null,2)+'\n');
  await writeFile(join(root,'visual-qa.json'),JSON.stringify(qaRecords,null,2)+'\n');
  // Focused preview interaction witnesses; these do not exercise the instrument engine.
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const witnesses=[];
  const check=async(name,expression)=>{if(!await evaluate(expression))throw Error(`Preview witness failed: ${name}`);witnesses.push(name);};
  await send('Page.navigate',{url:`${pathToFileURL(join(root,'index.html'))}?scene=3&qa=1`});
  for(let i=0;i<100;i++){await pause(50);if(await evaluate("window.captureFixture?.state==='3'"))break;}
  await check('new capture is empty; earlier notes still sound',"captureFixture.picked.length===0 && captureFixture.reference===null && captureFixture.sounding.join(',')==='48,55,64'");
  await evaluate("document.querySelector('[data-key=\"60\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('[data-key=\"64\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('[data-key=\"60\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('[data-key=\"64\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
  await check('clearing all selections preserves reference and earlier E4',"captureFixture.picked.length===0 && captureFixture.reference===60 && captureFixture.sounding.includes(64)");
  await evaluate("document.querySelector('[data-key=\"67\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
  await check('refilling keeps C4 reference',"captureFixture.picked.join(',')==='67' && captureFixture.reference===60");
  const key=async(type,key,code)=>send('Input.dispatchKeyEvent',{type,key,code});
  await key('keyDown','n','KeyN');await key('keyDown','m','KeyM');await key('keyUp','n','KeyN');
  await check('N to M handoff continues after releasing N',"captureFixture.kind==='mode' && captureFixture.phase==='collect' && captureFixture.picked.join(',')==='67' && captureFixture.reference===60");
  await key('keyUp','m','KeyM');
  await check('M release opens naming and stops audition only',"captureFixture.phase==='naming' && captureFixture.audition.length===0 && captureFixture.sounding.join(',')==='48,55,64'");
  await key('keyDown','7','Digit7');await key('keyUp','7','Digit7');await key('keyDown','Tab','Tab');await key('keyUp','Tab','Tab');
  await check('digit then Tab selects slot and focuses name',"document.querySelector('[data-slot=\"7\"]').classList.contains('selected') && document.activeElement.id==='pattern-name'");
  await key('keyDown','Escape','Escape');await key('keyUp','Escape','Escape');
  await check('Escape from naming restores performance',"captureFixture.phase==='playing' && captureFixture.picked.length===0 && captureFixture.sounding.join(',')==='48,55,64'");
  await key('keyDown','n','KeyN');await key('keyUp','n','KeyN');
  await check('empty release ends collection with notice',"captureFixture.phase==='playing' && captureFixture.notice==='No pitches selected' && captureFixture.audition.length===0");
  await check('notice stays in header above playing workspace',"document.querySelector('.capture-notice').getBoundingClientRect().bottom<=document.querySelector('.workspace').getBoundingClientRect().top");
  await writeFile(join(root,'interaction-qa.json'),JSON.stringify({scope:'Design preview only; no audio or MIDI',witnesses},null,2)+'\n');
  console.log(`Verified ${witnesses.length} preview interactions`);
  await send('Browser.close');
} finally {
  socket?.close();processHandle.kill('SIGTERM');
  if(processHandle.exitCode===null)await Promise.race([new Promise(r=>processHandle.once('exit',r)),pause(2000)]);
  if(processHandle.exitCode===null)processHandle.kill('SIGKILL');
  await rm(profile,{recursive:true,force:true});
}
