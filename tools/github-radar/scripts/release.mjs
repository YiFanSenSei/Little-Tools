import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { audit, root } from './privacy-check.mjs';
import { zip } from './zip.mjs';
const {files,issues}=await audit();
if(issues.length) { console.error('Release blocked. Run npm run privacy:check and resolve the findings.'); process.exitCode=1; }
else {
  const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(version))throw new Error('Invalid version');
  const output=path.join(root,'release',`github-radar-${version}-${Date.now()}`);
  await mkdir(path.dirname(output),{recursive:true});
  // Never reuse an old output folder, which might contain unreviewed files.
  await mkdir(output);
  const entries=[];
  for(const name of files){
    const data=await readFile(path.join(root,name));
    const target=path.join(output,'github-radar',name);
    await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data);
    entries.push({name:`github-radar/${name}`,data});
  }
  const archive=`github-radar-${version}.zip`;
  const bytes=zip(entries);
  await writeFile(path.join(output,archive),bytes);
  await writeFile(path.join(output,'SHA256SUMS'),`${createHash('sha256').update(bytes).digest('hex')}  ${archive}\n`);
  console.log(`Clean source and ZIP created: ${path.relative(root,output)}\n${files.length} allowlisted files; no Git history, runtime data, .env or screenshots.`);
}
