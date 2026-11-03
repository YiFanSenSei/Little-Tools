import test from 'node:test';
import assert from 'node:assert/strict';
import { findings, forbidden, audit } from '../scripts/privacy-check.mjs';
import { zip } from '../scripts/zip.mjs';
test('release audit excludes private files and detects synthetic sensitive strings without echoing them', async()=>{
  assert.ok(forbidden('data/settings.json'));
  assert.ok(forbidden('.env.local'));
  assert.ok(forbidden('preview.png'));
  assert.equal(forbidden('.env.example'),false);
  assert.ok(findings('GITHUB_TOKEN='+'sample-secret-value').length);
  assert.ok(findings('ghp_'+'a'.repeat(30)).length);
  assert.ok(findings(['C:', 'Users', 'sample-user', 'project'].join('\\')).length);
  assert.deepEqual(findings('GITHUB_TOKEN=\nPORT=3210'),[]);
  assert.deepEqual((await audit({git:false})).issues,[]);
});
test('release ZIP keeps UTF-8 names and correct entry boundaries',()=>{
  const data=zip([{name:'source/test.txt',data:Buffer.from('hello')},{name:'source/示例.txt',data:Buffer.from('world')}]);
  const end=data.length-22;
  assert.equal(data.readUInt32LE(end),0x06054b50);
  assert.equal(data.readUInt16LE(end+10),2);
  let offset=0;
  for(const expected of ['hello','world']){
    assert.equal(data.readUInt32LE(offset),0x04034b50);
    assert.equal(data.readUInt16LE(offset+6),0x800);
    const size=data.readUInt32LE(offset+18),nameSize=data.readUInt16LE(offset+26);
    assert.equal(data.subarray(offset+30+nameSize,offset+30+nameSize+size).toString(),expected);
    offset+=30+nameSize+size;
  }
  assert.equal(offset,data.readUInt32LE(end+16));
  assert.throws(()=>zip([{name:'../secret',data:Buffer.alloc(0)}]));
});
