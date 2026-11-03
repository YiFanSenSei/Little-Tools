const groups = [
  ['AI 与智能体', /\b(ai|llm|agent|gpt|inference|model|rag|diffusion|machine.learning)\b|人工智能|大模型/i, '适合探索智能助手、模型应用和自动化工作流。'],
  ['开发者工具', /\b(developer|development|cli|terminal|editor|debug|code|framework|sdk|compiler|programming|devtool)\b/i, '适合检查能否减少开发、调试或工程配置的重复工作。'],
  ['效率与生活', /\b(productivity|notes?|knowledge|calendar|workflow|tasks?|automation|bookmark|personal|desktop|app)\b/i, '适合寻找能用于日常工作和个人信息管理的工具。'],
  ['数据与基础设施', /\b(database|data|sql|analytics|server|cloud|docker|kubernetes|storage|monitor|network|infra)\b/i, '适合数据处理、服务部署和基础设施选型。'],
  ['创意与探索', /\b(game|art|audio|music|video|image|design|creative|3d|render|visual)\b/i, '适合创作、互动体验和尝试新的表达方式。'],
  ['学习与资料', /\b(awesome|learn|tutorial|course|book|collection|resources|guide|education)\b/i, '适合收藏资料、系统学习和寻找实践案例。']
];
function interestMatches(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = /^[a-z0-9]/i.test(word) ? '(?<![a-z0-9])' : '';
  const end = /[a-z0-9]$/i.test(word) ? '(?![a-z0-9])' : '';
  return new RegExp(start + escaped + end, 'i').test(text);
}
export function analyze(repo, interests = []) {
  const text = `${repo.name} ${repo.description} ${(repo.topics || []).join(' ')}`;
  const matches = groups.filter(([, re]) => re.test(text));
  const [category, , useCase] = matches[0] || ['其他发现', null, '适合打开仓库说明，进一步确认用途与使用门槛。'];
  const matchedInterests = interests.filter(word => interestMatches(text, word));
  const momentum = Math.min(25, Math.round(Math.log10(repo.gained + 1) * 7));
  const traction = Math.min(20, Math.round(Math.log10(repo.stars + 1) * 4));
  const growth = Math.min(15, Math.round(repo.gained / Math.max(repo.stars, 1) * 50));
  const relevance = Math.min(20, matchedInterests.length * 10);
  const score = Math.max(0, Math.min(100, 20 + momentum + traction + growth + relevance - (repo.archived ? 30 : 0)));
  const reasons = [`榜单第 ${repo.rank} 名，本周期新增 ${repo.gained.toLocaleString('zh-CN')} Star。`];
  if (matchedInterests.length) reasons.push(`匹配你的兴趣：${matchedInterests.join('、')}。`);
  if (repo.gained / Math.max(repo.stars, 1) >= .1) reasons.push('本周期新增 Star 占比较高，值得留意这一波关注。');
  reasons.push(useCase);
  const cautions = [];
  if(repo.metadataCachedAt)cautions.push(`仓库详情来自缓存（${new Date(repo.metadataCachedAt).toISOString()}），不代表刚刚重新验证。`);
  if (!repo.enriched) cautions.push('未取得仓库详情；活跃度和许可证需自行核实。');
  else { if (repo.archived) cautions.push('仓库已归档，使用前确认维护状态。'); if (repo.license === '未标注' || repo.license === 'NOASSERTION') cautions.push('许可证不明确，使用前查看仓库授权。'); }
  return { ...repo, category, tags: matches.map(x => x[0]), useCase, matchedInterests, score, reasons, cautions };
}
