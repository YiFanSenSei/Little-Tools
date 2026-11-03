import http from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { read, write, dataDir, isScanning } from './lib/storage.mjs';
import { scan, defaults } from './lib/scanner.mjs';
import { nextWeekly, lastWeekly } from './lib/schedule.mjs';

async function logError(error) { await mkdir(dataDir, { recursive: true }); await appendFile(`${dataDir}/errors.log`, `${new Date().toISOString()} ${error.stack || error}\n`).catch(() => {}); }
const {version}=JSON.parse(await readFile(new URL('./package.json',import.meta.url),'utf8'));
if (process.argv.includes('--scan')) {
  const settings = await read('settings.json', defaults);
  if (!settings.weeklyEnabled && !process.argv.includes('--force')) { console.log('每周扫描已暂停。'); }
  else { try { const report = await scan('weekly', 'scheduled', console.log); console.log(report.stale?`网络不可用，已保留 ${report.repos.length} 个缓存项目，数据时间 ${report.dataFetchedAt}`:`扫描完成：${report.repos.length} 个项目，报告 ${report.id}`);if(report.stale)process.exitCode=2; } catch (e) { await logError(e); console.error(e.message); process.exitCode = 1; } }
} else {
  const port = Number(process.env.PORT || 3210);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const token = randomBytes(24).toString('hex');
  let job = { running: false, message: '', error: null };
  let lastAutoAttempt = 0;
  async function launch(period, trigger) {
    if (job.running) throw new Error('扫描正在进行中');
    job = { running: true, message: '正在准备扫描…', error: null };
    try { const report = await scan(period, trigger, message => { job.message = message; }); job = { running: false, message: report.stale?'网络暂不可用，已展示上次成功数据；未标记为本周扫描成功。':'扫描完成', error: null, reportId: report.id }; }
    catch (e) { job = { running: false, message: '扫描失败，已保留上次结果', error: e.message }; await logError(e); }
  }
  async function scheduledTick() {
    try {
      const settings = await read('settings.json', defaults);
      const state = await read('schedule-state.json', {});
      if (settings.weeklyEnabled && !job.running && !(await isScanning()) && Date.now() - lastAutoAttempt > 3600_000 && (!state.lastSuccess || state.lastSuccess < lastWeekly())) {
        lastAutoAttempt = Date.now(); await launch('weekly', 'scheduled');
      }
    } catch (e) { await logError(e); }
  }
  const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
  async function body(req) {
    let value = ''; for await (const chunk of req) { value += chunk; if (value.length > 8192) throw new Error('请求内容过大'); }
    return value ? JSON.parse(value) : {};
  }
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    try {
      if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return send(403, { error: '不允许的 Host' });
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (req.method === 'POST' && req.headers['x-radar-token'] !== token) return send(403, { error: '请从本地应用页面操作' });
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const [settings, latest, history, task] = await Promise.all([read('settings.json', defaults), read('latest.json'), read('history.json', []), read('windows-task.json')]);
        const degraded=await read('degraded.json');
        const displayed=degraded&&(!latest||degraded.createdAt>latest.createdAt)?degraded:latest;
        const external = !job.running && await isScanning();
        return send(200, { app:'github-radar',version,token, settings, latest:displayed, history, job: external ? { running: true, message: '系统任务正在扫描，结果完成后会自动显示。', error: null } : job, nextRun: settings.weeklyEnabled ? nextWeekly() : null, task });
      }
      if (req.method === 'GET' && url.pathname === '/api/report') {
        const id = url.searchParams.get('id'); if (!/^\d+-\d+$/.test(id || '')) return send(400, { error: '报告编号无效' });
        const report = await read(`report-${id}.json`); return send(report ? 200 : 404, report || { error: '未找到报告' });
      }
      if (req.method === 'POST' && url.pathname === '/api/scan') {
        const { period = 'weekly' } = await body(req);
        if (!['daily', 'weekly', 'monthly'].includes(period)) return send(400, { error: '无效周期' });
        if (job.running || await isScanning()) return send(409, { error: '已有扫描正在进行' });
        void launch(period, 'manual'); return send(202, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/settings') {
        const input = await body(req);
        if (!Array.isArray(input.interests) || input.interests.length > 15 || input.interests.some(x => typeof x !== 'string' || x.length > 40) || typeof input.weeklyEnabled !== 'boolean') return send(400, { error: '最多 15 个兴趣词，每个不超过 40 字' });
        const settings = { interests: [...new Set(input.interests.map(x => x.trim()).filter(Boolean))], weeklyEnabled: input.weeklyEnabled };
        await write('settings.json', settings); return send(200, settings);
      }
      if (req.method === 'GET' && assets[url.pathname]) {
        const [name, type] = assets[url.pathname];
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'" });
        return res.end(await readFile(fileURLToPath(new URL(`./web/${name}`, import.meta.url))));
      }
      send(404, { error: '未找到内容' });
    } catch (e) { send(500, { error: e.message }); }
  });
  server.listen(port, '127.0.0.1', () => { console.log(`GitHub Radar 已启动：http://127.0.0.1:${port}`); void scheduledTick(); });
  server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `端口 ${port} 已被占用。请打开现有应用，或设置 PORT 使用其他端口。` : e.message); process.exitCode = 1; });
  const timer = setInterval(scheduledTick, 60000); timer.unref();
}
