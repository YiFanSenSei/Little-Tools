import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';

test('local HTTP API validates host, mutation token and settings; serves app and persists preferences', async () => {
  const root = path.resolve('data', 'tests');
  await mkdir(root, {recursive:true});
  const dir = await mkdtemp(path.join(root, 'http-'));
  assert.equal(path.dirname(dir), root);
  await writeFile(path.join(dir, 'settings.json'), JSON.stringify({interests:[], weeklyEnabled:false}));
  const port = 22000 + Math.floor(Math.random()*10000);
  const child = spawn(process.execPath, ['server.mjs'], {cwd:process.cwd(), env:{...process.env, PORT:String(port), RADAR_DATA_DIR:dir}, stdio:['ignore','pipe','pipe']});
  try {
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(()=>{throw new Error('server exited before ready');}), new Promise((_,reject)=>{setTimeout(()=>reject(new Error('server startup timed out')),5000).unref();})]);
    const base=`http://127.0.0.1:${port}`;
    const initial=await (await fetch(`${base}/api/state`)).json();
    assert.equal(initial.settings.weeklyEnabled, false);
    assert.equal(initial.nextRun, null);
    assert.equal((await fetch(`${base}/api/settings`,{method:'POST',body:'{}'})).status,403);
    const options={method:'POST',headers:{'Content-Type':'application/json','X-Radar-Token':initial.token},body:JSON.stringify({interests:['CLI'],weeklyEnabled:false})};
    assert.equal((await fetch(`${base}/api/settings`,options)).status,200);
    assert.deepEqual((await (await fetch(`${base}/api/state`)).json()).settings.interests,['CLI']);
    assert.equal((await fetch(`${base}/api/report?id=../../settings`)).status,400);
    assert.equal((await fetch(`${base}/api/scan`,{...options,body:JSON.stringify({period:'invalid'})})).status,400);
    const hostStatus = await new Promise((resolve,reject) => {
      const request = http.get(`${base}/api/state`, {headers:{Host:'evil.example'}}, response => { response.resume(); resolve(response.statusCode); });
      request.on('error',reject);
    });
    assert.equal(hostStatus,403);
    const page=await fetch(base);
    assert.equal(page.status,200);
    assert.match(await page.text(),/GitHub Radar/);
  } finally {
    if (child.exitCode === null) { const exited=once(child,'exit'); child.kill(); await exited; }
    await rm(dir,{recursive:true,force:true});
  }
});
