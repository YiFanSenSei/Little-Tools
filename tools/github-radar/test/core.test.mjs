import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrending } from '../lib/trending.mjs';
import { nextWeekly, lastWeekly } from '../lib/schedule.mjs';
import { analyze } from '../lib/analyze.mjs';

test('parse actual Trending structure, entities, comma counts and irrelevant links', () => {
  const html = `<article class="Box-row"><h2 class="h3"><a href="/example/cool-tool">example / cool-tool</a></h2><p>CLI &amp; AI tools &lt;3</p><span itemprop="programmingLanguage">TypeScript</span><a href="/example/cool-tool/stargazers"><svg></svg>12,345</a><a href="/example/cool-tool/forks">333</a><span>1,234 stars this week</span></article><article class="other">invalid</article>`;
  const repos = parseTrending(html);
  assert.equal(repos.length, 1);
  assert.equal(repos[0].name, 'example/cool-tool');
  assert.equal(repos[0].stars, 12345);
  assert.equal(repos[0].gained, 1234);
  assert.equal(repos[0].description, 'CLI & AI tools <3');
  assert.equal(repos[0].language, 'TypeScript');
  assert.deepEqual(parseTrending('<html>rate limited</html>'), []);
});
test('schedule respects Beijing Monday 09:00 across Sunday UTC, boundary and year change', () => {
  assert.equal(nextWeekly(new Date('2026-11-01T23:00:00Z')), '2026-11-02T01:00:00.000Z');
  assert.equal(nextWeekly(new Date('2026-11-02T01:00:00Z')), '2026-11-09T01:00:00.000Z');
  assert.equal(lastWeekly(new Date('2026-11-02T01:00:00Z')), '2026-11-02T01:00:00.000Z');
  assert.equal(nextWeekly(new Date('2026-12-31T22:00:00Z')), '2027-01-04T01:00:00.000Z');
});
test('interest boosts are bounded, archived repos are penalized and missing metadata is disclosed', () => {
  const repo = { name:'test/agent', description:'AI agent automation', stars:1000, gained:300, rank:1 };
  const a = analyze(repo, []), b = analyze(repo, ['AI']);
  assert.equal(b.category, 'AI 与智能体');
  assert.ok(b.score > a.score);
  assert.ok(b.score <= 100);
  assert.equal(b.matchedInterests[0], 'AI');
  assert.ok(b.cautions.length);
  assert.ok(analyze({...repo, archived:true, enriched:true, license:'MIT'}).score < a.score);
  assert.deepEqual(analyze({name:'test/thinkrail', description:'A mail client', stars:1, gained:1, rank:1}, ['AI']).matchedInterests, []);
  assert.deepEqual(analyze({...repo, description:'A C++ tool'}, ['C++']).matchedInterests, ['C++']);
});
