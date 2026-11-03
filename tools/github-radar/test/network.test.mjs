import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSystemProxy,networkError} from '../lib/network.mjs';
import {getText} from '../lib/trending.mjs';
test('system proxy parsing supports single and per-protocol settings',()=>{
  assert.equal(parseSystemProxy('localhost:8080'),'http://localhost:8080/');
  assert.equal(parseSystemProxy('http=localhost:8080;https=localhost:8081'),'http://localhost:8081/');
  assert.equal(parseSystemProxy('socks=localhost:8080'),null);
});
test('transient failure retries with backoff, permanent HTTP failure stops, error is actionable and redacted',async()=>{
  process.env.RADAR_NETWORK_MODE='direct';const saved=globalThis.fetch;let calls=0;
  try{
    globalThis.fetch=async()=>{if(++calls<3)throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});return new Response('ok');};
    const delays=[];
    assert.equal(await getText('https://github.com/trending',{}, {delay:async ms=>delays.push(ms)}),'ok');
    assert.equal(calls,3);assert.equal(delays.length,2);assert.ok(delays[1]>delays[0]);
    calls=0;globalThis.fetch=async()=>{calls++;return new Response('limited',{status:403});};
    await assert.rejects(getText('https://api.github.com/rate_limit'),/HTTP_403/);assert.equal(calls,1);
    const error=networkError({cause:{code:'ENOTFOUND'},message:'secret-password'},'github.com');
    assert.match(error.message,/DNS/);assert.ok(!error.message.includes('secret-password'));
  }finally{globalThis.fetch=saved;}
});
