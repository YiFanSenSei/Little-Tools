# 桌面助手 · 0.6.1

Windows 截图收纳＋互动桌宠。沿用 Win+Shift+S，截图后自动保存原图；支持预览、复制、多选导出、收藏、搜索和回收站。桌宠支持摸摸、喂食、玩耍、睡觉、叫醒、拖动及位置记忆；默认使用有完整动作的鲸鱼娘，可切换狐狸、黄鸭、螃蟹或上传自己的形象。

单击摸摸，双击打开助手；悬停仅显示快捷按钮，不触发互动或声音。睡觉期间继续收集截图。

## 首次使用

需要 Windows 10/11、Git、Node.js 22.21 或更新版本，以及首次安装所需的网络。先从托盘退出此前运行的旧版助手。

进入本目录双击 **启动.cmd**。首次会下载固定版本的原版基础文件、经典头像和 npm 依赖，再构建并启动。下载过程中请保留命令窗口；启动完成后命令窗口退出，程序独立运行。后续可双击生成的「桌面助手.lnk」。

也可以从仓库根目录运行：

```sh
npm run tool -- desktop-assistant setup
npm run tool -- desktop-assistant start
```

开发与检查：

```sh
npm run dev
npm test
npm run build
npm run check:interaction
npm run privacy:check
```

创建桌面快捷方式：在本目录 PowerShell 运行 `./scripts/start.ps1 -CreateShortcutOnly -UpdateDesktopShortcut`。若桌面已有其他目录的同名助手快捷方式，脚本会保留它，不擅自覆盖。完整退出使用桌宠右键或托盘「退出」。

## 为什么使用组装脚本

本项目基于 [wonderSiesta/desktop-assistant](https://github.com/wonderSiesta/desktop-assistant) 修改，使用固定提交 `5979fdeef6098b1a4e6bd19119443a3fc3480ccd`。该上游未声明许可证，所以这里提供新增源码和修改补丁，不直接收录其完整基础程序，也不提供包含它的下载包。

经典鲸鱼娘图片未授予再分发权限，因此仅在首次本地组装时从原仓库获取并核验摘要。动态鲸鱼娘及小动物动画已内置，保留来源和相应许可；鲸鱼娘素材仅用于个人非商业用途。详见 [授权范围](LICENSE.md) 和 [素材声明](overlay/THIRD-PARTY-NOTICES.md)。组装并不改变上游代码和素材的授权范围，公开分发完整应用前仍需核实相关许可。

## 文件与隔离

- `overlay/`：新增源码、测试、动作素材和应用依赖锁文件。
- `patches/`：针对固定上游提交的增量补丁。
- `.runtime/`：首次运行后生成的基础源码、依赖及构建文件，全部忽略提交；不要在此手工修改程序。`npm run pack` 的免安装目录也在其中，仅供本机使用。
- `upstream.json`、`binary-assets.json`：上游版本与素材校验信息。

截图、宠物设置和上传形象默认保存到系统应用数据目录的 `LittleTools/DesktopCapture`，不在仓库内。也可显式设置 `CAPTURE_DATA_DIR`。应用不上传截图，文字历史默认关闭。启动前或暂停期间的旧剪贴板图片不会自动补入；快速覆盖掉的剪贴板内容无法恢复。容量上限 2 GB，包含回收站。

与拾星独立：开发端口 **3220**，应用标识、数据目录、依赖和退出流程单独维护。根目录 `npm start` 仍启动拾星。

当前已验证截图存储、悬停不误触、单击/双击/拖动区分、五种形象切换和真实动画播放。功能细节见 [改动说明](overlay/LOCAL-CHANGES.md)。
