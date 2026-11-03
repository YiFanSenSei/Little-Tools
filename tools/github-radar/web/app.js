const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Number(n || 0).toLocaleString('zh-CN');
const date = d => d ? new Date(d).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }) : '—';
const periods = {daily:'今日榜',weekly:'本周榜',monthly:'本月榜'};
let state, report, category = '全部', historyId = null, historySignature = null;
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', 'X-Radar-Token': state?.token || '', ...options.headers } });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || '请求失败'); return data;
}
function showView(name) {
  document.querySelectorAll('.view').forEach(el => { el.hidden = el.id !== name; });
  document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.view === name));
  $('#page-label').textContent = {discover:'项目发现', history:'扫描记录', settings:'偏好与计划'}[name];
}
function renderReport() {
  const repos = report?.repos || [];
  $('#stat-count').textContent = report ? num(repos.length) : '—';
  $('#stat-match').textContent = report ? num(repos.filter(r => r.matchedInterests.length).length) : '—';
  $('#stat-stars').textContent = report ? num(repos.reduce((a, r) => a + r.gained, 0)) : '—';
  $('#stat-date').textContent = report ? date(report.createdAt) : '尚未扫描';
  $('#stat-period').textContent = report ? `${periods[report.period]} · ${report.trigger === 'scheduled' ? '自动扫描' : '手动扫描'}${historyId ? ' · 历史报告' : ''}` : '等待第一次发现';
  const categories = ['全部', ...new Set(repos.map(r => r.category))];
  if (!categories.includes(category)) category = '全部';
  $('#categories').innerHTML = categories.map(c => `<button class="chip ${c === category ? 'active' : ''}" data-category="${esc(c)}">${esc(c)}</button>`).join('');
  $('#export-button').disabled = !report;
  $('#report-note').innerHTML = report ? `<a href="${esc(report.source)}" target="_blank" rel="noopener noreferrer">来源：GitHub Trending ↗</a> · ${esc(report.methodology)}${report.warnings.length ? `<br>部分仓库详情未取得（${report.warnings.length} 条），榜单结果仍可查看。` : ''}` : '';
  if(report){
    const freshness=report.stale?`⚠ 当前为旧数据，非最新榜单。上次成功抓取：${date(report.dataFetchedAt)}（北京时间）。网络恢复后请重新扫描。`:`榜单成功抓取时间：${date(report.dataFetchedAt||report.createdAt)}（北京时间）。`;
    $('#report-note').insertAdjacentHTML('afterbegin',`<p class="${report.stale?'caution':''}">${esc(freshness)}</p>`);
    if(report.fetchError)$('#report-note').insertAdjacentHTML('beforeend',`<p class="caution">${esc(report.fetchError)}</p>`);
    if(report.warnings.length)$('#report-note').insertAdjacentHTML('beforeend',`<details><summary>查看详情获取问题</summary>${report.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</details>`);
    if(report.stale)$('#stat-period').textContent+=' · 旧数据';
  }
  renderCards();
}
function renderCards() {
  const query = $('#search').value.trim().toLowerCase();
  const repos = (report?.repos || []).filter(r => (category === '全部' || r.category === category) && `${r.name} ${r.description} ${r.language} ${r.category}`.toLowerCase().includes(query));
  const order = $('#sort').value;
  repos.sort(order === 'rank' ? (a,b) => a.rank-b.rank : order === 'gained' ? (a,b) => b.gained-a.gained : (a,b) => b.score-a.score || a.rank-b.rank);
  $('#result-count').textContent = report ? `${repos.length} 个` : '';
  $('#cards').innerHTML = repos.length ? repos.map(r => {
    const [owner, name] = r.name.split('/');
    return `<article class="card"><div class="card-top"><span class="category">${esc(r.category)}</span><span class="score"><b>${r.score}</b>发现指数</span></div><a class="repo-name" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(owner)} /</span>${esc(name)} ↗</a><p class="description">${esc(r.description || '暂无公开描述，请查看仓库说明。')}</p><p class="use-case">${esc(r.useCase)}</p><div class="card-bottom"><span>● ${esc(r.language)}</span><span>☆ ${num(r.stars)}</span><span class="gain">↗ ${num(r.gained)} 本周期</span></div><details><summary>为什么值得看看 · 榜单 #${r.rank}</summary><ul>${r.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${r.enriched ? `<p>许可证：${esc(r.license)} · 最近提交：${date(r.pushedAt)}</p>` : ''}${r.cautions.map(x=>`<p class="caution">${esc(x)}</p>`).join('')}</details></article>`;
  }).join('') : `<div class="empty"><strong>${report ? '还没有匹配的项目' : '从第一次拾星开始'}</strong>${report ? '试试其他分类，或换一个搜索词。' : '点击「立即扫描」，读取真实的 GitHub Trending 榜单。<br>首次打开时，也会自动检查本周是否需要扫描。'}</div>`;
}
function renderState() {
  const job = state.job;
  $('#scan-button').disabled = job.running;
  $('#scan-button').textContent = job.running ? '◌ 正在扫描…' : '↻ 立即扫描';
  $('#status').textContent = job.error || (job.running ? job.message : historyId ? '正在查看历史报告。点击「立即扫描」可获取最新榜单。' : job.message || '准备好发现下一颗星。');
  if(!job.running&&!job.error&&report?.stale)$('#status').textContent=`网络暂不可用，正在查看旧数据（${date(report.dataFetchedAt)}），不是本次成功抓取的榜单。`;
  $('#status').classList.toggle('error', !!job.error || !!report?.stale);
  $('#run-label').textContent = state.settings.weeklyEnabled ? '每周一次，自动拾星' : '每周自动扫描已暂停';
  $('#schedule-summary').textContent = state.settings.weeklyEnabled ? `下次计划 ${date(state.nextRun)} · 北京时间${state.task ? '' : ' · 系统任务未安装'}` : '你仍然可以随时手动扫描';
  $('#task-status').textContent = state.task ? `✓ 已安装系统任务：${state.task.name}（安装记录；实际状态以 Windows 任务计划程序为准）` : '○ 尚未安装 Windows 系统任务。目前仅在本应用后台运行时自动扫描。';
  const signature = state.history.map(h => h.id).join(',');
  if (signature !== historySignature) {
    $('#history-list').innerHTML = state.history.length ? state.history.map(h=>`<button class="history-row" data-report="${esc(h.id)}"><div><strong>${date(h.createdAt)} · ${periods[h.period]}</strong><small>${h.trigger === 'scheduled' ? '每周自动扫描' : '手动扫描'} · ${h.count} 个项目</small></div><span>查看报告 ↗</span></button>`).join('') : '<div class="empty">第一次扫描完成后，记录就会出现在这里。</div>';
    historySignature = signature;
  }
}
async function refresh(initial = false) {
  const previous = state?.latest?.id;
  state = await api('/api/state');
  if (initial) { $('#interests').value = state.settings.interests.join(', '); $('#weekly-enabled').checked = state.settings.weeklyEnabled; }
  if (initial || (!historyId && previous !== state.latest?.id)) { report = state.latest; renderReport(); }
  renderState();
}
document.querySelectorAll('.nav').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.view)));
$('#scan-button').addEventListener('click', async () => {
  try { historyId = null; await api('/api/scan', { method:'POST', body:JSON.stringify({period:$('#period').value}) }); report = state.latest; renderReport(); await refresh(); }
  catch(e) { $('#status').textContent=e.message; $('#status').classList.add('error'); }
});
$('#categories').addEventListener('click', e => { const btn = e.target.closest('[data-category]'); if (btn) { category = btn.dataset.category; renderReport(); } });
$('#search').addEventListener('input', renderCards); $('#sort').addEventListener('change', renderCards);
$('#history-list').addEventListener('click', async e => {
  const btn=e.target.closest('[data-report]'); if(!btn)return;
  try { report=await api(`/api/report?id=${encodeURIComponent(btn.dataset.report)}`); historyId=report.id; category='全部'; $('#search').value=''; renderReport(); renderState(); showView('discover'); window.scrollTo({top:0,behavior:'smooth'}); }
  catch(e){ $('#status').textContent=e.message; showView('discover'); }
});
$('#settings-form').addEventListener('submit', async e => {
  e.preventDefault(); try { await api('/api/settings',{method:'POST',body:JSON.stringify({interests:$('#interests').value.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean),weeklyEnabled:$('#weekly-enabled').checked})}); $('#save-status').textContent='已保存，下次扫描生效。'; await refresh(); } catch(e){$('#save-status').textContent=e.message;}
});
$('#export-button').addEventListener('click', () => {
  if(!report)return;
  const md = `# 拾星 · ${periods[report.period]}\n\n扫描时间：${new Date(report.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}（北京时间）\n来源：${report.source}\n\n${report.methodology}\n\n`+report.repos.map(r=>`## ${r.name}\n\n${r.url}\n\n${r.description}\n\n${r.category} · 发现指数 ${r.score} · Star ${r.stars} · 本周期新增 ${r.gained}\n\n${r.reasons.map(x=>`- ${x}`).join('\n')}\n${r.cautions.map(x=>`- 注意：${x}`).join('\n')}\n`).join('\n');
  const freshness=`榜单数据时间：${report.dataFetchedAt||report.createdAt}\n${report.stale?'注意：网络不可用，本文件使用上次成功抓取的旧数据，并非最新榜单。':'本次已成功抓取榜单。'}\n\n`;
  const url=URL.createObjectURL(new Blob([freshness,md],{type:'text/markdown;charset=utf-8'})); const a=document.createElement('a'); a.href=url; a.download=`github-radar-${report.id}.md`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
try { await refresh(true); } catch(e) { $('#status').textContent=`无法连接本地服务：${e.message}`; }
setInterval(()=>refresh().catch(e=>{ $('#status').textContent=`连接中断：${e.message}`; }),2500);
