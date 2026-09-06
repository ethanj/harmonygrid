import {spawnSync} from 'node:child_process';
import {mkdir,cp} from 'node:fs/promises';
const result=spawnSync('npm',['run','build','--','--base=/play/','--outDir=docs/site/play'],{stdio:'inherit'});
if(result.status)process.exit(result.status);
await mkdir('docs/site/play',{recursive:true});
for(const file of ['index.html','instrument.png','credits.html','about.html','original-icon.png','hip-software.png','manual-cover.png'])await cp(`docs/website/${file}`,`docs/site/${file}`);
await mkdir('docs/site/history/magazines',{recursive:true});
for(const file of ['em-106.png','em-108.png','em-109.png','em-115.png','em-116.png','mt-49.png']) {
  await cp(`docs/website/history/magazines/${file}`,`docs/site/history/magazines/${file}`);
}
await cp('docs/website/history/magazines/selection.md','docs/site/history/magazines/selection.md');
await mkdir('docs/site/licenses',{recursive:true});
await cp('docs/assets/soundfonts/LICENSE.txt','docs/site/licenses/GeneralUser-GS.txt');
await cp('docs/assets/soundfonts/SPESSASYNTH-LICENSE.txt','docs/site/licenses/SpessaSynth.txt');
await cp('LICENSE','docs/site/licenses/HarmonyGrid.txt');

await cp('docs/harmonygrid.pdf','docs/site/harmonygrid.pdf');
