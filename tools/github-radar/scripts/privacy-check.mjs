import { readFile, lstat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const forbidden = name => /(^|\/)(data|release|node_modules|screenshots|\.git|\.codex|\.agents|\.aws)(\/|$)/i.test(name) || /(^|\/)\.env(?:\..*)?$/.test(name) && name !== '.env.example' || /(?:\.(?:log|pem|key|p12|pfx|zip|tgz)|(?:^|\/)preview\.png)$/i.test(name);
export function findings(text) {
  const rules = [
    ['credential', /\b(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|sk-[a-zA-Z0-9_-]{20,})\b/],
    ['private-key', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
    ['personal-path', /(?:[a-z]:[\\/]+Users[\\/]+[^\s<>"'`]+|\/(?:home|Users)\/[a-z0-9_.-]+\/)/i],
    ['absolute-windows-path', /\b[a-z]:\\[^\s<>"'`]+/i],
    ['configured-token', /^[ \t]*(?:GITHUB_TOKEN|OPENAI_API_KEY)[ \t]*=[ \t]*[^\s#]+/m]
  ];
  return rules.flatMap(([code, re]) => text.split(/\r?\n/).flatMap((line,i)=>re.test(line) ? [{code,line:i+1}] : []));
}
export async function audit({git = true} = {}) {
  const files = JSON.parse(await readFile(path.join(root,'release-files.json'),'utf8'));
  const issues=[];
  if (!Array.isArray(files) || new Set(files).size !== files.length) throw new Error('Invalid release file list');
  for (const name of files) {
    if (typeof name !== 'string' || path.isAbsolute(name) || name.includes('..') || name.includes('\\') || forbidden(name)) { issues.push({file:name,code:'unsafe-release-path'}); continue; }
    const full = path.resolve(root,name);
    try {
      const segments=name.split('/');
      for(let i=1;i<=segments.length;i++) if((await lstat(path.join(root,...segments.slice(0,i)))).isSymbolicLink()) throw new Error('symbolic-link');
      const info=await lstat(full);
      if(!info.isFile()) throw new Error('not-a-file');
      const data=await readFile(full);
      if(data.includes(0)) throw new Error('unexpected-binary');
      issues.push(...findings(data.toString('utf8')).map(f=>({file:name,...f})));
    } catch(e) { issues.push({file:name,code:e.code || e.message}); }
  }
  if (git) {
    let exists=false; try { await lstat(path.join(root,'.git')); exists=true; } catch(e) {if(e.code!=='ENOENT')throw e;}
    if(exists) {
      // Also catches private files already tracked before .gitignore was added.
      const candidates=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
      for(const name of new Set(candidates)) if(!files.includes(name)) issues.push({file:name,code:forbidden(name)?'private-file-in-git':'file-not-reviewed'});
    }
  }
  return {files,issues};
}
if(process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const {files,issues}=await audit();
  if(issues.length) { for(const i of issues) console.error(`${i.file}${i.line?':'+i.line:''}: ${i.code}`); process.exitCode=1; }
  else console.log(`Privacy check passed: ${files.length} reviewed source files. Local data, screenshots and credentials are excluded. Manual review is still required.`);
}
