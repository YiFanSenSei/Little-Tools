# 拾星 · GitHub Radar

一个本地 GitHub Trending 发现工具。手动点击扫描，或每周一北京时间 09:00 自动扫描周榜，留下可以回看的项目清单。

**本地运行 · 无第三方运行依赖 · 无需 API Key · MIT 许可**

## 开始使用

需要 [Node.js](https://nodejs.org/) **22.21 或更新版本**，建议 Node.js 24。下载本仓库 ZIP 并解压，或使用 Git 克隆仓库，在项目根目录执行 `npm start`。无需执行 `npm install`，首次运行自动创建数据目录。

Windows、macOS、Linux 都可以用 `npm start` 运行网页和后台定时检查；双击启动和计划任务安装助手仅适用于 Windows。

1. 双击 **启动.cmd**，浏览器会打开 <http://127.0.0.1:3210>。
2. 点击「立即扫描」，可选日榜、周榜、月榜。第一次启动会自动检查并补跑本周扫描。
3. 在「偏好与计划」填写兴趣关键词，例如 `AI, CLI, productivity, self-hosted`。
4. 双击 **安装每周任务.cmd**，注册当前 Windows 用户的计划任务。网页关闭后，仍能每周执行扫描。

Windows 启动脚本等待服务就绪后打开浏览器，并读取可选 `.env` 端口配置；同端口的现有应用会被复用。关闭网页不会停止服务；按 Ctrl+C 或关闭该应用的控制台可停止服务。不要结束其他项目的 Node 进程。

也可以在 PowerShell 中运行：

```powershell
# 在克隆或解压后的项目根目录执行
npm start
# 单独运行一次周榜扫描，不启动网页服务（遵守每周扫描开关）
npm run scan
# 即使每周扫描暂停也强制扫描
npm run scan -- --force
# 测试
npm test
```

## 已实现

- 抓取 GitHub 官方 Trending，读取排名、描述、语言、累计 Star 和周期新增 Star。
- 最多补充榜单前 12 个仓库的 GitHub API 信息：主题、许可证、最近提交、归档状态。
- 规则分类：AI 与智能体、开发者工具、效率与生活、数据与基础设施、创意与探索、学习与资料。
- 推荐理由、兴趣匹配、分类与搜索、按推荐分/新增 Star/榜单排名排序。
- 本地历史报告，回看和导出 Markdown；网页最多列出最近 100 次，旧报告文件继续保留。
- 扫描进度、错误提示、API 限流降级；失败不覆盖上次成功报告。
- 进程间扫描锁，避免网页和系统任务同时扫描；程序中断留下的锁会在下次自动检查回收。

## 每周自动运行

任务安装脚本将注册 `GitHubRadar-Weekly-<目录哈希>`，使用当前用户权限，无需管理员权限。它在 **每周一 09:00 北京时间** 执行 `node server.mjs --scan`，不需要开着网页服务。安装后可在 Windows「任务计划程序」查看状态；网页显示的是安装记录。

- 电脑必须开机、有网络，并且该 Windows 用户已登录。关机期间不能执行。
- 启用 `StartWhenAvailable`：错过的计划在系统可用且用户登录后补跑；失败每隔 15 分钟重试，最多 2 次。
- 应用运行期间每分钟检查；本周尚无自动扫描成功记录时补跑。网络失败后最多每小时重试一次。
- 在网页暂停每周扫描后，系统任务会读到设置并跳过扫描；手动按钮仍然可用。
- 安装脚本要求 Windows 系统时区为 `China Standard Time`，避免每周任务时间偏移。之后改变系统时区会影响 Windows 任务触发时间，须重新配置。
- 当前实现保留最近一次成功自动扫描时间；人工扫描不改变每周自动任务的完成记录。

卸载计划任务：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\remove-task.ps1
```

移动项目目录后，先从原目录卸载任务，再在新目录重新安装。项目目录应由自己控制，不要让不可信用户改写将被任务执行的脚本。

macOS/Linux 暂无系统调度安装助手。应用运行时支持同样的每周检查，服务停止后不再运行；也可自行设置 cron，工作目录设为项目根目录，执行 `npm run scan`。

## 评分说明与限制

评分 = 20 基础分 + 新增热度（最高 25）+ 累计关注（最高 20）+ 增长比例（最高 15）+ 兴趣匹配（最高 20）；已归档项目减 30 分，最终限制在 0–100。具体公式见 `lib/analyze.mjs`。分类顺序固定，多类别命中时显示第一个类别。英文关键词通常比中文更容易匹配英文仓库描述。

**这是可解释的规则筛选，不是大模型评审，也没有实际试用或审计仓库。** 推荐理由只引用公开元数据与推断用途；发现指数不代表质量、安全性或适合所有人。原始描述保留原文。

Trending 没有在本项目中使用官方 REST 榜单端点，而是解析 GitHub 的公开 HTML 页面。页面改版或网络拦截可能导致抓取失败，届时页面会提示错误并保留历史数据。周期新增 Star 直接取自页面，不自行声称是精确的日历周期统计。

无认证的 GitHub API 可能限流，详情获取失败不影响 Trending 主列表。可选通过环境变量 `GITHUB_TOKEN` 提供只读公开仓库访问用的 token；不要把 token 写入源码。程序不会把 token 返回给网页。支持 `HTTPS_PROXY` 等 Node 系统代理变量时，可使用 Node 的 `NODE_USE_ENV_PROXY=1`；有网络访问问题先确认浏览器和 Node 都能连接 GitHub。

### 网络恢复与诊断（1.0.2）

Windows 自动读取当前用户已启用的系统 HTTP/HTTPS 代理；手动扫描和每周任务使用同一逻辑，无需把本机代理地址写入源码。显式配置的 `RADAR_PROXY` / `HTTPS_PROXY` / `HTTP_PROXY` 优先。支持 HTTP/HTTPS 代理，不支持 SOCKS-only 端口和 PAC 自动配置脚本。PAC 用户需要显式填写 HTTP 代理；没有代理则使用直连。TLS 证书验证保持开启，不会自动绕过证书错误，也不会因代理出错而偷偷改成直连。

```sh
npm run doctor
```

诊断显示所用路由类别和两个 GitHub 域名的连接结果，不打印代理地址或 token。榜单请求最多重试 3 次，带超时和指数退避；错误区分 DNS、连接超时、连接拒绝和限流，不再只显示 `fetch failed`。

榜单不可用时按日/周/月分别回退到上次成功数据，并明确显示旧数据时间；不覆盖最新成功报告、不写入成功历史、不更新每周成功记录。网络恢复后自动任务按原计划重试，Windows 任务收到非零退出码可继续重试。首次使用且没有对应周期缓存时仍需要网络，无法离线生成真实榜单。

仓库详情缓存 24 小时，最多保留 250 个项目；详情网络故障时停止继续消耗请求，榜单主列表仍可用。详情从缓存取得时会显示缓存时间。升级后需重启旧服务，新启动器会检测旧版本，避免继续打开未更新的后台服务。

## 数据与部署

运行时数据在 `data/`（已加入 `.gitignore`）：`settings.json`、`latest.json`、`history.json`、`report-*.json`、`schedule-state.json`、`windows-task.json`、`errors.log`。写入采用临时文件后替换；扫描失败不更新最新报告。配置或历史文件损坏会报错，不会静默重置。无自动清理策略，可自行备份和清理旧报告。

服务只监听 `127.0.0.1`，校验 Host，修改请求使用随机会话 token，并将仓库文本转义后显示。它为个人本地使用设计，请不要直接映射到公网。

可用环境变量：`PORT`（默认 3210）、`RADAR_DATA_DIR`（默认项目 data）、`GITHUB_TOKEN`（可选）。把 `.env.example` 复制为 `.env` 即可配置；不复制也能运行。终端环境变量优先于 `.env`。`npm start`、`npm run scan` 和新安装的计划任务都会读取 `.env`，使用 Node 的 [`--env-file-if-exists`](https://nodejs.org/api/cli.html#--env-file-if-existsfile)。双击启动也会使用配置的端口。

旧版本已安装的计划任务需重新运行安装脚本，才会加载 `.env`。任务安装记录始终写入项目 `data/`；使用自定义 `RADAR_DATA_DIR` 时，网页可能显示未安装，以 Windows 任务计划程序为准。

没有遥测、统计服务或第三方 AI 调用；兴趣词只在本地匹配，不随请求发送给 GitHub。可选 token 仅发送给 GitHub API。完整边界见 [安全与隐私说明](SECURITY.md)。

## 开发与开源发布

```sh
npm test
npm run privacy:check
npm run release
```

发布工具按 `release-files.json` 白名单生成干净源码目录、源码 ZIP 和 SHA-256 校验文件，不带 Git 历史、个人报告、截图或配置。新文件默认不打包，需先人工审核并加入白名单。使用生成的 `release/…/github-radar/` 目录作为上传来源。它同时包含隐藏的 `.gitignore` 与 CI 文件。

不要直接压缩整个运行目录。隐私检查只识别常见模式，不能代替人工审核；`.gitignore` 不能删除已提交的敏感历史。Git 提交作者名、邮箱和仓库账号也可能公开，见 [发布指南](docs/RELEASING.md)。本工具不会上传文件或修改 Git 身份。

CI 已配置 Windows/macOS/Linux 与 Node.js 22.21、24 的测试和隐私检查，实际结果以 GitHub Actions 运行情况为准；Windows 任务安装脚本需手动验证。

当前优先可优化：新上榜/排名变化提醒、收藏与屏蔽、元数据缓存、可配置时间和时区、历史自动清理。具体见发布指南。

贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。采用 [MIT 许可证](LICENSE)，与 GitHub 官方无隶属关系。

## 目录

```text
server.mjs          本地 HTTP 服务、后台扫描、命令行入口
lib/trending.mjs    HTML 解析与 GitHub API 请求
lib/analyze.mjs     分类、评分与推荐理由
lib/scanner.mjs     扫描编排与报告持久化
lib/schedule.mjs    北京时间每周调度计算
lib/storage.mjs     原子写入与跨进程锁
web/               中文响应式界面，无外部字体或 CDN
scripts/           Windows 计划任务安装与卸载
test/              解析、调度边界与评分测试
```
