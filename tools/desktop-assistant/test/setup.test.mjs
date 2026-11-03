import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {verifyInstalledVersions} from '../scripts/validate-dependencies.mjs';
test('detects a lock version changed without changing cached tarball contents',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'little-tools-dependency-'));
  try{
    await mkdir(path.join(root,'node_modules/example'),{recursive:true});
    await writeFile(path.join(root,'node_modules/example/package.json'),JSON.stringify({name:'example',version:'0.4.1'}));
    await assert.rejects(verifyInstalledVersions(root,{packages:{'node_modules/example':{version:'0.6.1'}}}),/differs from lock file/);
    await verifyInstalledVersions(root,{packages:{'node_modules/example':{version:'0.4.1'}}});
  }finally{
    if(path.dirname(root)!==path.resolve(tmpdir())||!path.basename(root).startsWith('little-tools-dependency-'))throw new Error('Unexpected temporary directory');
    await rm(root,{recursive:true,force:true});
  }
});
