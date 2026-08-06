# 深海小元 · 电子宠物企鹅

一只长期生活在桌面上的赛博企鹅电子宠物：能语音聊天、会表达情绪、可以摸头戳肚子互动、还会毒舌吐槽和陪你练外语。

## ✨ 功能

- **语音对话**：语音识别 + DeepSeek API 聊天 + Edge 甜美语音合成（晓晓/晓伊等 8 种音色）
- **五大人格系统**：日常小元 / 毒舌损友 / 温柔陪伴 / 学霸百科 / 语言搭子（中英法西）
  - 共享智能底座，人格只改表达风格，不限制知识/深度/工具能力
  - 回答由浅入深：默认简短，你要求深入才展开（支持深度模式）
- **分层企鹅渲染**：20 张 PNG 素材按固定 500×620 舞台分层拼装，Canvas 自动裁剪透明边
- **触摸互动**：摸头（blush+跳跃）、戳肚子（连续戳→紧张）、点击眼镜（翻起）、拖动（伪 3D 转动）、逗逗（6 种喜剧动作）
- **情绪与动画**：开心/委屈/害羞/紧张/睡觉，45s/90s 无操作自动困倦休眠，点击唤醒
- **实时工具路由**：识别天气/时间/股价/新闻/体育意图（未配置 API 时如实说明，不编造）
- **部署就绪**：单端口一体化服务（静态页 + TTS + 布局读写），一条内网穿透命令即可公网访问

## 🚀 快速开始

环境要求：Python 3.13+，建议虚拟环境安装 `edge-tts`

```bash
pip install edge-tts

# 启动一体化服务（网页 + 语音合成 + 布局读写，单端口 8765）
python combine_server.py 8765
```

浏览器打开 <http://127.0.0.1:8765/>

> 语音识别需 Chrome/Edge 浏览器，并通过 localhost 或 HTTPS 访问（麦克风权限要求安全上下文）。

### 配置 AI 对话

1. 打开页面 → 右上角 ⚙ 设置
2. 对话模式切到「在线 AI」，填入 DeepSeek API Key（OpenAI 兼容格式）
3. 选择人格（日常小元 / 毒舌损友 / 温柔陪伴 / 学霸百科 / 语言搭子）
4. 保存设置，开始聊天

## 📂 文件结构

```
├── index.html              # 主页面（界面/交互/人格系统/聊天逻辑）
├── personaPrompts.js       # 五个人格提示词（切换人格只换这段）
├── combine_server.py       # 一体化服务：静态页 + Edge TTS + 布局读写
├── penguin-calibrator.html # 企鹅布局校准工具（/calibrator）
├── assets/penguin/         # 20 张分层素材 + penguin-layout.json（固定布局）
└── tts_server.py           # 旧版独立 TTS 服务（已被 combine_server 取代）
```

## 🌐 让朋友在线访问

- **临时分享**：`cloudflared tunnel --url http://127.0.0.1:8765` → 得到一个 https 地址发给朋友
- **长期部署**：前端放 Cloudflare Pages，`combine_server.py` 部署到 Railway/Render 等 Python 托管
- 手机访问必须 HTTPS，否则麦克风不可用

## 📄 配置说明

| 配置 | 说明 |
|---|---|
| max_tokens | 最大回复长度（默认 2000，深度模式自动 ≥3000） |
| 城市 | 实时天气默认城市 |
| 语言设置 | 语言搭子人格的 targetLanguage / userLevel / correctionLevel |
| 实时数据 API | 当前未接入，工具路由会如实提示"无法获取实时数据" |

## ⚠️ 注意

- DeepSeek API Key 保存在浏览器 localStorage，不会上传到仓库
- 日志文件、临时文件已通过 .gitignore 排除
