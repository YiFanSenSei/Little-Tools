import {prepare,ready,npm,run,appDir} from './setup.mjs';
import path from 'node:path';
const [command,...args]=process.argv.slice(2);
try{
  if(command==='ready')await ready();
  else if(command==='setup')await prepare({install:!args.includes('--no-install')});
  else if(command==='interaction'){const state=await ready();await run(path.join(appDir,'node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'),['scripts/check-pet-interaction.cjs'],{env:state.env});}
  else if(['start','dev','build','pack','test'].includes(command)){
    const state=command==='start'?await ready():await prepare();
    await npm(['run',command,'--',...args],{env:{...state.env,CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
  }else throw new Error('Unknown Desktop Assistant command');
}catch(error){console.error(error.message);process.exitCode=1;}
