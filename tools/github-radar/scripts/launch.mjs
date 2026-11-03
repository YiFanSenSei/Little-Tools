import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
try { loadEnvFile('.env'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const port = Number(process.env.PORT || 3210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const url = `http://127.0.0.1:${port}`;
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
let runningVersion;
const ready = async () => {
  try { const response = await fetch(`${url}/api/state`, {signal:AbortSignal.timeout(500)}); const state = await response.json();runningVersion=state.version;return response.ok && Array.isArray(state.history) && typeof state.token === 'string'; }
  catch { return false; }
};
function openBrowser() {
  // execFile-style argument array avoids evaluating paths or config as shell code.
  const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {detached:true, stdio:'ignore', windowsHide:true});
  child.on('error', () => console.log(`Open ${url} in your browser.`)); child.unref();
}
if (await ready()) {
  if(runningVersion!==version){console.error('An older GitHub Radar server is still running. Close its console or stop that app, then launch again. Your data is preserved.');process.exitCode=1;}
  else {console.log(`GitHub Radar ${version} is already running: ${url}`);openBrowser();}
}
else {
  const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'server.mjs'], {cwd:root, stdio:'inherit'});
  let started = false;
  for (let i = 0; i < 30 && child.exitCode === null; i++) {
    if (await ready()) { started = true; openBrowser(); break; }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if (!started) console.error(`Could not open the app automatically. Check the server output above: ${url}`);
  // Keep the server attached to this console so Ctrl+C closes only this app.
  process.on('SIGINT',()=>child.kill('SIGINT'));
  child.on('exit',code=>{process.exitCode=code || 0;});
}
