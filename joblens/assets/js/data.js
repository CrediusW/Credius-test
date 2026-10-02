/* ============================================================
 * JobLens 数据层：技能词典 / 本地面试题库 / 默认作品集 / 示例数据
 * 全部为纯数据，无逻辑依赖，可自由扩充
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';

  /* ---------- 技能词典 ----------
   * cat: 分类（决定雷达图维度与权重微调）
   * w:   基础权重 1.0~1.3（核心技能 > 周边技能）
   * aliases: 匹配别名。纯英文串按"整词"匹配（\b 边界），含中文按子串匹配
   */
  NS.SKILL_DICT = [
    // 语言
    { name: 'Python',   cat: '语言',     w: 1.2, aliases: ['python'] },
    { name: 'JavaScript', cat: '语言',   w: 1.2, aliases: ['javascript'] },
    { name: 'TypeScript', cat: '语言',   w: 1.1, aliases: ['typescript', 'ts'] },
    { name: 'Java',     cat: '语言',     w: 1.1, aliases: ['java'] },
    { name: 'Go',       cat: '语言',     w: 1.1, aliases: ['golang', 'go 语言'] },
    { name: 'C/C++',    cat: '语言',     w: 1.1, aliases: ['c++', 'cpp', 'c 语言'] },
    { name: 'SQL',      cat: '语言',     w: 1.1, aliases: ['sql', 'mysql', 'postgres', 'sqlite'] },
    { name: 'Shell',    cat: '语言',     w: 0.9, aliases: ['shell', 'bash'] },
    // AI / 机器学习
    { name: '大模型 (LLM)', cat: 'AI/ML', w: 1.3, aliases: ['llm', '大模型', '大语言模型', 'gpt', 'chatgpt', 'claude'] },
    { name: 'RAG 检索增强', cat: 'AI/ML', w: 1.3, aliases: ['rag', '检索增强', 'r.a.g'] },
    { name: 'Prompt 工程', cat: 'AI/ML', w: 1.2, aliases: ['prompt', '提示词', '提示工程'] },
    { name: '微调 (Fine-tuning)', cat: 'AI/ML', w: 1.2, aliases: ['fine-tuning', 'fine tuning', '微调', 'sft', 'lora'] },
    { name: 'Agent 智能体', cat: 'AI/ML', w: 1.2, aliases: ['agent', '智能体', 'mcp'] },
    { name: '向量数据库', cat: 'AI/ML',   w: 1.1, aliases: ['向量数据库', 'vector database', 'milvus', 'pinecone', 'faiss'] },
    { name: 'Embedding', cat: 'AI/ML',    w: 1.1, aliases: ['embedding', '向量化', '语义向量'] },
    { name: 'PyTorch',  cat: 'AI/ML',     w: 1.2, aliases: ['pytorch', 'torch'] },
    { name: 'TensorFlow', cat: 'AI/ML',   w: 1.0, aliases: ['tensorflow', 'keras'] },
    { name: 'Transformers', cat: 'AI/ML', w: 1.1, aliases: ['transformers', 'huggingface', 'hugging face'] },
    { name: '机器学习', cat: 'AI/ML',     w: 1.2, aliases: ['机器学习', 'machine learning', 'sklearn', 'scikit'] },
    { name: '深度学习', cat: 'AI/ML',     w: 1.2, aliases: ['深度学习', 'deep learning', '神经网络'] },
    { name: 'NLP',      cat: 'AI/ML',     w: 1.1, aliases: ['nlp', '自然语言处理'] },
    { name: '计算机视觉', cat: 'AI/ML',   w: 1.0, aliases: ['cv', '计算机视觉', '图像识别', 'ocr'] },
    { name: '多模态',   cat: 'AI/ML',     w: 1.0, aliases: ['多模态', 'multimodal'] },
    { name: '数据分析', cat: 'AI/ML',     w: 1.1, aliases: ['数据分析', 'data analysis', 'pandas', 'numpy'] },
    // 框架 / 前端
    { name: 'React',    cat: '框架/前端', w: 1.1, aliases: ['react', 'next.js', 'nextjs'] },
    { name: 'Vue',      cat: '框架/前端', w: 1.1, aliases: ['vue'] },
    { name: 'HTML/CSS', cat: '框架/前端', w: 0.9, aliases: ['html', 'css', '前端'] },
    { name: 'Node.js',  cat: '框架/前端', w: 1.1, aliases: ['node.js', 'nodejs', 'node'] },
    // 工程 / 工具
    { name: 'Git',      cat: '工程/工具', w: 1.0, aliases: ['git', 'github', 'gitlab'] },
    { name: 'Docker',   cat: '工程/工具', w: 1.1, aliases: ['docker', '容器'] },
    { name: 'Linux',    cat: '工程/工具', w: 1.0, aliases: ['linux', 'ubuntu', 'centos'] },
    { name: 'CI/CD',    cat: '工程/工具', w: 1.0, aliases: ['ci/cd', 'cicd', 'jenkins', 'actions'] },
    { name: '爬虫',     cat: '工程/工具', w: 1.0, aliases: ['爬虫', 'spider', 'scraper', 'scraping'] },
    { name: '自动化',   cat: '工程/工具', w: 1.0, aliases: ['自动化', 'automation'] },
    { name: 'REST API', cat: '工程/工具', w: 1.0, aliases: ['rest', 'restful', 'api 开发', '接口开发'] },
    { name: '测试',     cat: '工程/工具', w: 0.9, aliases: ['测试', 'test', 'pytest', 'unittest'] },
    // 领域 / 软技能
    { name: '金融/量化', cat: '领域知识', w: 1.0, aliases: ['金融', '量化', '证券', '股票', 'quant'] },
    { name: '产品思维', cat: '软技能',    w: 0.8, aliases: ['产品', '需求分析'] },
    { name: '沟通协作', cat: '软技能',    w: 0.7, aliases: ['沟通', '协作', '团队合作', '团队精神'] },
    { name: '英语',     cat: '软技能',    w: 0.7, aliases: ['英语', 'english'] },
    { name: '论文阅读', cat: '软技能',    w: 0.8, aliases: ['论文', 'paper', 'arxiv'] }
  ];

  // 雷达图维度（技能归类 → 图维度）
  NS.SKILL_CATS = ['语言', 'AI/ML', '框架/前端', '工程/工具', '领域知识', '软技能'];

  /* ---------- 本地面试题库 ----------
   * points: 评分参考要点（本地引擎按"要点关键词是否出现在回答中"打分）
   * ref:    参考答案（提交后展示，供学习）
   * followup: 低分时的追问
   */
  NS.QUESTION_BANK = {
    'ai应用': [
      {
        q: '请讲讲 RAG（检索增强生成）的基本原理，以及它解决了大模型的什么问题？',
        points: ['检索', '向量', '幻觉', '知识', '生成'],
        ref: 'RAG = 检索 + 生成：先把问题向量化，从外部知识库（向量数据库）检索相关片段，再把片段拼进 Prompt 让 LLM 生成答案。它解决：① 模型知识过时/私有知识缺失；② 幻觉——答案有据可查；③ 成本——不用重新训练模型。',
        followup: '如果检索回来的片段质量很差，RAG 效果就崩了。你有哪些改进检索质量的思路？'
      },
      {
        q: '什么是大模型的"幻觉"？你在实际项目中会用哪些手段降低幻觉？',
        points: ['幻觉', 'prompt', '检索', '约束', '校验', '温度'],
        ref: '幻觉 = 模型一本正经地编造事实。降低手段：① RAG 提供事实依据；② Prompt 约束（要求"仅根据给定资料回答，找不到就说不知道"）；③ 降低 temperature；④ 要求输出引用来源并做后校验；⑤ 结构化输出 + 规则校验。',
        followup: '如果要验证模型输出的 JSON 是否符合预期格式，你会怎么做？'
      },
      {
        q: '给你一个业务场景：客服每天有 5000 条对话记录，老板想知道客户最不满的 Top 3 问题。你会怎么设计方案？',
        points: ['清洗', '分类', '聚类', 'llm', 'prompt', '评估', '可视化'],
        ref: '方案：① 数据清洗与脱敏；② 用 LLM 做零样本/少样本分类打标签（或 embedding 聚类），Prompt 给出封闭标签集；③ 抽样人工校验评估准确率；④ 统计聚合 + 可视化呈现 Top 3；⑤ 沉淀成自动化流水线。',
        followup: '如果老板说 LLM 打标签的成本太高，你有什么降本思路？'
      },
      {
        q: 'Prompt 工程有哪些实战技巧？举一个你通过改 Prompt 显著提升效果的经历或设想。',
        points: ['角色', '示例', '结构', '约束', '迭代', '评估'],
        ref: '核心技巧：① 角色设定；② Few-shot 示例；③ 输出格式约束（JSON Schema）；④ 任务拆解（CoT 思维链）；⑤ 明确禁止事项；⑥ 建立评估集做 A/B 迭代。关键理念：Prompt 是要"被评估的代码"，不是玄学。',
        followup: '怎么证明你改的 Prompt 确实比旧版好？说说你的评估方法。'
      },
      {
        q: '微调（Fine-tuning）和 RAG 分别适合什么场景？什么时候该选哪个？',
        points: ['知识', '风格', '成本', '数据', '更新', 'rag'],
        ref: 'RAG 适合：知识频繁更新、私有知识库、需要溯源。微调适合：固定风格/格式输出、领域术语理解、小模型蒸馏降本。二者常组合：微调管"怎么说"，RAG 管"说什么"。判断依据：知识是"数据问题"还是"能力问题"。',
        followup: '你提到成本，那 LoRA 这类参数高效微调为什么能省显存？'
      }
    ],
    '算法基础': [
      {
        q: '解释一下 TF-IDF 的含义，它为什么能衡量一个词对文档的重要性？',
        points: ['词频', '逆文档频率', 'idf', 'tf', '权重', '稀有'],
        ref: 'TF-IDF = 词频 × 逆文档频率。TF：词在本文档出现越多越重要；IDF：词在越多文档出现越不重要（如"的"到处都有）。二者相乘：既常出现在本文档、又在整个语料里稀有的词，才是这篇文档的"关键词"。它是 RAG 稀疏检索（BM25）的基础。',
        followup: 'TF-IDF 有什么局限？语义相近但用词不同的查询为什么搜不到？'
      },
      {
        q: '余弦相似度是怎么计算的？为什么用余弦而不是欧氏距离来比较文本向量？',
        points: ['夹角', '点积', '模长', '方向', '归一化', '长度'],
        ref: 'cos(A,B) = A·B / (|A|||B|)，衡量两个向量方向的夹角。文本向量关心"语义方向"而非绝对长度：一篇文档扩写两倍，语义不变，欧氏距离却会变大；归一化后的余弦只看方向，对长度不敏感，所以更适合。',
        followup: '两个完全无关的文档余弦相似度会是 0 吗？什么情况下不会？'
      },
      {
        q: '讲一下你最熟悉的一种排序算法的时间复杂度，以及什么场景下它会退化。',
        points: ['复杂度', 'o(n', '快排', '归并', '退化', '有序'],
        ref: '以快排为例：平均 O(n log n)，最坏 O(n²)（已有序数组 + 固定取首元素为基准时每次划分极不均衡）。工程上用随机选基准/三数取中规避。归并稳定 O(n log n) 但要 O(n) 额外空间。',
        followup: '如果要对 10 亿条数据排序，内存放不下，你会怎么做？'
      },
      {
        q: '什么是过拟合？你在训练模型时怎么发现和防止过拟合？',
        points: ['训练', '验证', '泛化', '正则', 'dropout', '早停', '数据增强'],
        ref: '过拟合 = 训练集表现好、验证/测试集表现差，模型背住了噪声。发现：监控训练/验证曲线的剪刀差。防止：① 更多数据/数据增强；② 正则化（L1/L2）；③ Dropout；④ 早停；⑤ 降低模型复杂度；⑥ 交叉验证。',
        followup: 'L1 和 L2 正则化对模型参数的影响有什么本质区别？'
      },
      {
        q: '梯度下降是什么？学习率设大设小分别会发生什么？',
        points: ['梯度', '导数', '方向', '学习率', '震荡', '收敛慢', '局部最优'],
        ref: '沿损失函数梯度的反方向小步更新参数：θ = θ - lr·∇L。学习率太大：震荡甚至发散；太小：收敛极慢、易陷局部极小。实践中用学习率调度（warmup + 衰减）、Adam 等自适应优化器。',
        followup: 'Adam 优化器和原始 SGD 的核心区别是什么？'
      }
    ],
    '前端工程': [
      {
        q: '从输入 URL 到页面渲染完成，中间发生了什么？挑三个你最熟悉的环节讲深一点。',
        points: ['dns', 'tcp', 'http', '请求', '解析', '渲染', '缓存'],
        ref: 'DNS 解析 → TCP/TLS 建连 → HTTP 请求响应 → HTML 解析成 DOM/CSSOM → 渲染树 → 布局 → 绘制。可深入：浏览器缓存策略、CDN、关键渲染路径、脚本阻塞与 defer/async。',
        followup: 'defer 和 async 脚本的区别是什么？各适合什么场景？'
      },
      {
        q: 'CSS 的盒模型是什么？box-sizing 的两个值有什么区别？',
        points: ['content', 'padding', 'border', 'margin', 'border-box', '宽度'],
        ref: '盒模型 = content + padding + border + margin。content-box：width 只含内容，加 padding 后实际变宽；border-box：width 含内容和 padding/border，布局更好算，工程上普遍全局 * { box-sizing: border-box }。',
        followup: 'margin 重叠（塌陷）在什么情况下发生？怎么解决？'
      },
      {
        q: '说说浏览器同源策略，以及 CORS 跨域的原理和常见解决方案。',
        points: ['同源', '协议', '域名', '端口', 'cors', '头部', '预检', '代理'],
        ref: '同源 = 协议+域名+端口全相同。跨域读取被浏览器拦截（请求已发出，是响应被挡）。CORS：服务端返回 Access-Control-Allow-Origin 等头；非简单请求先发 OPTIONS 预检。开发期常用代理转发，生产用 CORS 头或网关。',
        followup: '为什么说 CORS 是"浏览器的行为"而不是服务器的行为？'
      },
      {
        q: '虚拟 DOM 是什么？它解决了什么问题，又带来了什么代价？',
        points: ['dom', 'diff', 'js 对象', '批量', '性能', '内存'],
        ref: '用 JS 对象描述 UI 结构，变更时先 diff 新旧虚拟 DOM，再把最小差异批量应用到真实 DOM，减少直接操作 DOM 的重排重绘。代价：多一层 JS 计算 + 内存占用；极端高频更新场景不如手工优化。',
        followup: 'Vue 的响应式和 React 的 setState 重渲染思路有什么本质不同？'
      },
      {
        q: '一个页面加载要 5 秒，你会怎么系统地排查和优化？',
        points: ['network', '压缩', '缓存', '懒加载', 'cdn', '指标', 'lcp'],
        ref: '先测量再优化：Network/Performance 面板定位瓶颈（TTFB？资源体积？脚本阻塞？）。手段：压缩与 Tree-shaking、图片 WebP/懒加载、CDN、HTTP 缓存、代码分割、关键 CSS 内联、SSR。用 LCP/FCP 指标验收。',
        followup: '首屏 1 秒内打开，但交互卡顿，你会查什么？'
      }
    ],
    '通用素质': [
      {
        q: '介绍一个你最有成就感的项目：你解决了什么问题，方案是怎么定的，结果如何量化？',
        points: ['问题', '方案', '数据', '结果', '量化', '迭代'],
        ref: 'STAR 结构：背景（什么问题）→ 任务（你的角色）→ 行动（为什么选这个方案、取舍是什么）→ 结果（量化指标：性能提升 x%、覆盖 y 个场景）。亮点在"为什么这么选"而不在"用了什么技术"。',
        followup: '如果现在重做这个项目，你会改进哪两点？'
      },
      {
        q: '讲一次你和别人（同事/同学/网友）协作解决技术分歧的经历。',
        points: ['分歧', '沟通', '数据', '验证', '目标', '结果'],
        ref: '考察点：对事不对人、用数据/实验代替争吵、给对方台阶。好答案：先复述对方观点确认理解 → 提出共同目标 → 小成本验证 → 按结果走。',
        followup: '如果验证结果证明你错了，你怎么收场？'
      },
      {
        q: '你平时怎么学习新技术？举最近的一个例子，从接触到能用的全过程。',
        points: ['文档', '源码', '实践', '项目', '输出', '总结'],
        ref: '好答案的特征：有固定信息源（官方文档/论文/源码）、先跑通最小示例再深入、用输出倒逼输入（写笔记/做 demo）、能讲清"踩过的坑"。',
        followup: '你最近踩的一个技术坑是什么，怎么定位的？'
      },
      {
        q: '为什么选择我们这个方向/这个岗位？你觉得自己最大的优势和最大的短板分别是什么？',
        points: ['动机', '匹配', '优势', '短板', '改进', '诚实'],
        ref: '动机要具体（用过产品/研究过业务/技术方向一致），优势要给证据，短板要真实 + 正在改进的行动。忌空话："我热爱学习、我追求完美"。',
        followup: '你说的短板，最近一次因为它吃亏是什么时候？'
      }
    ]
  };

  NS.DIRECTIONS = [
    { id: 'ai应用',   label: 'AI 应用工程师', desc: 'RAG / Prompt / Agent / LLM 落地' },
    { id: '算法基础', label: '算法与机器学习', desc: '经典算法 / ML 基础' },
    { id: '前端工程', label: '前端工程师',    desc: '浏览器 / CSS / 工程化' },
    { id: '通用素质', label: '通用素质面',    desc: '项目 / 协作 / 学习能力' }
  ];

  /* ---------- 默认作品集（可在线编辑，存 localStorage） ---------- */
  NS.DEFAULT_PORTFOLIO = {
    name: '我的作品集', title: '填写你的目标方向', location: '',
    summary: '这是你的本地作品集草稿。点击编辑资料，加入真实经历；修改仅保存在当前浏览器。',
    contacts: [], skills: [], projects: []
  };

  /* ---------- 示例数据（访客一键体验） ---------- */
  NS.SAMPLE_JD = `【岗位】AI 应用开发实习生（大模型方向）

职责：
1. 参与大模型应用的研发落地，包括 RAG 检索增强、Prompt 工程与效果评估
2. 搭建智能问答 / Agent 工作流，对接业务数据
3. 与产品配合做数据分析，挖掘用户需求
4. 编写技术文档与测试用例

要求：
1. 熟悉 Python，有实际项目经验
2. 了解 LLM 原理，用过 OpenAI / 其他大模型 API，有 RAG、微调经验优先
3. 熟悉向量数据库与 embedding 检索
4. 有前端基础（HTML/CSS/JS）优先
5. 良好的沟通与团队协作能力，英文文档阅读能力
6. 每周实习 4 天以上`;

  NS.SAMPLE_RESUME = `我叫示例候选人，AI 应用方向在校生，坐标深圳。

技术栈：
- 语言：Python（主力，3 年使用经验，日常用它写量化系统、爬虫和自动化脚本）、JavaScript、SQL
- AI/ML：熟悉大模型（LLM）API 调用与 Prompt 工程，做过 RAG 检索问答（向量数据库 + embedding 检索 + 重排），了解微调 LoRA 原理，用过 sklearn 做数据分析
- 前端：HTML/CSS/原生 JS，能独立完成数据可视化页面（ECharts）
- 工具：Git/GitHub、Linux、Docker 基础、自动化脚本

项目经历：
1. A股量化选股系统（独立开发）：Python + pandas 实现 10 因子选股（MFI/MACD/KDJ），新浪+腾讯双数据源，B1 买点模型，附完整可视化界面
2. 视频解析流水线：Whisper 转写 + 关键帧识别 + 结构化摘要，多进程分片提速
3. AI 新闻自动化：定时抓取 → LLM 生成摘要 → HTML 邮件自动推送，无人值守运行
4. 论文可视摘要生成器：输入 arXiv 链接生成单文件 HTML 摘要页

其他：英语可读文档，习惯写技术笔记，多模型交叉验证 AI 输出。`;

})(window.JobLens);
