import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
let cachedProxy, checkedAt = 0;
export function parseSystemProxy(value) {
  const parts=value.trim().split(';');
  const selected=parts.find(p=>p.startsWith('https='))?.slice(6)||parts.find(p=>p.startsWith('http='))?.slice(5)||(parts.length===1&&!parts[0].includes('=')?parts[0]:null);
  return selected ? normalizeProxy(selected) : null;
}
function normalizeProxy(value) {
  const url=new URL(value.includes('://')?value:`http://${value}`);
  if(!['http:','https:'].includes(url.protocol))throw new Error('代理需使用 HTTP 或 HTTPS 协议，请使用 HTTP/混合端口。');
  return url.href;
}
export async function proxyConfig() {
  if(process.env.RADAR_NETWORK_MODE==='direct')return null;
  const explicit=process.env.RADAR_PROXY||process.env.https_proxy||process.env.HTTPS_PROXY||process.env.http_proxy||process.env.HTTP_PROXY||process.env.all_proxy||process.env.ALL_PROXY;
  if(explicit)return {url:normalizeProxy(explicit),kind:'configured-proxy'};
  if(process.platform!=='win32')return null;
  if(Date.now()-checkedAt<60000)return cachedProxy;
  checkedAt=Date.now();cachedProxy=null;
  try {
    const {stdout}=await exec('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],{windowsHide:true,timeout:3000,maxBuffer:64000});
    if(!/ProxyEnable\s+REG_DWORD\s+0x1\b/i.test(stdout))return null;
    const value=stdout.match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/i)?.[1];
    if(value){const url=parseSystemProxy(value);if(url)cachedProxy={url,kind:'windows-system-proxy'};}
  } catch { /* Missing registry access is normal; explicit configuration remains available. */ }
  return cachedProxy;
}
export function networkError(error,host) {
  const code=error.status?`HTTP_${error.status}`:error.cause?.code||error.code||(['TimeoutError','AbortError'].includes(error.name)?'TIMEOUT':'NETWORK_ERROR');
  const descriptions={ENOTFOUND:'DNS 解析失败',EAI_AGAIN:'DNS 暂时不可用',ECONNREFUSED:'连接被拒绝，请检查代理是否已启动',ECONNRESET:'连接被重置',UND_ERR_CONNECT_TIMEOUT:'连接超时',TIMEOUT:'请求超时',ETIMEDOUT:'连接超时',HTTP_403:'访问受限或 API 限流',HTTP_429:'请求过于频繁',HTTP_401:'GitHub Token 无效或已过期',UNABLE_TO_VERIFY_LEAF_SIGNATURE:'证书验证失败，请配置受信任 CA',DEPTH_ZERO_SELF_SIGNED_CERT:'代理证书不受信任'};
  return Object.assign(new Error(`${host}：${descriptions[code]||'网络请求失败'}（${code}）。请检查网络/代理后重试，可运行 npm run doctor 诊断。`),{code,status:error.status});
}
async function viaProxy(url,headers,timeout,proxy) {
  // Proxy opt-in is per subprocess. Secrets use stdin/env, never argv or logs.
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--use-env-proxy',fileURLToPath(new URL('./network-worker.mjs',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore'],env:{...process.env,HTTPS_PROXY:proxy.url,https_proxy:proxy.url,HTTP_PROXY:proxy.url,http_proxy:proxy.url}});
    let output='',settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{child.kill();finish(Object.assign(new Error(),{code:'TIMEOUT'}));},timeout+3000);
    child.on('error',e=>finish(e));child.stdin.on('error',()=>{});
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>5_000_000){child.kill();finish(Object.assign(new Error(),{code:'RESPONSE_TOO_LARGE'}));}});
    child.on('close',()=>{if(settled)return;try{const value=JSON.parse(output);if(value.error)finish(Object.assign(new Error(),value.error));else finish(null,value.text);}catch{finish(Object.assign(new Error(),{code:'PROXY_WORKER_ERROR'}));}});
    child.stdin.end(JSON.stringify({url,headers,timeout}));
  });
}
export async function requestText(url,headers,timeout) {
  const target=new URL(url);
  if(target.protocol!=='https:'||!['github.com','api.github.com'].includes(target.hostname))throw new Error('不允许的请求目标');
  try {
    const proxy=await proxyConfig();
    if(proxy)return await viaProxy(url,headers,timeout,proxy);
    const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(timeout)});
    if(!response.ok)throw Object.assign(new Error(),{status:response.status});
    const text=await response.text();if(text.length>3_000_000)throw Object.assign(new Error(),{code:'RESPONSE_TOO_LARGE'});return text;
  } catch(e){throw networkError(e,target.hostname);}
}
