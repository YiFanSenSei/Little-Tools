import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';

test('scan persists history and does not overwrite successful report when source fails; cross-process lock rejects duplicate work', async () => {
  const root = path.resolve('data', 'tests');
  await mkdir(root, {recursive:true});
  const dir = await mkdtemp(path.join(root, 'run-'));
  process.env.RADAR_DATA_DIR = dir;
  process.env.RADAR_NETWORK_MODE = 'direct';
  const { scan } = await import('../lib/scanner.mjs');
  const { read, lock, isScanning } = await import('../lib/storage.mjs');
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      if (String(url).includes('/trending')) return new Response('<article class="Box-row"><h2><a href="/test/cli">Test</a></h2><p>developer CLI tools</p><a href="/test/cli/stargazers">1,000</a><span>100 stars this week</span></article>');
      return new Response(JSON.stringify({ description:'Developer CLI tools', topics:['developer'], license:{spdx_id:'MIT'}, pushed_at:'2026-11-01T10:00:00Z', archived:false }));
    };
    const report = await scan('weekly', 'scheduled');
    assert.equal(report.repos.length, 1);
    assert.equal(report.repos[0].license, 'MIT');
    assert.equal((await read('latest.json')).id, report.id);
    assert.equal((await read('history.json')).length, 1);
    assert.equal((await read('schedule-state.json')).lastSuccess, report.createdAt);
    globalThis.fetch = async () => new Response('Temporarily unavailable', {status:503});
    const degraded=await scan('weekly','scheduled');
    assert.equal(degraded.stale,true);
    assert.equal(degraded.dataFetchedAt,report.dataFetchedAt);
    assert.equal((await read('schedule-state.json')).lastSuccess,report.createdAt);
    assert.equal((await read('degraded.json')).stale,true);
    await assert.rejects(scan('monthly'), /503/);
    assert.equal((await read('latest.json')).id, report.id);
    assert.equal((await read('history.json')).length, 1);
    globalThis.fetch=async url=>new Response(String(url).includes('/trending')?'<article class="Box-row"><h2><a href="/test/cli">Test</a></h2><p>developer CLI tools</p><a href="/test/cli/stargazers">1,200</a><span>200 stars this week</span></article>':'{}');
    const recovered=await scan('weekly');
    assert.equal(recovered.stale,false);
    assert.equal(recovered.repos[0].stars,1200);
    assert.equal(recovered.repos[0].license,'MIT');
    assert.ok(recovered.repos[0].metadataCachedAt);
    assert.equal(await read('degraded.json'),null);
    const release = await lock();
    try { assert.equal(await isScanning(), true); await assert.rejects(scan(), /正在运行/); }
    finally { await release(); }
    assert.equal(await isScanning(), false);
  } finally { globalThis.fetch = original; await rm(dir, {recursive:true,force:true}); }
});
