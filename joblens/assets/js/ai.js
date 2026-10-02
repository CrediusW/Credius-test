/* ============================================================
 * JobLens AI 双引擎
 *   本地引擎：技能词典 + 词频加权（TF 子线性）+ 覆盖率评分，零 Key 开箱即用
 *   LLM 引擎：OpenAI 兼容 API（浏览器直连自带 Key / 或走代理），输出结构化 JSON
 * 两个引擎实现同一套接口：matchJD / askQuestion / evaluateAnswer / finalReport
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';

  /* ==================== 本地算法引擎 ==================== */

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* 统计别名出现次数：纯 ASCII 串按整词（\b 边界），含中文按子串 */
  function aliasCount(low, alias) {
    if (/^[a-z0-9+#.\-/ ]+$/.test(alias)) {
      var m = low.match(new RegExp('\\b' + escRe(alias) + '\\b', 'g'));
      return m ? m.length : 0;
    }
    var n = 0, idx = 0;
    while ((idx = low.indexOf(alias, idx)) !== -1) { n++; idx += alias.length; }
    return n;
  }

  /* 抽取文本中出现的技能：weight = 基础权重 w × (1 + ln(1 + tf)) 子线性词频加权 */
  function extractSkills(text) {
    var low = String(text || '').toLowerCase();
    var found = [];
    NS.SKILL_DICT.forEach(function (sk) {
      var tf = 0;
      sk.aliases.forEach(function (a) { tf += aliasCount(low, a); });
      if (tf > 0) found.push({ name: sk.name, cat: sk.cat, w: sk.w, tf: tf, weight: sk.w * (1 + Math.log(1 + tf)) });
    });
    return found;
  }

  var local = {
    /* ---- JD 匹配打分 ----
     * 评分公式：
     *   coverage = Σ(命中技能权重) / Σ(JD 全部技能权重)      —— 硬技能覆盖率
     *   evidence = min(1, 简历字数 / 1800)                   —— 简历厚度信号
     *   score    = round(100 × coverage × (0.9 + 0.1×evidence)) 简历厚度最多 ±10% 加成
     */
    matchJD: function (jdText, resumeText) {
      var jdSkills = extractSkills(jdText);
      var reMap = {};
      extractSkills(resumeText).forEach(function (s) { reMap[s.name] = s; });

      var totalW = 0, matchedW = 0, matched = [], missing = [], cats = {};
      jdSkills.forEach(function (s) {
        totalW += s.weight;
        var hit = !!reMap[s.name];
        if (hit) { matchedW += s.weight; matched.push({ name: s.name, weight: s.weight }); }
        else { missing.push({ name: s.name, weight: s.weight }); }
        var c = cats[s.cat] || (cats[s.cat] = { w: 0, hit: 0 });
        c.w += s.weight; if (hit) c.hit += s.weight;
      });

      var coverage = totalW ? matchedW / totalW : 0;
      var evidence = Math.min(1, String(resumeText || '').length / 1800);
      var score = Math.round(100 * coverage * (0.9 + 0.1 * evidence));

      var dims = Object.keys(cats).map(function (k) {
        return { name: k, score: Math.round(100 * cats[k].hit / cats[k].w) };
      });
      if (dims.length < 3) dims.push({ name: '综合', score: score });

      matched.sort(function (a, b) { return b.weight - a.weight; });
      missing.sort(function (a, b) { return b.weight - a.weight; });

      var suggestions = [];
      missing.slice(0, 3).forEach(function (m) {
        suggestions.push('岗位要求「' + m.name + '」但简历未体现：在项目经历里补一条用 ' + m.name +
          ' 解决具体问题的成果描述（做了什么 → 怎么做 → 结果如何量化）。');
      });
      if (coverage >= 0.75) {
        suggestions.push('硬技能匹配已较高：在自我评价里主动呼应 JD 高频词，并通过具体数字（性能提升 x%、覆盖 y 场景）强化可信度。');
      } else if (coverage >= 0.4) {
        suggestions.push('匹配度中等：优先补齐差距最大的 1-2 项技能的最小可展示项目（哪怕是小 demo），比罗列"了解"更有说服力。');
      } else {
        suggestions.push('当前与该岗位差距较大：先判断这是"能力差距"还是"简历表达差距"——很多技能你做过但没写关键词，改写简历本身可能立竿见影。');
      }

      return {
        score: score,
        dims: dims,
        matched: matched.map(function (m) { return m.name; }),
        missing: missing.map(function (m) { return m.name; }),
        suggestions: suggestions,
        summary: '本地算法评估：JD 识别出 ' + jdSkills.length + ' 项技能要求，命中 ' + matched.length +
          ' 项（覆盖率 ' + Math.round(coverage * 100) + '%），缺失 ' + missing.length + ' 项。',
        source: '本地算法 v1'
      };
    },

    /* ---- 面试：按题库顺序出题 ---- */
    askQuestion: function (session) {
      var bank = NS.QUESTION_BANK[session.direction] || [];
      var item = bank[session.idx % bank.length];
      if (!item) return null;
      return { question: item.q, points: item.points, ref: item.ref, followup: item.followup };
    },

    /* ---- 面试：按"参考要点关键词命中率"打分 ---- */
    evaluateAnswer: function (question, answer) {
      var low = String(answer || '').toLowerCase();
      var pts = question.points || [];
      var hit = [], missed = [];
      pts.forEach(function (p) { (low.indexOf(String(p).toLowerCase()) !== -1 ? hit : missed).push(p); });
      var score = pts.length ? Math.round(100 * hit.length / pts.length) : (answer ? 60 : 0);
      if (answer && answer.length < 30) score = Math.min(score, 40);

      var fb = '要点命中 ' + hit.length + '/' + pts.length + '。';
      if (hit.length) fb += '已覆盖：' + hit.join('、') + '。';
      if (missed.length) fb += '未覆盖：' + missed.join('、') + '。';
      fb += score >= 80 ? '回答质量不错。' : score >= 50 ? '核心方向对了，但要点不全，建议对照参考答案补齐。' : '偏题或过简，建议按 STAR 结构重新组织：背景 → 任务 → 行动 → 量化结果。';

      return { score: score, feedback: fb, followup: score < 85 ? (question.followup || '') : '' };
    },

    /* ---- 面试：本地终面报告 ---- */
    finalReport: function (session) {
      var entries = session.entries.filter(function (e) { return e.evaluated; });
      if (!entries.length) return '没有可统计的作答记录。';
      var total = 0, worst = null;
      entries.forEach(function (e) {
        total += e.score;
        if (!worst || e.score < worst.score) worst = e;
      });
      var avg = Math.round(total / entries.length);
      var lines = [
        '## 面试报告（本地算法评估）', '',
        '- 题目数：' + entries.length,
        '- 平均分：**' + avg + ' / 100**',
        '- 判定：' + (avg >= 80 ? '表现优秀，可以重点准备追问的深度了' : avg >= 60 ? '基础扎实，但细节深度需要加强' : '建议回到基础知识，先补再练'), '',
        '### 最需要加强的一题', '',
        (worst ? worst.question : '') + '', '',
        '### 建议', '',
        '1. 每道题对照参考要点，把没说到的点用自己的话复述一遍',
        '2. 对低于 70 分的题目，写出完整书面答案再练习口头表达',
        '3. 配置 LLM 引擎后可获得逐题个性化反馈与追问'
      ];
      return lines.join('\n');
    }
  };

  /* ==================== LLM 引擎 ==================== */

  var llm = {
    ready: function () {
      var s = NS.store.settings().llm;
      return !!(s.proxyUrl || (s.baseUrl && s.apiKey));
    },
    endpoint: function () {
      var s = NS.store.settings().llm;
      return (s.proxyUrl || s.baseUrl || '').replace(/\/+$/, '');
    },
    /* OpenAI 兼容 chat/completions。代理模式：直接 POST 代理地址，不带 Key */
    chat: async function (messages, opts) {
      opts = opts || {};
      var s = NS.store.settings().llm;
      var base = llm.endpoint();
      if (!base) throw new Error('未配置 API 地址：请到「设置」填写 Base URL + Key，或代理地址');
      var headers = { 'Content-Type': 'application/json' };
      if (!s.proxyUrl && s.apiKey) headers['Authorization'] = 'Bearer ' + s.apiKey;

      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 90000);
      var res;
      try {
        res = await fetch(base + '/chat/completions', {
          method: 'POST', headers: headers, signal: ctrl.signal,
          body: JSON.stringify({ model: s.model || 'gpt-4o-mini', messages: messages, temperature: opts.temperature != null ? opts.temperature : 0.4 })
        });
      } catch (e) {
        throw new Error(e && e.name === 'AbortError' ? '模型请求超时（90s），请重试或换模型' : '网络错误：无法连接 ' + base + '（检查地址 / 代理 / CORS）');
      } finally { clearTimeout(timer); }

      if (!res.ok) {
        var t = await res.text().catch(function () { return ''; });
        throw new Error('API 返回 ' + res.status + '：' + String(t).slice(0, 160));
      }
      var data = await res.json();
      var txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (typeof txt !== 'string') throw new Error('API 响应格式异常（不是 OpenAI 兼容格式？）');
      return txt;
    },
    /* 从模型输出中抢救 JSON */
    parseJSON: function (text) {
      var t = String(text).trim();
      var m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) t = m[1].trim();
      var s = t.indexOf('{'), e = t.lastIndexOf('}');
      if (s === -1 || e <= s) throw new Error('模型没有返回 JSON，原话：' + t.slice(0, 120));
      return JSON.parse(t.slice(s, e + 1));
    }
  };

  /* ---- LLM Prompt 集 ---- */
  var PROMPTS = {
    match: function (jd, resume) {
      return [
        { role: 'system', content: '你是资深技术招聘官兼简历顾问。评估简历与岗位描述的匹配度。只输出 JSON，不要输出其他文字，格式：{"score":0到100整数,"dims":[{"name":"维度名","score":0到100}],"matched":["简历已体现的技能"],"missing":["岗位要求但简历缺失的"],"suggestions":["具体可执行的改简历建议，2到4条"],"summary":"一句话总评"}。dims 至少4个维度（如：技能覆盖、经验相关度、工程能力、软技能、加分项）。' },
        { role: 'user', content: '【岗位描述】\n' + jd + '\n\n【我的简历】\n' + resume + '\n\n请评估并输出 JSON。' }
      ];
    },
    question: function (session) {
      var d = NS.DIRECTIONS.find(function (x) { return x.id === session.direction; }) || {};
      return [
        { role: 'system', content: '你是' + (d.label || '技术') + '方向的面试官，语气专业友善，一次只问一个问题。只输出 JSON：{"question":"问题","keypoints":["这道题的参考要点关键词"],"difficulty":"easy|medium|hard"}' },
        { role: 'user', content: '这是第 ' + (session.idx + 1) + '/' + session.total + ' 题。方向：' + (d.label || '') + '。' +
          (session.jd ? '参考岗位描述出题：\n' + session.jd.slice(0, 1200) : '') +
          '\n不要与这些已问过的问题重复：' + session.entries.filter(function (e) { return e.q; }).map(function (e) { return '「' + e.q.slice(0, 30) + '」'; }).join(' ') }
      ];
    },
    evaluate: function (question, answer) {
      return [
        { role: 'system', content: '你是面试官，评估候选人回答。只输出 JSON：{"score":0到100整数,"feedback":"两三句具体反馈，先说好在哪再说缺什么","followup":"若回答有明显薄弱点则给一个追问，否则空字符串"}' },
        { role: 'user', content: '【面试题】\n' + question + '\n\n【候选人回答】\n' + answer + '\n\n请评估并输出 JSON。' }
      ];
    },
    report: function (session) {
      var log = session.entries.map(function (e, i) {
        return '第' + (i + 1) + '题（' + (e.score != null ? e.score + '分' : '未作答') + '）：' + e.q + '\n回答摘要：' + String(e.a || '').slice(0, 200);
      }).join('\n\n');
      return [
        { role: 'system', content: '你是面试官，写一份 Markdown 格式的终面报告，包含：总体评价（含平均分）、逐题点评、三个最需要加强的方向、下一步学习建议。中文，务实不客套。' },
        { role: 'user', content: '方向：' + session.direction + '。面试记录：\n' + log }
      ];
    }
  };

  /* ==================== 统一调度层 ==================== */

  NS.ai = {
    engine: function () {
      var s = NS.store.settings();
      return s.engine === 'llm' ? 'llm' : 'local';
    },
    modelName: function () {
      var s = NS.store.settings();
      return s.engine === 'llm' ? (s.llm.model || 'LLM') : '本地算法 v1';
    },
    llmReady: llm.ready,

    /* JD 匹配：LLM 失败自动降级本地，并在结果里注明 */
    matchJD: async function (jdText, resumeText) {
      if (NS.ai.engine() === 'llm' && llm.ready()) {
        try {
          var raw = await llm.chat(PROMPTS.match(jdText, resumeText));
          var j = llm.parseJSON(raw);
          return {
            score: Math.max(0, Math.min(100, Math.round(+j.score || 0))),
            dims: (Array.isArray(j.dims) ? j.dims : []).map(function (d) { return { name: String(d.name), score: Math.max(0, Math.min(100, Math.round(+d.score || 0))) }; }),
            matched: j.matched || [], missing: j.missing || [],
            suggestions: j.suggestions || [], summary: j.summary || '',
            source: NS.store.settings().llm.model || 'LLM'
          };
        } catch (e) {
          var r = local.matchJD(jdText, resumeText);
          r.warning = 'LLM 调用失败已降级本地算法：' + e.message;
          return r;
        }
      }
      return local.matchJD(jdText, resumeText);
    },

    askQuestion: async function (session) {
      if (NS.ai.engine() === 'llm' && llm.ready()) {
        try {
          var raw = await llm.chat(PROMPTS.question(session), { temperature: 0.8 });
          var j = llm.parseJSON(raw);
          return { question: j.question, points: j.keypoints || [], ref: '', followup: '', source: NS.store.settings().llm.model };
        } catch (e) {
          var q = local.askQuestion(session);
          q.warning = 'LLM 失败已用本地题库：' + e.message;
          return q;
        }
      }
      return local.askQuestion(session);
    },

    evaluateAnswer: async function (question, answer) {
      if (NS.ai.engine() === 'llm' && llm.ready()) {
        try {
          var raw = await llm.chat(PROMPTS.evaluate(question, answer), { temperature: 0.3 });
          var j = llm.parseJSON(raw);
          return {
            score: Math.max(0, Math.min(100, Math.round(+j.score || 0))),
            feedback: j.feedback || '', followup: j.followup || '',
            source: NS.store.settings().llm.model
          };
        } catch (e) {
          var r = local.evaluateAnswer({ points: [] , followup: ''}, answer);
          r.feedback = '（LLM 失败：' + e.message + '）';
          r.score = answer ? 60 : 0;
          return r;
        }
      }
      return local.evaluateAnswer(question, answer);
    },

    finalReport: async function (session) {
      if (NS.ai.engine() === 'llm' && llm.ready()) {
        try { return await llm.chat(PROMPTS.report(session), { temperature: 0.5 }); }
        catch (e) { return local.finalReport(session) + '\n\n（LLM 报告失败，已用本地统计：' + e.message + '）'; }
      }
      return local.finalReport(session);
    },

    testConnection: async function () {
      var t0 = Date.now();
      var reply = await llm.chat([{ role: 'user', content: '只回复两个字：正常' }], { temperature: 0 });
      return { ms: Date.now() - t0, reply: reply.slice(0, 50) };
    }
  };

  NS.localEngine = local;
})(window.JobLens);
