import { fetchTrending, enrich } from './trending.mjs';
import { analyze } from './analyze.mjs';
import { read, write, lock } from './storage.mjs';
export const defaults = { interests: ['AI', 'developer', 'productivity'], weeklyEnabled: true };
export async function scan(period = 'weekly', trigger = 'manual', progress = () => {}) {
  if (!['daily', 'weekly', 'monthly'].includes(period)) throw new Error('不支持的榜单周期');
  const release = await lock();
  try {
    const settings = await read('settings.json', defaults);
    progress('正在读取 GitHub Trending…');
    let repos,source,dataFetchedAt,stale=false,fetchError=null;
    try {
      ({repos,source}=await fetchTrending(period));dataFetchedAt=new Date().toISOString();
      await write(`trending-${period}.json`,{repos,source,dataFetchedAt});
    } catch(e) {
      let cached=await read(`trending-${period}.json`);
      if(!cached){
        const history=await read('history.json',[]),entry=history.find(h=>h.period===period);
        const previous=entry?await read(`report-${entry.id}.json`):await read('latest.json');
        if(previous?.period===period)cached={repos:previous.repos,source:previous.source,dataFetchedAt:previous.dataFetchedAt||previous.createdAt};
      }
      if(!cached?.repos?.length)throw e;
      ({repos,source,dataFetchedAt}=cached);stale=true;fetchError=e.message;
      progress('网络暂不可用，正在使用该周期上次成功数据（非最新榜单）…');
    }
    const warnings = [];
    // Bound unauthenticated API usage to 12 requests per scan.
    let cursor = 0, completed = 0, limited = false;
    const metadata=await read('metadata-cache.json',{});
    const limit = stale ? 0 : Math.min(12, repos.length);
    await Promise.all(Array.from({ length: Math.min(3, limit) }, async () => {
      while (cursor < limit && !limited) {
        const i = cursor++;
        const cached=metadata[repos[i].name];
        const mergeCached=()=>{const {description,topics,license,archived,pushedAt,homepage,enriched}=cached.repo;repos[i]={...repos[i],description:description||repos[i].description,topics,license,archived,pushedAt,homepage,enriched,metadataCachedAt:cached.savedAt};};
        try {
          if(cached&&Date.now()-Date.parse(cached.savedAt)<86400_000)mergeCached();
          else {repos[i]=await enrich(repos[i]);metadata[repos[i].name]={savedAt:new Date().toISOString(),repo:repos[i]};}
        }
        catch(e){warnings.push(`${repos[i].name}：${e.message}`);if(cached)mergeCached();if(e.status===403||e.status===429||e.code&&!e.status)limited=true;}
        progress(`正在补充仓库信息 ${++completed} / ${limit}…`);
      }
    }));
    const report = { id: `${Date.now()}-${process.pid}`, createdAt: new Date().toISOString(), period, trigger, source, warnings, methodology: '根据公开描述与主题做关键词分类；评分综合周期新增 Star、累计 Star、增长比例与个人兴趣。属于规则筛选，未运行或审计项目。', repos: repos.map(r => analyze(r, settings.interests)).sort((a, b) => b.score - a.score || a.rank - b.rank) };
    Object.assign(report,{dataFetchedAt,stale,fetchError});
    if(!stale)await write('metadata-cache.json',Object.fromEntries(Object.entries(metadata).sort((a,b)=>b[1].savedAt.localeCompare(a[1].savedAt)).slice(0,250)));
    if(stale){await write('degraded.json',report);return report;}
    await write(`report-${report.id}.json`, report);
    // Keep the index small; existing reports are retained on disk.
    const history = await read('history.json', []);
    await write('history.json', [{ id: report.id, createdAt: report.createdAt, period, count: report.repos.length, trigger }, ...history].slice(0, 100));
    await write('latest.json', report);
    await write('degraded.json',null);
    if (trigger === 'scheduled') await write('schedule-state.json', { lastSuccess: report.createdAt });
    return report;
  } finally { await release(); }
}
