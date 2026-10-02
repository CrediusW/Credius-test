# 闻风的奇妙天地

个人作品合集，沿用现有 Cloudflare Workers 与 GitHub 同步发布流程。

- `/`：米白与森林绿风格的个人主页。
- `/reader.html?book=silicon-world`：统一书房入口，保留三个原始电子书地址。
- `/joblens/`：简历与 JD 匹配、本地面试练习、PDF 文本解析、作品集草稿与报告导出。
- `/ai-voice-pet/`：小元的房间，支持触摸、文字聊天与浏览器语音；保留原有本地设置。
- 主页 AI 实验区收录 DeepSeek 的个人空间，书架新增《投资操作系统》；两个入口均打开原站，保留原有互动与阅读体验。

## 预览与检查

```sh
python3 -m http.server 8767 --bind 127.0.0.1
# 另一个终端（需已有 Playwright 与 Chrome）
node checks.cjs
```

检查脚本可通过 `NODE_PATH` 使用已安装的 Playwright，可通过 `CHROME_PATH` 指定 Chrome，`SITE_URL` 指定待测站点。它验证桌面/手机布局、书籍切换、简历匹配、面试、PDF 解析、资料备份与小元对话/触摸。

## 发布

推送 `main` 后由已有 Cloudflare GitHub 集成自动构建。此改动不新增 Cloudflare 服务、域名、密钥或 Wrangler 配置。`.assetsignore` 排除本地服务与测试源码。原始书籍页面及宠物本地服务保留。

JOBLENS 默认使用本地算法，小元默认使用预设回复。在线 AI 由使用者在设置中配置自己的 OpenAI 兼容服务；本站没有内置模型密钥，也未开通公共付费 AI 接口。在线模式会将相关文本发送到所配置服务。JOBLENS JSON 备份不导出 API Key。

原有 ECharts 5.4.3、PDF.js 3.11.174 从官方发布内容随站托管，保留库内版权声明；PDF 解析关闭动态求值。扫描件 PDF 不支持 OCR。
