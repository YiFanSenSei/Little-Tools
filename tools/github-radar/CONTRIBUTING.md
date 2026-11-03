# 参与贡献

需要 Node.js 22.21+，无第三方运行依赖。建议使用 Node.js 24。

```sh
npm test
npm run privacy:check
```

- 测试使用合成 HTML 和模拟 API，不依赖实时 GitHub 数据、不需要 token。
- 修复抓取器时请添加去除个人信息后的最小 HTML fixture，不要提交真实扫描历史。
- 提交 UI 改动前检查桌面与手机宽度、加载/错误/空状态。
- 新增可发布文件时更新 `release-files.json`，默认不自动打包新增文件。
- 不要提交 `.env`、token、日志、绝对本机路径、扫描记录或未经检查的截图。
- PR 描述写清用途、验证方式和限制。提交的贡献使用本项目 MIT 许可证。

CI 配置覆盖 Windows、macOS 和 Linux。Windows 计划任务安装脚本需要在 Windows 上手动验证。
