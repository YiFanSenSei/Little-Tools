let input='';for await(const chunk of process.stdin)input+=chunk;
try {
  const {url,headers,timeout}=JSON.parse(input),target=new URL(url);
  if(target.protocol!=='https:'||!['github.com','api.github.com'].includes(target.hostname))throw Object.assign(new Error(),{code:'INVALID_TARGET'});
  const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw Object.assign(new Error(),{status:response.status});
  const text=await response.text();if(text.length>3_000_000)throw Object.assign(new Error(),{code:'RESPONSE_TOO_LARGE'});
  process.stdout.write(JSON.stringify({text}));
}catch(e){process.stdout.write(JSON.stringify({error:{status:e.status,code:e.cause?.code||e.code||(e.name==='TimeoutError'?'TIMEOUT':'NETWORK_ERROR')}}));}
