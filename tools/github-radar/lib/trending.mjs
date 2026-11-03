const decode = s => s.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n))).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
import { requestText } from './network.mjs';
export const plain = s => decode(s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const count = s => { const t = plain(s).replace(/,/g, ''); const m = t.match(/([\d.]+)\s*([km])?/i); return m ? Math.round(Number(m[1]) * ({ k: 1000, m: 1000000 }[m[2]?.toLowerCase()] || 1)) : 0; };
export function parseTrending(html) {
  const articles = html.match(/<article\b[^>]*class=["'][^"']*\bBox-row\b[^"']*["'][^>]*>[\s\S]*?<\/article>/g) || [];
  return articles.flatMap((article, i) => {
    const heading = article.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] || '';
    const name = heading.match(/href=["']\/([\w.-]+\/[\w.-]+)["']/)?.[1];
    if (!name) return [];
    const stars = article.match(/href=["'][^"']*\/stargazers["'][^>]*>([\s\S]*?)<\/a>/)?.[1] || '';
    const gain = article.match(/([\d,]+)\s+stars?\s+(?:today|this week|this month)/i)?.[1] || '';
    return [{ name, url: `https://github.com/${name}`, rank: i + 1, description: plain(article.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)?.[1] || ''), language: plain(article.match(/itemprop=["']programmingLanguage["'][^>]*>([\s\S]*?)<\/span>/)?.[1] || '未标注'), stars: count(stars), gained: count(gain) }];
  });
}
export async function getText(url, headers = {}, { timeout = 15000, attempts = 3, delay = ms => new Promise(resolve=>setTimeout(resolve,ms)) } = {}) {
  let error;
  for (let i = 0; i < attempts; i++) {
    try {
      return await requestText(url, { 'User-Agent': 'GitHubRadar/1.0', ...headers }, timeout);
    } catch (e) { error = e; if (e.status && e.status < 500) break; if(i+1<attempts)await delay(500 * 2**i + Math.floor(Math.random()*250)); }
  }
  throw error;
}
export async function fetchTrending(period) {
  const source = `https://github.com/trending?since=${period}`;
  const repos = parseTrending(await getText(source));
  if (!repos.length) throw new Error('未解析到 Trending 项目，可能是 GitHub 页面结构变化或访问被拦截。历史结果已保留。');
  return { repos, source };
}
export async function enrich(repo) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const info = JSON.parse(await getText(`https://api.github.com/repos/${repo.name}`, headers, { timeout: 8000, attempts: 1 }));
  return { ...repo, description: info.description || repo.description, topics: info.topics || [], license: info.license?.spdx_id || '未标注', archived: info.archived, pushedAt: info.pushed_at, homepage: /^https?:\/\//.test(info.homepage || '') ? info.homepage : null, enriched: true };
}
