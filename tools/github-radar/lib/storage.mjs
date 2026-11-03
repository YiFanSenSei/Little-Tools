import { mkdir, readFile, writeFile, rename, open, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
// fileURLToPath also handles non-ASCII workspace paths on Windows.
import { fileURLToPath } from 'node:url';
export const dataDir = process.env.RADAR_DATA_DIR ? path.resolve(process.env.RADAR_DATA_DIR) : fileURLToPath(new URL('../data/', import.meta.url));
export async function read(name, fallback = null) { try { return JSON.parse(await readFile(path.join(dataDir, name), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; } }
export async function write(name, value) {
  await mkdir(dataDir, { recursive: true });
  const target = path.join(dataDir, name), tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await rename(tmp, target);
}
export async function isScanning() {
  try {
    const pid = Number(await readFile(path.join(dataDir, 'scan.lock'), 'utf8'));
    if (!pid) return Date.now() - (await stat(path.join(dataDir, 'scan.lock'))).mtimeMs < 60000;
    process.kill(pid, 0); return true;
  } catch (e) { if (e.code === 'ENOENT' || e.code === 'ESRCH') return false; if (e.code === 'EPERM') return true; throw e; }
}
export async function lock() {
  await mkdir(dataDir, { recursive: true });
  const name = path.join(dataDir, 'scan.lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try { const handle = await open(name, 'wx'); await handle.writeFile(String(process.pid)); await handle.close(); return async () => { await unlink(name).catch(() => {}); }; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const pid = Number(await readFile(name, 'utf8'));
        if (pid > 0) { try { process.kill(pid, 0); throw new Error('另一个扫描任务正在运行，请稍后再试。'); } catch (err) { if (err.code !== 'ESRCH') throw err; } }
        else if (Date.now() - (await stat(name)).mtimeMs < 60000) throw new Error('扫描任务正在启动，请稍后再试。');
        await unlink(name);
      } catch (err) { if (err.code !== 'ENOENT') throw err; }
    }
  }
  throw new Error('无法取得扫描锁。');
}
