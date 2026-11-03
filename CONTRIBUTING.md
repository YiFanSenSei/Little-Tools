# 贡献约定

新增工具请先阅读 [工具隔离约定](docs/STRUCTURE.md)。每个工具独立配置、独立测试，不改动其他工具的运行数据和任务。

提交前运行工具测试和根目录 `npm run privacy:check`。根目录新增文件需加入 `repository-files.json`，工具文件需加入相应工具的 `release-files.json`。

不要提交个人配置、代理地址、密钥、真实报告、日志或未检查的截图。PR 中说明改动用途与验证方式，贡献使用 MIT 许可证。
