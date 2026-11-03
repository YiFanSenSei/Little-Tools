import { proxyConfig } from '../lib/network.mjs';
import { getText } from '../lib/trending.mjs';
const proxy=await proxyConfig();
console.log(`Network route: ${proxy?.kind || 'direct'} (proxy addresses and credentials are not printed)`);
for(const url of ['https://github.com/trending?since=weekly','https://api.github.com/rate_limit']){
  const started=Date.now();
  try{const body=await getText(url,{}, {timeout:12000,attempts:1});console.log(`${new URL(url).hostname}: OK (${Date.now()-started} ms, ${body.length} characters)`);}
  catch(e){console.error(e.message);process.exitCode=1;}
}
