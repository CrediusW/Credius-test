/* ============================================================
 * 视图：设置 · 数据（引擎切换 / LLM 密钥 / 导入导出）
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';
  NS.views = NS.views || {};

  NS.views.settings = function (root) {
    var esc = NS.ui.esc;
    var s = NS.store.settings();

    function render() {
      s = NS.store.settings();
      var resumes = NS.store.resumes();

      root.innerHTML =
        '<div class="grid-2">' +
          '<div>' +
            /* ---- 引擎 ---- */
            '<div class="card"><div class="card-title">AI 引擎</div>' +
              '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
                '<button class="btn ' + (s.engine === 'local' ? 'btn-primary' : 'btn-ghost') + '" id="engLocal">本地算法引擎</button>' +
                '<button class="btn ' + (s.engine === 'llm' ? 'btn-primary' : 'btn-ghost') + '" id="engLlm">LLM API 引擎</button>' +
              '</div>' +
              '<p class="muted small" style="margin:0">' + (s.engine === 'local'
                ? '零 Key 开箱即用：技能词典 + 词频加权评分；面试用内置题库按参考要点打分。'
                : '语义级匹配与动态出题。未配置时自动降级本地算法。') + '</p>' +
            '</div>' +

            /* ---- LLM 配置 ---- */
            '<div class="card"><div class="card-title">LLM 配置' +
              '<span class="spacer"></span><button class="btn btn-ghost btn-sm" id="testBtn">测试连接</button></div>' +
              '<label class="field"><span>API Base URL（OpenAI 兼容）</span>' +
                '<input type="url" id="llmBase" value="' + esc(s.llm.baseUrl) + '" placeholder="https://api.openai.com/v1"></label>' +
              '<label class="field"><span>API Key（仅保存在本浏览器）</span>' +
                '<input type="password" id="llmKey" value="' + esc(s.llm.apiKey) + '" placeholder="sk-…"></label>' +
              '<div class="row"><label class="field"><span>模型名</span>' +
                '<input type="text" id="llmModel" value="' + esc(s.llm.model) + '" placeholder="gpt-4o-mini / deepseek-chat / …"></label></div>' +
              '<label class="field"><span>代理地址（可选，优先于上面两项）</span>' +
                '<input type="url" id="llmProxy" value="' + esc(s.llm.proxyUrl) + '" placeholder="https://joblens-proxy.<你的子域>.workers.dev"></label>' +
              '<details class="algo"><summary>Key 安全说明（必读）</summary>' +
                '<p>纯静态站没有后端，Key 只能存在你的浏览器里（<code>localStorage</code>），<b>不会写入 Git 仓库；调用模型时会作为认证信息发送到你配置的服务</b>。两种用法：<br>' +
                '① <b>自带 Key</b>：本机或自己账号下使用，克隆本项目的访客各自填自己的 Key；<br>' +
                '② <b>代理模式</b>：部署一个 Cloudflare Worker 转发请求，Key 藏在服务端，访客免配置。' +
                '请仅使用可信的 HTTPS 模型地址或代理地址。</p>' +
              '</details>' +
            '</div>' +
          '</div>' +

          '<div>' +
            /* ---- 数据管理 ---- */
            '<div class="card"><div class="card-title">数据管理</div>' +
              '<p class="muted small">简历、作品集与历史保存在你的账号下，登录后可跨设备使用。备份不包含模型密钥。</p>' +
              '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
                '<button class="btn btn-ghost btn-sm" id="exportAllBtn">导出全部数据 (JSON)</button>' +
                '<button class="btn btn-ghost btn-sm" id="importBtn">导入备份</button>' +
                '<input type="file" id="importFile" accept=".json" style="display:none">' +
              '</div>' +
              '<label class="field"><span>导出简历为 Markdown</span>' +
                '<select id="mdResumeSel">' +
                  '<option value="">— 选择简历 —</option>' +
                  resumes.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join('') +
                '</select></label>' +
              '<button class="btn btn-ghost btn-sm" id="exportMdBtn" style="margin-bottom:16px">导出选中简历</button>' +
              '<hr style="border:none;border-top:1px solid var(--border);margin:14px 0">' +
              '<button class="btn btn-danger btn-sm" id="clearBtn">清空我的求职数据</button>' +
            '</div>' +

            /* ---- 关于 ---- */
            '<div class="card"><div class="card-title">关于 JobLens · 职透</div>' +
              '<p class="muted small">本地算法 · 个人空间 · 站长提供的在线 AI 的开源 AI 求职驾驶舱。<br>' +
              'JD 匹配（本地算法 ⇄ LLM 双引擎）· AI 模拟面试 · 作品集雷达。<br>' +
              '技术栈：原生 JavaScript + ECharts + pdf.js，无任何构建工具与框架依赖。</p>' +
              '<p class="faint small">v1.0 · 2026-09 · 用作品说话</p>' +
            '</div>' +
          '</div>' +
        '</div>';

      bind();
      if(window.Wenfeng){ document.getElementById('llmKey').closest('.card').hidden=true; document.getElementById('engLlm').disabled=!window.Wenfeng.user.ai; document.getElementById('engLlm').textContent=window.Wenfeng.user.ai ? '站长提供的 AI' : 'AI 尚未接通'; }
    }

    function saveLlm() {
      s.llm.baseUrl = document.getElementById('llmBase').value.trim() || s.llm.baseUrl;
      s.llm.apiKey = document.getElementById('llmKey').value.trim();
      s.llm.model = document.getElementById('llmModel').value.trim() || s.llm.model;
      s.llm.proxyUrl = document.getElementById('llmProxy').value.trim();
      NS.store.saveSettings(s);
    }

    function bind() {
      document.getElementById('engLocal').addEventListener('click', function () {
        s.engine = 'local'; NS.store.saveSettings(s); NS.ui.toast('已切换：本地算法引擎', 'good'); render();
      });
      document.getElementById('engLlm').addEventListener('click', function () {
        saveLlm();
        s.engine = 'llm'; NS.store.saveSettings(s);
        NS.ui.toast(NS.ai.llmReady() ? '已切换：LLM 引擎' : '已切换 LLM，但还没配置 Key/代理，会自动降级本地', NS.ai.llmReady() ? 'good' : '', 3500);
        render();
      });

      ['llmBase', 'llmKey', 'llmModel', 'llmProxy'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', function () { saveLlm(); NS.ui.toast('LLM 配置已保存'); });
      });

      document.getElementById('testBtn').addEventListener('click', async function () {
        saveLlm();
        var btn = this;
        btn.disabled = true; btn.textContent = '测试中…';
        try {
          var r = await NS.ai.testConnection();
          NS.ui.toast('连接成功（' + r.ms + 'ms）：' + r.reply, 'good', 4000);
        } catch (e) {
          NS.ui.toast('连接失败：' + e.message, 'bad', 5000);
        } finally { btn.disabled = false; btn.textContent = '测试连接'; }
      });

      document.getElementById('exportAllBtn').addEventListener('click', function () {
        NS.ui.download('joblens-backup-' + NS.ui.today() + '.json', JSON.stringify(NS.store.exportAll(), null, 2), 'application/json');
      });
      document.getElementById('importBtn').addEventListener('click', function () {
        document.getElementById('importFile').click();
      });
      document.getElementById('importFile').addEventListener('change', function () {
        var f = this.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try { NS.store.importAll(JSON.parse(fr.result)); NS.ui.toast('导入成功', 'good'); render(); }
          catch (e) { NS.ui.toast('导入失败：' + e.message, 'bad', 4000); }
        };
        fr.readAsText(f);
      });
      document.getElementById('exportMdBtn').addEventListener('click', function () {
        var id = document.getElementById('mdResumeSel').value;
        var r = NS.store.resumes().find(function (x) { return x.id === id; });
        if (!r) { NS.ui.toast('先选择一份简历', 'bad'); return; }
        NS.ui.download(r.name + '-resume.md', resumeToMd(r));
      });
      document.getElementById('clearBtn').addEventListener('click', async function () {
        if (await NS.ui.confirmDlg('清空全部本地数据（简历 / 作品集修改 / 历史 / 设置）？此操作不可恢复。', true)) {
          NS.store.clearAll();
          NS.ui.toast('已清空，页面即将刷新');
          setTimeout(function () { location.reload(); }, 900);
        }
      });
    }

    function resumeToMd(r) {
      if (r.type === 'raw') return '# ' + r.name + '\n\n```\n' + r.data + '\n```';
      var d = r.data || {}, b = d.basic || {};
      var out = ['# ' + (b.name || r.name) + (b.title ? '\n\n> ' + b.title : '')];
      if (b.location) out.push(b.location);
      if (b.summary) out.push('', '## 简介', '', b.summary);
      if (d.education && d.education.length) {
        out.push('', '## 教育经历');
        d.education.forEach(function (e) { out.push('- **' + e.school + '** · ' + (e.major || '') + ' · ' + (e.period || '')); });
      }
      if (d.projects && d.projects.length) {
        out.push('', '## 项目经历');
        d.projects.forEach(function (p) {
          out.push('', '### ' + p.title + (p.period ? '（' + p.period + '）' : '') + (p.role ? ' · ' + p.role : ''), '', p.desc || '');
          if (p.tech && p.tech.length) out.push('技术栈：' + p.tech.join('、'));
        });
      }
      if (d.skills && d.skills.length) out.push('', '## 技能', '', d.skills.join('、'));
      if (d.awards && d.awards.length) out.push('', '## 荣誉奖项', '', d.awards.map(function (a) { return '- ' + a; }).join('\n'));
      out.push('', '---', '> 由 JobLens · 职透 导出');
      return out.join('\n');
    }

    render();
  };
})(window.JobLens || {});
