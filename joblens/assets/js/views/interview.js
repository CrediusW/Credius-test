/* ============================================================
 * 视图：AI 模拟面试官
 *   出题 → 作答 → 评分反馈 → 追问 → 终面报告（双引擎同一流程）
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';
  NS.views = NS.views || {};

  var esc = NS.ui.esc;
  var session = null;

  NS.views.interview = function (root) {
    if (session && session.phase !== 'done') { renderSession(root); return; }
    renderSetup(root);
  };

  /* ==================== 设置页 ==================== */
  function renderSetup(root) {
    var hist = NS.store.interviewHistory();
    root.innerHTML =
      '<div class="card" style="max-width:760px;margin:0 auto">' +
        '<div class="card-title">模拟面试设置 <span class="spacer"></span>' +
          '<span class="src-badge">' + (NS.ai.engine() === 'llm' ? '引擎：' + esc(NS.ai.modelName()) : '引擎：本地题库') + '</span></div>' +

        '<h4>面试方向</h4>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">' +
          NS.DIRECTIONS.map(function (d, i) {
            return '<span class="chip clickable' + (i === 0 ? ' accent' : '') + '" data-dir="' + d.id + '" style="padding:8px 16px;font-size:14px">' +
              '<b>' + esc(d.label) + '</b><span class="faint" style="margin-left:6px">' + esc(d.desc) + '</span></span>';
          }).join('') +
        '</div>' +

        '<div class="row">' +
          '<label class="field"><span>题目数量</span><select id="qCount"><option>3</option><option selected>5</option><option>7</option></select></label>' +
          '<label class="field"><span>岗位 JD（可选，出题更有针对性）</span><input type="text" id="qJd" placeholder="粘贴 JD 或留空"></label>' +
        '</div>' +

        '<button class="btn btn-primary" id="startBtn" style="width:100%;padding:13px">🎯 开始面试</button>' +
        (NS.ai.engine() === 'local'
          ? '<p class="faint small" style="margin:12px 0 0">当前为本地题库引擎：出题固定、按参考要点关键词打分。到「设置」接入 LLM 可获得动态出题与逐题点评。</p>'
          : '<p class="faint small" style="margin:12px 0 0">LLM 引擎：动态出题、个性化点评与追问。中途失败会自动降级本地题库。</p>') +
      '</div>' +

      (hist.length ? '<div class="card" style="max-width:760px;margin:0 auto"><div class="card-title">历史战绩</div>' +
        hist.slice(0, 8).map(function (h) {
          return '<div class="flex-between small" style="padding:6px 0;border-bottom:1px solid var(--border)">' +
            '<span class="muted">' + esc(h.date) + ' · ' + esc(h.dirLabel) + ' · ' + h.count + ' 题</span>' +
            '<b style="color:' + (h.avg >= 80 ? 'var(--good)' : h.avg >= 60 ? 'var(--accent)' : 'var(--bad)') + '">' + h.avg + ' 分</b></div>';
        }).join('') + '</div>' : '');

    var dir = NS.DIRECTIONS[0].id;
    root.querySelectorAll('[data-dir]').forEach(function (c) {
      c.addEventListener('click', function () {
        dir = c.dataset.dir;
        root.querySelectorAll('[data-dir]').forEach(function (x) { x.classList.remove('accent'); });
        c.classList.add('accent');
      });
    });
    document.getElementById('startBtn').addEventListener('click', function () {
      session = {
        direction: dir,
        dirLabel: (NS.DIRECTIONS.find(function (d) { return d.id === dir; }) || {}).label || dir,
        total: +document.getElementById('qCount').value,
        jd: document.getElementById('qJd').value.trim(),
        idx: 0, entries: [], phase: 'ask', busy: false
      };
      renderSession(root);
    });
  }

  /* ==================== 面试进行页 ==================== */
  async function renderSession(root) {
    var waiting = session.phase === 'ask' && !session.currentQ && !session.done;
    root.innerHTML =
      '<div class="card" style="max-width:820px;margin:0 auto">' +
        '<div class="flex-between" style="margin-bottom:14px">' +
          '<div class="card-title" style="margin:0">模拟面试 · ' + esc(session.dirLabel) +
            '<span class="faint small">第 ' + Math.min(session.idx + 1, session.total) + ' / ' + session.total + ' 题</span></div>' +
          '<button class="btn btn-danger btn-sm" id="quitBtn">结束</button>' +
        '</div>' +
        '<div class="dim-bar" style="margin-bottom:16px"><div class="dim-fill" style="width:' +
          Math.round(100 * session.entries.length / session.total) + '%"></div></div>' +
        '<div class="chat" id="chatBox">' +
          '<div class="msg ai"><div class="who">面试官</div>' + NS.ui.md(
            session.total + ' 道题，答完每题会给评分与反馈' + (session.jd ? '，已结合你提供的 JD 出题' : '') +
            '。开始：').replace(/<div class="md">|<\/div>$/g, '') + '</div>' +
        '</div>' +
        '<div id="qaArea">' + (waiting ? '<div class="notice info">正在出题…</div>' : '') + '</div>' +
      '</div>';

    document.getElementById('quitBtn').addEventListener('click', async function () {
      if (session.entries.length && await NS.ui.confirmDlg('提前结束并生成报告？')) { finish(root); }
      else if (!session.entries.length) { session = null; renderSetup(root); }
    });

    replayLog();
    if (session.phase === 'done') { finish(root); return; }
    if (!session.currentQ) { await nextQuestion(root); }
    else { renderQaArea(root); }
  }

  function replayLog() {
    var box = document.getElementById('chatBox');
    session.entries.forEach(function (e) {
      if (e.q) box.appendChild(bubble('ai', e.q, '面试官 · 第' + (e.no) + '题'));
      if (e.a) box.appendChild(bubble('me', e.a, '我'));
      if (e.evaluated) box.appendChild(bubble('ai eval', '**' + e.score + ' 分** — ' + e.feedback, '评分反馈'));
      if (e.fq) box.appendChild(bubble('ai', e.fq, '面试官 · 追问'));
      if (e.fa) box.appendChild(bubble('me', e.fa, '我'));
      if (e.feval) box.appendChild(bubble('ai eval', '**' + e.feval.score + ' 分** — ' + e.feval.feedback, '追问反馈'));
    });
    box.scrollTop = box.scrollHeight;
  }

  function bubble(cls, text, who) {
    var d = document.createElement('div');
    d.className = 'msg ' + cls;
    d.innerHTML = '<div class="who">' + esc(who) + '</div>' + NS.ui.md(text).replace(/^<div class="md">|<\/div>$/g, '');
    return d;
  }

  /* 视图还挂载着吗？（异步回调期间用户可能已切走页签） */
  function viewAlive() { return !!document.getElementById('qaArea') || !!document.getElementById('chatBox'); }

  async function nextQuestion(root) {
    var area = document.getElementById('qaArea');
    if (!area) return; /* 视图已切走：session 状态保留，切回来时 renderSession 会续上 */
    if (session.idx >= session.total) { session.phase = 'done'; finish(root); return; }
    area.innerHTML = '<div class="notice info">面试官正在出题…（本地即时 / LLM 数秒）</div>';
    try {
      var q = await NS.ai.askQuestion(session);
      if (!viewAlive()) return; /* await 期间视图被切走 */
      if (!q) { session.phase = 'done'; finish(root); return; }
      session.currentQ = q;
      session.currentEntry = { no: session.idx + 1, q: q.question, points: q.points || [], ref: q.ref || '', followup: q.followup || '', a: '', score: null, evaluated: false, fq: '', fa: '', feval: null, source: q.source || '' };
      renderQaArea(root);
    } catch (e) {
      if (viewAlive()) area.innerHTML = '<div class="notice bad">出题失败：' + esc(e.message) + '</div>';
    }
  }

  function renderQaArea(root) {
    var area = document.getElementById('qaArea');
    var q = session.currentQ;
    var chatBox = document.getElementById('chatBox');

    if (session.phase === 'ask') {
      chatBox.appendChild(bubble('ai', q.question, '面试官 · 第' + (session.idx + 1) + '题'));
      chatBox.scrollTop = chatBox.scrollHeight;
    } else if (session.phase === 'followup') {
      chatBox.appendChild(bubble('ai', session.currentEntry.fq, '面试官 · 追问'));
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    area.innerHTML =
      '<textarea id="ansInput" style="min-height:150px;margin-top:6px" placeholder="' +
        (session.phase === 'followup' ? '回答追问…（可简短）' : '把这里当成面试现场，按 STAR 结构组织：背景 → 任务 → 行动 → 量化结果') + '"></textarea>' +
      '<div style="display:flex;gap:10px;margin-top:12px">' +
        '<button class="btn btn-primary" id="submitAnsBtn" style="flex:1">提交回答</button>' +
        '<button class="btn btn-ghost" id="skipBtn">跳过此题</button>' +
        '<button class="btn btn-ghost" id="refBtn">看参考答案</button>' +
      '</div>' +
      '<div id="ansFeedback"></div>';

    document.getElementById('submitAnsBtn').addEventListener('click', function () { submitAnswer(root); });
    document.getElementById('skipBtn').addEventListener('click', function () {
      recordAnswer(root, '（跳过未作答）', true);
    });
    document.getElementById('refBtn').addEventListener('click', function () {
      var ref = session.phase === 'followup' ? (session.currentEntry.ref || '追问没有标准答案，围绕主题要点展开即可。') : session.currentEntry.ref;
      if (!ref) { NS.ui.toast('LLM 引擎模式不预置参考答案，答完会有点评'); return; }
      NS.ui.modal({ title: '参考答案（答完前偷看会降低练习价值哦）', body: NS.ui.md(ref), actions: [{ label: '关闭' }] });
    });
  }

  async function submitAnswer(root) {
    var val = document.getElementById('ansInput').value.trim();
    if (!val) { NS.ui.toast('先写下你的回答', 'bad'); return; }
    recordAnswer(root, val, false);
  }

  async function recordAnswer(root, val, skipped) {
    var btn = document.getElementById('submitAnsBtn');
    if (btn) { btn.disabled = true; btn.textContent = '评估中…'; }
    var entry = session.currentEntry;
    try {
      if (session.phase === 'ask') {
        entry.a = val;
        var ev = skipped ? { score: 0, feedback: '跳过未作答，记 0 分。', followup: '' }
                         : await NS.ai.evaluateAnswer({ points: entry.points, followup: entry.followup }, val);
        entry.score = ev.score; entry.feedback = ev.feedback; entry.evaluated = true;
        session.entries.push(entry);

        var chatBox = document.getElementById('chatBox');
        chatBox.appendChild(bubble('me', val, '我'));
        chatBox.appendChild(bubble('ai eval', '**' + ev.score + ' 分** — ' + ev.feedback, '评分反馈'));
        if (ev.followup && !skipped) {
          entry.fq = ev.followup;
          session.phase = 'followup';
          chatBox.appendChild(bubble('ai', entry.fq, '面试官 · 追问'));
          chatBox.scrollTop = chatBox.scrollHeight;
          document.getElementById('ansInput').value = '';
          btn.disabled = false; btn.textContent = '提交回答';
          return;
        }
      } else {
        /* 追问回答：记录并尽量评估 */
        entry.fa = val;
        if (NS.ai.engine() === 'llm' && NS.ai.llmReady() && !skipped) {
          var fev = await NS.ai.evaluateAnswer(entry.fq, val);
          entry.feval = fev;
        } else if (!skipped) {
          entry.feval = { score: null, feedback: '追问回答已记录。本地引擎对开放追问不做打分，对照主题参考要点自查即可。' };
        }
        var cb = document.getElementById('chatBox');
        if (!cb) return; /* 同上：视图切走保护 */
        cb.appendChild(bubble('me', val, '我'));
        if (entry.feval) cb.appendChild(bubble('ai eval', (entry.feval.score != null ? '**' + entry.feval.score + ' 分** — ' : '') + entry.feval.feedback, '追问反馈'));
        cb.scrollTop = cb.scrollHeight;
      }
    } catch (e) {
      NS.ui.toast('评估失败：' + e.message, 'bad', 4000);
      if (btn) { btn.disabled = false; btn.textContent = '提交回答'; }
      return;
    }

    session.phase = 'ask';
    session.idx++;
    session.currentQ = null;

    if (session.idx >= session.total) { session.phase = 'done'; finish(root); }
    else {
      /* 简短停顿后出下一题 */
      var area = document.getElementById('qaArea');
      area.innerHTML = '<div class="notice info">下一题准备中…</div>';
      setTimeout(function () { nextQuestion(root); }, 600);
    }
  }

  /* ==================== 终面报告 ==================== */
  async function finish(root) {
    root.innerHTML = '<div class="card" style="max-width:820px;margin:0 auto">' +
      '<div class="card-title">正在生成终面报告…</div><div class="notice info">本地引擎即时出结果，LLM 引擎约需十秒。</div></div>';

    var done = session.entries.filter(function (e) { return e.evaluated; });
    var avg = done.length ? Math.round(done.reduce(function (s, e) { return s + e.score; }, 0) / done.length) : 0;

    var reportMd = await NS.ai.finalReport(session);

    /* 生成报告期间用户可能已切走：别覆盖别的视图，回来时重进即可 */
    if (!location.hash || location.hash.indexOf('interview') === -1) return;

    var hist = NS.store.interviewHistory();
    hist.unshift({ date: new Date().toISOString().slice(0, 10), dirLabel: session.dirLabel, count: done.length, avg: avg });
    NS.store.interviewHistory(hist);
    session.phase = 'done';

    root.innerHTML =
      '<div class="card" style="max-width:820px;margin:0 auto">' +
        '<div class="flex-between"><div class="card-title" style="margin:0">终面报告 · ' + esc(session.dirLabel) + '</div>' +
        '<div><button class="btn btn-ghost btn-sm" id="exportRptBtn">导出报告</button> ' +
        '<button class="btn btn-primary btn-sm" id="againBtn">再来一场</button></div></div>' +
        '<div style="display:flex;gap:22px;align-items:center;margin:16px 0;flex-wrap:wrap">' +
          NS.ui.scoreRing(avg) +
          '<div style="flex:1;min-width:240px">' +
            session.entries.map(function (e) {
              return '<div class="dim-row"><span class="dim-name" style="width:70px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(e.q.slice(0, 40)) + '">第' + e.no + '题</span>' +
                '<div class="dim-bar"><div class="dim-fill" style="width:' + (e.score || 0) + '%"></div></div>' +
                '<span class="dim-val">' + (e.score != null ? e.score : '—') + '</span></div>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div id="reportMd"></div>' +
      '</div>';

    document.getElementById('reportMd').innerHTML = NS.ui.md(reportMd);
    document.getElementById('exportRptBtn').addEventListener('click', function () {
      NS.ui.download('joblens-interview-' + NS.ui.today() + '.md', reportMd);
    });
    document.getElementById('againBtn').addEventListener('click', function () {
      session = null; renderSetup(root);
    });
  }
})(window.JobLens);
