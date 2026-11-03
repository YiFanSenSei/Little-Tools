import {readFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {findings,forbidden,audit} from '../tools/github-radar/scripts/privacy-check.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const registry=JSON.parse(await readFile(path.join(root,'tools.json'),'utf8'));
const roots=JSON.parse(await readFile(path.join(root,'repository-files.json'),'utf8'));
const approved=new Set(roots),issues=[],binaryAssets=new Map();
const ids=new Set(),ports=new Set();
for(const tool of registry){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tool.id)||tool.path!==`tools/${tool.id}`||ids.has(tool.id))throw new Error('Invalid or duplicate tool registration');
  ids.add(tool.id);
  if(tool.defaultPort){if(ports.has(tool.defaultPort))throw new Error('Default port conflict');ports.add(tool.defaultPort);}
  const files=JSON.parse(await readFile(path.join(root,tool.path,'release-files.json'),'utf8'));
  if(tool.binaryAssets){
    if(!files.includes(tool.binaryAssets))throw new Error('Binary asset manifest must be an approved source');
    const assets=JSON.parse(await readFile(path.join(root,tool.path,tool.binaryAssets),'utf8'));
    for(const asset of assets){
      if(!files.includes(asset.path)||!/\.(png|gif|webm)$/.test(asset.path)||!/^[a-f0-9]{64}$/.test(asset.sha256)||!Number.isSafeInteger(asset.bytes)||asset.bytes<=0)throw new Error('Invalid reviewed binary asset');
      binaryAssets.set(`${tool.path}/${asset.path}`,asset);
    }
  }
  for(const name of files){
    if(name.includes('..')||path.isAbsolute(name)||name.includes('\\'))throw new Error('Unsafe source manifest');
    approved.add(`${tool.path}/${name}`);
  }
}
for(const name of approved){
  const safeExample=path.posix.basename(name)==='.env.example';
  if((!safeExample&&forbidden(name))||path.isAbsolute(name)||name.includes('..')||name.includes('\\'))throw new Error('Unsafe repository source path');
  const parts=name.split('/');for(let i=1;i<=parts.length;i++)if((await lstat(path.join(root,...parts.slice(0,i)))).isSymbolicLink())throw new Error('Symlinks are not release sources');
  const bytes=await readFile(path.join(root,name)),binary=binaryAssets.get(name);
  if(binary){
    if(bytes.length!==binary.bytes||createHash('sha256').update(bytes).digest('hex')!==binary.sha256)issues.push(`${name}: changed-or-unreviewed-binary`);
  }else if(bytes.includes(0))issues.push(`${name}: unexpected-binary`);
  else issues.push(...findings(bytes.toString('utf8')).map(f=>`${name}:${f.line}: ${f.code}`));
}
issues.push(...(await audit({git:false})).issues.map(f=>`${f.file}: ${f.code}`));
const actual=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of actual)if(!approved.has(name))issues.push(`${name}: unreviewed-or-private-file`);
if(issues.length){for(const message of issues)console.error(message);process.exitCode=1;}
else console.log(`Repository privacy check passed: ${approved.size} approved files; ${registry.length} isolated tool(s), no duplicate default ports.`);
