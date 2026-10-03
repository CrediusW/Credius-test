# 闻风的奇妙天地

个人作品合集，沿用现有 Cloudflare Workers 与 GitHub 同步发布流程。

- `/`：米白与森林绿风格的个人主页。
- `/reader.html?book=silicon-world`：统一书房入口，保留三个原始电子书地址。
- `/joblens/`：简历与 JD 匹配、本地面试练习、PDF 文本解析、作品集草稿与报告导出。
- `/game-hall/`：基于本地游戏大厅 1.8.0 的主站适配版 1.8.1，保留 14 款游戏资源、仓鼠与存档，12 款单机可用；飞行棋和四国军棋依赖原 Node WebSocket 服务，当前静态主站未托管该服务。原本地大厅不受此副本影响。
- `/ai-voice-pet/`：小元的房间，支持触摸、文字聊天与浏览器语音；保留原有本地设置。
- 主页 AI 实验区收录 DeepSeek 的个人空间，书架新增《投资操作系统》；两个入口均打开原站，保留原有互动与阅读体验。

## 预览与检查

```sh
python3 -m http.server 8767 --bind 127.0.0.1
# 另一个终端（需已有 Playwright 与 Chrome）
node checks.cjs
SITE_URL=http://127.0.0.1:8767 node game-hall-checks.cjs
```

检查脚本可通过 `NODE_PATH` 使用已安装的 Playwright，可通过 `CHROME_PATH` 指定 Chrome，`SITE_URL` 指定待测站点。它验证桌面/手机布局、书籍切换、简历匹配、面试、PDF 解析、资料备份与小元对话/触摸。

## 发布

推送 `main` 后由已有 Cloudflare GitHub 集成自动构建。此改动不新增 Cloudflare 服务、域名、密钥或 Wrangler 配置。`.assetsignore` 排除本地服务与测试源码。原始书籍页面及宠物本地服务保留。

JOBLENS 默认使用本地算法，小元默认使用预设回复。在线 AI 由使用者在设置中配置自己的 OpenAI 兼容服务；本站没有内置模型密钥，也未开通公共付费 AI 接口。在线模式会将相关文本发送到所配置服务。JOBLENS JSON 备份不导出 API Key。

原有 ECharts 5.4.3、PDF.js 3.11.174 从官方发布内容随站托管，保留库内版权声明；PDF 解析关闭动态求值。扫描件 PDF 不支持 OCR。


## 个人空间与图片工坊

当前 Worker 使用 D1 `wenfeng-spaces` 保存账号、会话和个人数据。首页、书架与游戏大厅公开，JobLens 与小元需登录。管理账号可创建、停用、启用和重置体验账号。初始密码不进入仓库。

图片工坊 `/images.html` 支持 JPEG/PNG/WebP，单文件最多 5 MB、2000 万像素；每账号最多 100 张、100 MB，全站源图最多 512 MB。缩放尺寸为 320/800/1600，支持等比缩放和方形裁剪，输出 WebP/JPEG/PNG。原图存于私有 R2，Images 进行转换；缓存读取前仍验证登录和所有权。每账号每月最多 300 次未命中缓存的转换，全站最多 1000 次。

**图片服务待账户启用 R2。** 启用后创建 `wenfeng-images`，在 `wrangler.json` 加入 `r2_buckets: [{"binding":"MEDIA","bucket_name":"wenfeng-images"}]`，再通过 GitHub 自动构建发布。当前缺少 `MEDIA` 绑定时，图片页会明确提示尚未连接，不影响账号空间。

在线 GPT 待站长配置 Secret `OPENAI_API_KEY` 和变量 `OPENAI_MODEL`。默认没有模型调用费用，本地简历分析和小元离线陪伴可使用。模型请求通过统一后端，客户端不能覆盖模型；每账号每日 20 次，全站每日 100 次。

验证后端：`node account-checks.mjs`（Node 24）。`checks.cjs` 是历史静态版浏览器检查；其中工具检查需适配登录后才能用于本版本。数据库初始化用 `schema.sql`，既有数据库可重复执行建表语句；私密账号 seed 文件不随项目分发。
