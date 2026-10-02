/* ============================================================
 * 视图：JD 智能匹配
 *   三种简历入口（PDF / 粘贴文本 / 结构化表单）→ 统一数据结构 → 双引擎评分
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';
  NS.views = NS.views || {};

  var esc = NS.ui.esc;
  var lastResult = null, lastJd = '';

  NS.views.match = function (root) {
    render();

    function currentResume() {
      var list = NS.store.resumes();
      if (!list.length) return null;
      var id = NS.store.currentResumeId();
      return list.find(function (r) { return r.id === id; }) || list[0];
    }

    function render() {
      var resumes = NS.store.resumes();
      var cur = currentResume();
      var hist = NS.store.matchHistory();

      root.innerHTML =
        '<div class="grid-2">' +

          /* ---- 左：简历 ---- */
          '<div>' +
          '<div class="card"><div class="card-title">① 我的简历<span class="spacer"></span>' +
            '<span class="src-badge">' + (NS.ai.engine() === 'llm' ? '引擎：' + esc(NS.ai.modelName()) : '引擎：本地算法') + '</span></div>' +
            (cur
              ? '<div class="notice accent" style="margin-bottom:12px"><b>' + esc(cur.name) + '</b> · ' +
                (cur.type === 'raw' ? '纯文本' : '结构化') + ' · 更新于 ' + esc(cur.updatedAt || '') + '</div>' +
                '<div class="small muted" style="max-height:130px;overflow:auto;background:var(--panel-2);border-radius:10px;padding:10px 14px">' +
                esc(NS.store.resumeText(cur).slice(0, 400)) + '…</div>'
              : '<div class="notice">还没有简历。选一种方式创建：</div>') +
            '<div class="row" style="margin-top:14px">' +
              '<button class="btn btn-primary btn-sm" id="addPdfBtn">上传 PDF</button>' +
              '<button class="btn btn-ghost btn-sm" id="addTextBtn">粘贴文本</button>' +
              '<button class="btn btn-ghost btn-sm" id="addFormBtn">结构化表单</button>' +
              '<button class="btn btn-ghost btn-sm" id="manageResumeBtn">管理 (' + resumes.length + ')</button>' +
            '</div>' +
          '</div>' +

          /* ---- 左下：JD ---- */
          '<div class="card"><div class="card-title">② 岗位描述 JD' +
            '<span class="spacer"></span><button class="btn btn-ghost btn-sm" id="sampleJdBtn">填入示例</button></div>' +
            '<textarea id="jdInput" style="min-height:230px" placeholder="把招聘启事整段粘贴进来，越完整评分越准…">' + esc(lastJd) + '</textarea>' +
            (hist.length ? '<div style="margin-top:10px"><span class="faint small">历史：</span>' + hist.slice(0, 6).map(function (h, i) {
              return '<span class="chip clickable info" data-hist="' + i + '" style="margin:2px">' + esc(h.jdTitle) + ' · ' + h.score + '分</span>';
            }).join('') + '</div>' : '') +
            '<div style="margin-top:16px;display:flex;gap:10px;align-items:center">' +
              '<button class="btn btn-primary" id="runMatchBtn" style="flex:1">⚡ 开始匹配分析</button>' +
            '</div>' +
            '<p class="faint small" style="margin:10px 0 0">本地算法不上传文本；选择 LLM 引擎后，简历与 JD 会发送到你配置的模型服务。</p>' +
          '</div>' +
          '</div>' +

          /* ---- 右：结果 ---- */
          '<div id="resultPanel"><div class="card"><div class="card-title">匹配报告</div>' +
            '<p class="muted">粘贴 JD 并选择简历后，这里会生成：匹配度评分、维度分析、命中/缺失技能清单、改简历建议。</p>' +
            '<details class="algo"><summary>本地算法评分原理（可展开）</summary>' +
              '<p>① 用内置技能词典（中英别名）扫描 JD，词频加权：<code>权重 = 基础权重 × (1 + ln(1+词频))</code>；<br>' +
              '② 同法扫描简历，统计 JD 技能的命中比例：<code>coverage = Σ命中权重 / Σ全部权重</code>；<br>' +
              '③ 简历厚度信号 <code>evidence = min(1, 字数/1800)</code>，最多给 ±10% 加成；<br>' +
              '④ 最终分 <code>score = 100 × coverage × (0.9 + 0.1×evidence)</code>。</p>' +
              '<p>LLM 引擎则做语义级理解（能看懂"调过 GPT"≈"用过大模型 API"），本地算法做字面级匹配，两者互补。</p>' +
            '</details>' +
          '</div></div>' +
        '</div>';

      bind();
    }

    /* ==================== 匹配执行 ==================== */
    async function runMatch() {
      var jd = document.getElementById('jdInput').value.trim();
      var cur = currentResume();
      if (!jd) { NS.ui.toast('请先粘贴岗位描述 JD', 'bad'); return; }
      if (!cur) { NS.ui.toast('请先创建一份简历', 'bad'); return; }
      lastJd = jd;

      var btn = document.getElementById('runMatchBtn');
      btn.disabled = true; btn.textContent = '分析中…（本地约 1 秒 / LLM 视网络）';

      var rText = NS.store.resumeText(cur);
      try {
        var result = await NS.ai.matchJD(jd, rText);
        lastResult = { result: result, jd: jd, resumeName: cur.name };
        renderResult(result);

        var hist = NS.store.matchHistory();
        hist.unshift({
          jdTitle: jd.slice(0, 14).replace(/\n/g, ' '), jd: jd, score: result.score,
          date: new Date().toISOString().slice(0, 10), source: result.source
        });
        NS.store.matchHistory(hist);
      } catch (e) {
        NS.ui.toast('分析失败：' + e.message, 'bad', 4000);
      } finally {
        btn.disabled = false; btn.textContent = '⚡ 开始匹配分析';
      }
    }

    function renderResult(r) {
      var panel = document.getElementById('resultPanel');
      if (!panel) return;

      var dimRows = r.dims.map(function (d) {
        return '<div class="dim-row"><span class="dim-name">' + esc(d.name) + '</span>' +
          '<div class="dim-bar"><div class="dim-fill" style="width:' + d.score + '%"></div></div>' +
          '<span class="dim-val">' + d.score + '</span></div>';
      }).join('');

      panel.innerHTML =
        '<div class="card">' +
          '<div class="card-title">匹配报告 <span class="src-badge" title="本次评分来源">来源：' + esc(r.source) + '</span>' +
          '<span class="spacer"></span><button class="btn btn-ghost btn-sm" id="exportReportBtn">导出 Markdown</button></div>' +
          (r.warning ? '<div class="notice bad">' + esc(r.warning) + '</div>' : '') +
          '<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">' +
            NS.ui.scoreRing(r.score) +
            '<div style="flex:1;min-width:240px">' + dimRows + '</div>' +
          '</div>' +
          (r.summary ? '<p class="muted" style="margin-top:14px">' + esc(r.summary) + '</p>' : '') +
        '</div>' +

        '<div class="grid-2">' +
          '<div class="card"><div class="card-title">✓ 简历已命中（' + r.matched.length + '）</div>' +
            (r.matched.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
              r.matched.map(function (m) { return '<span class="chip good">' + esc(m) + '</span>'; }).join('') + '</div>'
              : '<p class="muted small">无命中——检查简历是否用了 JD 的关键词表达。</p>') + '</div>' +
          '<div class="card"><div class="card-title">✗ 缺失项（' + r.missing.length + '）</div>' +
            (r.missing.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
              r.missing.map(function (m) { return '<span class="chip bad">' + esc(m) + '</span>'; }).join('') + '</div>'
              : '<p class="muted small">岗位要求的技能简历全部覆盖，很强。</p>') + '</div>' +
        '</div>' +

        '<div class="card"><div class="card-title">改简历建议</div>' +
          '<div class="md"><ul>' + r.suggestions.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' +
        '</div>';

      document.getElementById('exportReportBtn').addEventListener('click', function () {
        exportReport(r);
      });
    }

    function exportReport(r) {
      var md = [
        '# JobLens 匹配报告', '',
        '- 日期：' + new Date().toLocaleString('zh-CN'),
        '- 评分：**' + r.score + ' / 100**（来源：' + r.source + '）', '',
        '## 维度得分',
        r.dims.map(function (d) { return '- ' + d.name + '：' + d.score; }).join('\n'), '',
        '## 已命中技能', (r.matched.join('、') || '无'), '',
        '## 缺失技能', (r.missing.join('、') || '无'), '',
        '## 建议',
        r.suggestions.map(function (s) { return '- ' + s; }).join('\n'), '',
        '---', '> 由 JobLens · 职透 生成（github.com/CrediusW/joblens）'
      ].join('\n');
      NS.ui.download('joblens-report-' + NS.ui.today() + '.md', md);
    }

    /* ==================== 简历管理 ==================== */
    function manageResumes() {
      var list = NS.store.resumes();
      var body = document.createElement('div');
      body.innerHTML = list.length
        ? list.map(function (r) {
            return '<div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">' +
              '<div><b>' + esc(r.name) + '</b> <span class="faint small">· ' + (r.type === 'raw' ? '纯文本' : '结构化') + ' · ' + esc(r.updatedAt || '') + '</span></div>' +
              '<div><button class="btn btn-ghost btn-sm" data-use="' + r.id + '">使用</button> ' +
              '<button class="btn btn-danger btn-sm" data-del="' + r.id + '">删除</button></div></div>';
          }).join('')
        : '<p class="muted">还没有简历，用左上角三种入口创建。</p>';

      var m = NS.ui.modal({ title: '简历管理', body: body, actions: [{ label: '关闭' }] });
      body.addEventListener('click', async function (e) {
        var use = e.target.getAttribute && e.target.getAttribute('data-use');
        var del = e.target.getAttribute && e.target.getAttribute('data-del');
        if (use) { NS.store.currentResumeId(use); NS.ui.toast('已切换当前简历', 'good'); m.close(); render(); }
        if (del) {
          if (await NS.ui.confirmDlg('删除这份简历？', true)) {
            NS.store.deleteResume(del); m.close(); render();
          }
        }
      });
    }

    /* ---- 入口一：上传 PDF ---- */
    function addPdf() {
      var body = document.createElement('div');
      body.innerHTML =
        '<div id="dropZone" style="border:2px dashed var(--border-strong);border-radius:14px;padding:36px;text-align:center;cursor:pointer;transition:border-color .2s">' +
          '<p class="muted" style="margin:0">点击选择或拖入简历 PDF<br><span class="small faint">文件仅在浏览器内解析，不会上传</span></p></div>' +
        '<input type="file" id="pdfFile" accept=".pdf" style="display:none">' +
        '<div id="pdfStatus" style="margin-top:12px"></div>' +
        '<label class="field" style="display:none;margin-top:12px" id="pdfNameWrap"><span>简历命名</span><input type="text" id="pdfName" value="我的简历(PDF)"></label>';

      var zone = body.querySelector('#dropZone');
      var fileInput = body.querySelector('#pdfFile');
      var extracted = '';
      zone.addEventListener('click', function () { fileInput.click(); });
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
      zone.addEventListener('dragleave', function () { zone.style.borderColor = ''; });
      zone.addEventListener('drop', function (e) { e.preventDefault(); zone.style.borderColor = ''; handleFile(e.dataTransfer.files[0]); });
      fileInput.addEventListener('change', function () { handleFile(fileInput.files[0]); });

      async function handleFile(file) {
        if (!file) return;
        var st = body.querySelector('#pdfStatus');
        if (!/\.pdf$/i.test(file.name)) { st.innerHTML = '<div class="notice bad">只支持 PDF 文件</div>'; return; }
        st.innerHTML = '<div class="notice info">正在解析「' + esc(file.name) + '」…</div>';
        try {
          extracted = await NS.pdfToText(file);
          body.querySelector('#pdfNameWrap').style.display = 'block';
          body.querySelector('#pdfName').value = file.name.replace(/\.pdf$/i, '');
          st.innerHTML = '<div class="notice">✓ 解析成功，共 ' + extracted.length + ' 字。确认命名后保存。</div>';
        } catch (e) {
          st.innerHTML = '<div class="notice bad">' + esc(e.message) + '</div>';
        }
      }

      NS.ui.modal({
        title: '上传 PDF 简历', body: body,
        actions: [
          { label: '取消' },
          { label: '保存简历', cls: 'btn-primary', onClick: function () {
              if (!extracted) { NS.ui.toast('请先成功解析一个 PDF', 'bad'); return false; }
              NS.store.saveResume({ type: 'raw', name: body.querySelector('#pdfName').value.trim() || 'PDF 简历', data: extracted });
              NS.ui.toast('简历已保存', 'good');
              render();
            } }
        ]
      });
    }

    /* ---- 入口二：粘贴文本 ---- */
    function addText() {
      var body = document.createElement('div');
      body.innerHTML =
        '<label class="field"><span>简历命名</span><input type="text" id="rawName" placeholder="我的简历"></label>' +
        '<label class="field"><span>简历全文</span><textarea id="rawText" style="min-height:300px" placeholder="把简历内容整段贴进来（Markdown 或纯文本都行）"></textarea></label>';
      NS.ui.modal({
        title: '粘贴文本简历', body: body,
        actions: [
          { label: '取消' },
          { label: '保存', cls: 'btn-primary', onClick: function () {
              var t = body.querySelector('#rawText').value.trim();
              if (!t) { NS.ui.toast('内容为空', 'bad'); return false; }
              NS.store.saveResume({ type: 'raw', name: body.querySelector('#rawName').value.trim() || '文本简历', data: t });
              NS.ui.toast('简历已保存', 'good');
              render();
            } }
        ]
      });
    }

    /* ---- 入口三：结构化表单 ---- */
    function addForm() {
      var body = document.createElement('div');
      var eduCount = 1, projCount = 1;
      body.innerHTML =
        '<div class="row"><label class="field"><span>姓名</span><input type="text" id="stName"></label>' +
        '<label class="field"><span>求职意向 / 头衔</span><input type="text" id="stTitle" placeholder="AI 应用方向 · 在校生"></label></div>' +
        '<div class="row"><label class="field"><span>城市</span><input type="text" id="stLoc"></label>' +
        '<label class="field"><span>一句话简介</span><input type="text" id="stSum"></label></div>' +
        '<h4>教育经历</h4><div id="eduRows"></div><button class="btn btn-ghost btn-sm" id="addEdu" style="margin-bottom:12px">+ 加一段</button>' +
        '<h4>项目 / 实习经历</h4><div id="projRows"></div><button class="btn btn-ghost btn-sm" id="addProj" style="margin-bottom:12px">+ 加一段</button>' +
        '<label class="field"><span>技能（逗号分隔）</span><input type="text" id="stSkills" placeholder="Python, RAG, Prompt 工程, ECharts"></label>' +
        '<label class="field"><span>荣誉奖项（每行一条，可空）</span><textarea id="stAwards" style="min-height:70px"></textarea></label>';

      function eduRow() {
        var div = document.createElement('div');
        div.className = 'row';
        div.innerHTML =
          '<label class="field"><span>学校</span><input type="text" class="edu-school"></label>' +
          '<label class="field"><span>专业 / 学位</span><input type="text" class="edu-major"></label>' +
          '<label class="field"><span>时间</span><input type="text" class="edu-period" placeholder="2023.09 - 2027.06"></label>';
        body.querySelector('#eduRows').appendChild(div);
      }
      function projRow() {
        var div = document.createElement('div');
        div.style.border = '1px solid var(--border)'; div.style.borderRadius = '12px';
        div.style.padding = '12px 14px'; div.style.marginBottom = '10px';
        div.innerHTML =
          '<div class="row"><label class="field"><span>项目名</span><input type="text" class="pj-title"></label>' +
          '<label class="field"><span>角色</span><input type="text" class="pj-role"></label>' +
          '<label class="field"><span>时间</span><input type="text" class="pj-period"></label></div>' +
          '<label class="field"><span>描述与成果</span><textarea class="pj-desc" style="min-height:70px"></textarea></label>' +
          '<label class="field"><span>技术栈（逗号分隔）</span><input type="text" class="pj-tech"></label>';
        body.querySelector('#projRows').appendChild(div);
      }
      eduRow(); projRow();
      body.querySelector('#addEdu').addEventListener('click', eduRow);
      body.querySelector('#addProj').addEventListener('click', projRow);

      NS.ui.modal({
        title: '结构化简历', body: body,
        actions: [
          { label: '取消' },
          { label: '保存', cls: 'btn-primary', onClick: function () {
              var name = body.querySelector('#stName').value.trim() || '我的简历';
              var data = {
                basic: {
                  name: name, title: body.querySelector('#stTitle').value.trim(),
                  location: body.querySelector('#stLoc').value.trim(), summary: body.querySelector('#stSum').value.trim()
                },
                education: [].map.call(body.querySelectorAll('#eduRows .row'), function (r) {
                  return {
                    school: r.querySelector('.edu-school').value.trim(),
                    major: r.querySelector('.edu-major').value.trim(),
                    period: r.querySelector('.edu-period').value.trim()
                  };
                }).filter(function (e) { return e.school; }),
                projects: [].map.call(body.querySelectorAll('#projRows > div'), function (r) {
                  return {
                    title: r.querySelector('.pj-title').value.trim(),
                    role: r.querySelector('.pj-role').value.trim(),
                    period: r.querySelector('.pj-period').value.trim(),
                    desc: r.querySelector('.pj-desc').value.trim(),
                    tech: r.querySelector('.pj-tech').value.split(/[,，、]/).map(function (t) { return t.trim(); }).filter(Boolean)
                  };
                }).filter(function (p) { return p.title; }),
                skills: body.querySelector('#stSkills').value.split(/[,，、]/).map(function (t) { return t.trim(); }).filter(Boolean),
                awards: body.querySelector('#stAwards').value.split('\n').map(function (t) { return t.trim(); }).filter(Boolean)
              };
              NS.store.saveResume({ type: 'structured', name: name, data: data });
              NS.ui.toast('简历已保存', 'good');
              render();
            } }
        ]
      });
    }

    /* ==================== 事件绑定 ==================== */
    function bind() {
      document.getElementById('addPdfBtn').addEventListener('click', addPdf);
      document.getElementById('addTextBtn').addEventListener('click', addText);
      document.getElementById('addFormBtn').addEventListener('click', addForm);
      document.getElementById('manageResumeBtn').addEventListener('click', manageResumes);
      document.getElementById('runMatchBtn').addEventListener('click', runMatch);
      document.getElementById('sampleJdBtn').addEventListener('click', function () {
        lastJd = NS.SAMPLE_JD; // 先记住：下方 render() 会用它恢复输入框
        document.getElementById('jdInput').value = NS.SAMPLE_JD;
        if (!NS.store.resumes().length) {
          NS.store.saveResume({ type: 'raw', name: '示例简历（非个人真实经历）', data: NS.SAMPLE_RESUME });
          NS.ui.toast('已填入示例 JD，并创建了一份示例简历', 'good');
          render();
        } else {
          NS.ui.toast('已填入示例 JD');
        }
      });
      root.querySelectorAll('[data-hist]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var h = NS.store.matchHistory()[+chip.dataset.hist];
          if (h) { document.getElementById('jdInput').value = h.jd; NS.ui.toast('已载入历史 JD（' + h.score + '分）'); }
        });
      });
    }
  };
})(window.JobLens);
