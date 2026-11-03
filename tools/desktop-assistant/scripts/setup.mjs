import {spawnSync,spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,copyFile,lstat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyInstalledVersions} from './validate-dependencies.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const appDir=path.join(root,'.runtime','app');
const runtime=path.join(root,'.runtime'),base=path.join(runtime,'upstream');
const sha=data=>createHash('sha256').update(data).digest('hex');
function capture(command,args,cwd=root,env=process.env){const r=spawnSync(command,args,{cwd,env,windowsHide:true,maxBuffer:16*1024**2});if(r.error||r.status!==0)throw new Error(`${command} failed: ${r.error?.message||r.stderr?.toString()||r.status}`);return r.stdout;}
export async function run(command,args,{cwd=appDir,env=process.env}={}){
  await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env,stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));});
}
export function npm(args,{cwd=appDir,env=process.env}={}){
  const cli=process.env.npm_execpath;
  if(cli)return run(process.execPath,[cli,...args],{cwd,env});
  if(process.platform==='win32')return run(process.env.ComSpec||'cmd.exe',['/d','/c','npm.cmd',...args],{cwd,env});
  return run('npm',args,{cwd,env});
}
async function sourceFiles(dir,prefix=''){
  const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=prefix+entry.name,full=path.join(dir,entry.name);if((await lstat(full)).isSymbolicLink())throw new Error('Source symlinks are not allowed');if(entry.isDirectory())result.push(...await sourceFiles(full,name+'/'));else result.push(name);}return result.sort();
}
async function networkEnv(){
  const env={...process.env};
  // Read the current Windows proxy for this process only. No machine settings are saved.
  if(process.platform==='win32'&&!env.HTTPS_PROXY&&!env.https_proxy){
    try{
      const command="$p=Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';if($p.ProxyEnable -eq 1 -and $p.ProxyServer -notmatch '='){[Console]::Write($p.ProxyServer)}";
      const proxy=capture('powershell.exe',['-NoProfile','-NonInteractive','-Command',command]).toString().trim();
      if(proxy){env.HTTPS_PROXY='http://'+proxy;env.HTTP_PROXY=env.HTTPS_PROXY;}
    }catch{/* Direct networking remains available. */}
  }
  const proxy=env.HTTPS_PROXY||env.https_proxy;
  if(proxy){env.GIT_CONFIG_COUNT='1';env.GIT_CONFIG_KEY_0='http.proxy';env.GIT_CONFIG_VALUE_0=proxy;env.ELECTRON_GET_USE_PROXY='true';env.GLOBAL_AGENT_HTTPS_PROXY=proxy;env.GLOBAL_AGENT_HTTP_PROXY=proxy;}
  return env;
}
export async function prepare({install=true}={}){
  const upstream=JSON.parse(await readFile(path.join(root,'upstream.json'),'utf8'));
  if(!/^[a-f0-9]{40}$/.test(upstream.commit))throw new Error('Invalid upstream revision');
  const files=await sourceFiles(path.join(root,'overlay'));
  const hash=createHash('sha256').update(JSON.stringify(upstream));
  hash.update(await readFile(path.join(root,'patches/desktop-assistant.patch')));
  for(const name of files)hash.update(name).update(await readFile(path.join(root,'overlay',name)));
  const digest=hash.digest('hex'),stamp=path.join(runtime,'prepared.json');
  let previous={};try{previous=JSON.parse(await readFile(stamp,'utf8'));}catch{}
  await mkdir(runtime,{recursive:true});
  const env=await networkEnv();
  if(previous.digest!==digest||!existsSync(path.join(appDir,'package.json'))){
    console.log('Assembling Desktop Assistant from the pinned upstream and reviewed overlay...');
    if(!existsSync(path.join(base,'.git'))){await mkdir(base,{recursive:true});capture('git',['init',base]);capture('git',['remote','add','origin',upstream.repository],base);}
    try{capture('git',['cat-file','-e',upstream.commit+'^{commit}'],base);}catch{await run('git',['fetch','--depth=1','origin',upstream.commit],{cwd:base,env});}
    await mkdir(appDir,{recursive:true});
    const names=capture('git',['ls-tree','-r','--name-only',upstream.commit],base).toString().trim().split('\n').filter(Boolean);
    for(const name of names){
      const destination=path.resolve(appDir,name);
      if(!destination.startsWith(appDir+path.sep)||name.includes('..')||name.includes('\\'))throw new Error('Unsafe upstream source path');
      await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,capture('git',['show',upstream.commit+':'+name],base));
    }
    if(!existsSync(path.join(appDir,'.git')))capture('git',['init',appDir]);
    capture('git',['apply','--unidiff-zero',path.join(root,'patches/desktop-assistant.patch')],appDir);
    for(const name of files){const destination=path.join(appDir,name);await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.join(root,'overlay',name),destination);}
    const classic=path.join(appDir,'src/assets/whale-girl.png');await mkdir(path.dirname(classic),{recursive:true});
    let valid=false;try{valid=sha(await readFile(classic))===upstream.classicAsset.sha256;}catch{}
    if(!valid){
      await run(process.platform==='win32'?'curl.exe':'curl',['--fail','--location','--retry','2','--silent','--show-error','--output',classic,upstream.classicAsset.url],{cwd:appDir,env});
      if(sha(await readFile(classic))!==upstream.classicAsset.sha256)throw new Error('Classic image checksum mismatch');
    }
    if(process.platform==='win32')await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(appDir,'scripts/build-icon.ps1')],{env});
    await writeFile(stamp,JSON.stringify({digest}));
  }
  const lockHash=sha(await readFile(path.join(appDir,'package-lock.json'))),dependencyStamp=path.join(runtime,'dependencies.txt');
  let installed='';try{installed=await readFile(dependencyStamp,'utf8');}catch{}
  if(install&&(installed!==lockHash||!existsSync(path.join(appDir,'node_modules/electron/package.json')))){
    await npm(['ci','--include=dev','--no-audit','--no-fund'],{env});
  }
  if(install){await verifyInstalledVersions(appDir,JSON.parse(await readFile(path.join(appDir,'package-lock.json'),'utf8')));await writeFile(dependencyStamp,lockHash);}
  return {appDir,digest,env};
}
export async function ready(options){const state=await prepare(options);let built='';try{built=await readFile(path.join(runtime,'built.txt'),'utf8');}catch{}if(built!==state.digest||!existsSync(path.join(appDir,'dist-electron/main.js'))){await npm(['run','build'],{env:state.env});await writeFile(path.join(runtime,'built.txt'),state.digest);}return state;}
