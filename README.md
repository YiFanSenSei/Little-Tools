# Little Tools

独立、实用的小工具集合。每个工具单独运行、单独配置，不共享运行数据和依赖。

## 工具目录

| 工具 | 功能 | 环境 | 默认端口 |
| --- | --- | --- | --- |
| [拾星 · GitHub Radar](tools/github-radar/README.md) | GitHub Trending 发现、兴趣筛选、每周扫描 | Node.js 22.21+；系统任务助手支持 Windows | 3210 |
| [桌面助手](tools/desktop-assistant/README.md) | 截图连续收纳、透明动画桌宠、互动及形象切换 | Windows 10/11、Git、Node.js 22.21+；首次启动自动组装 | 3220（仅开发模式） |

## 快速开始

```sh
git clone https://github.com/YiFanSenSei/Little-Tools.git
cd Little-Tools
npm start
```

打开 <http://127.0.0.1:3210>。拾星不需要 `npm install`。

桌面助手：进入 `tools/desktop-assistant` 双击 `启动.cmd`，首次安装会获取固定版本的基础程序和依赖。它独立运行，不影响拾星。功能、素材来源及组装方式见 [桌面助手说明](tools/desktop-assistant/README.md)。

Windows 也可以进入 `tools/github-radar`，双击 `启动.cmd`。安装每周扫描请在该工具目录双击 `安装每周任务.cmd`。初次使用需要网络，Windows 会自动使用当前用户已启用的系统 HTTP 代理。

其他命令：

```sh
npm run list
npm run tool -- github-radar doctor
npm run tool -- github-radar scan
npm test
npm run privacy:check
```

也可以直接进入某个工具目录，按该工具 README 操作；根目录没有 `.env`、共享 `data/` 或统一依赖安装流程。

## 仓库结构

```text
tools/
  github-radar/
    package.json      独立依赖和启动命令
    .env.example      空密钥配置示例
    lib/ web/ test/   源码与测试
    data/             本机运行数据，不提交
    release/          本机发布产物，不提交
tools.json            工具注册表，含目录和默认端口
scripts/              仓库导航和隐私检查
docs/STRUCTURE.md     新增工具约定
.github/workflows/    按工具命名的 CI
```

## 新增工具

使用 `tools/<英文短名>/`，独立维护配置、数据、依赖和测试。注册到 `tools.json`，分配未使用的默认端口，并更新首页目录。具体见 [结构约定](docs/STRUCTURE.md)。不需要为了添加小工具改动其他工具。

本仓库不保存 token、代理地址、个人偏好、运行日志或实际使用截图。上传前执行隐私检查并人工复核 Git 提交身份；详见 [安全说明](SECURITY.md)。自有代码采用 [MIT 许可证](LICENSE)；第三方代码及素材保留各自授权范围，桌面助手的例外见 [授权说明](tools/desktop-assistant/LICENSE.md)。
