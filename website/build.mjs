/*! Copyright (c) 2026 Ethan Joffe */
import {spawnSync} from 'node:child_process';
import {mkdir,cp,readdir,readFile,writeFile} from 'node:fs/promises';
const result=spawnSync('npm',['run','build','--','--base=/play/','--outDir=dist/site/play'],{stdio:'inherit'});
if(result.status)process.exit(result.status);
await mkdir('dist/site/play',{recursive:true});
for(const file of ['index.html','instrument.png','credits.html','about.html','original-icon.png','hip-software.png','manual-cover.png','harmonygrid-award.jpg'])await cp(`website/${file}`,`dist/site/${file}`);
await mkdir('dist/site/history/magazines',{recursive:true});
for(const file of ['em-106.png','em-108.png','em-109.png','em-115.png','em-116.png','mt-49.png']) {
  await cp(`website/history/magazines/${file}`,`dist/site/history/magazines/${file}`);
}
await cp('website/history/magazines/selection.md','dist/site/history/magazines/selection.md');
await mkdir('dist/site/licenses',{recursive:true});
await cp('assets/soundfonts/LICENSE.txt','dist/site/licenses/GeneralUser-GS.txt');
await cp('assets/soundfonts/SPESSASYNTH-LICENSE.txt','dist/site/licenses/SpessaSynth.txt');
await cp('LICENSE','dist/site/licenses/HarmonyGrid.txt');

await cp('website/harmonygrid.pdf','dist/site/harmonygrid.pdf');

// Preserve the application copyright in minified publish assets, alongside
// any third-party license notices already emitted by the bundler.
async function addScriptHeaders(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=`${directory}/${entry.name}`;
    if(entry.isDirectory())await addScriptHeaders(path);
    else if(entry.name.endsWith('.js')){
      const source=await readFile(path,'utf8'),header='/*! Copyright (c) 2026 Ethan Joffe */';
      if(!source.startsWith(header))await writeFile(path,`${header}\n${source}`);
    }
  }
}
await addScriptHeaders('dist/site/play');
