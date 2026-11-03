import {readFile} from 'node:fs/promises';
import path from 'node:path';
// npm's warm cache can hide a changed tarball URL when its old integrity still matches.
export async function verifyInstalledVersions(appDir,lock){
  for(const [name,entry] of Object.entries(lock.packages)){
    if(!name||!entry.version)continue;
    let installed;
    try{installed=JSON.parse(await readFile(path.join(appDir,name,'package.json'),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(installed.version!==entry.version)throw new Error(`Installed dependency differs from lock file: ${name} (expected ${entry.version}, found ${installed.version})`);
  }
}
