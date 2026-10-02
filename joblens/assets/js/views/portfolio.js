/* ============================================================
 * 视图：作品集与能力雷达（招聘方 30 秒看的门面，数据可在线编辑）
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';
  NS.views = NS.views || {};

  NS.views.portfolio = function (root) {
    var esc = NS.ui.esc;

    function cssVar(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function render() {
      var p = NS.store.portfolio();
      var contacts = (p.contacts || []).map(function (c) {
        return '<span class="chip accent">' + esc(c.label) + '：' + esc(c.value) + '</span>';
      }).join(' ');

      var projects = (p.projects || []).map(function (pr, i) {
        return '<div class="tl-item card hoverable" style="margin-bottom:14px">' +
          '<div class="flex-between"><h3 class="mt0" style="margin-bottom:4px">' + esc(pr.title) + '</h3>' +
          '<span class="tl-meta">' + esc(pr.period || '') + (pr.role ? ' · ' + esc(pr.role) : '') + '</span></div>' +
          '<p class="muted small" style="margin:6px 0 10px">' + esc(pr.desc) + '</p>' +
          '<div>' + (pr.tech || []).map(function (t) { return '<span class="chip violet" style="margin:2px 4px 2px 0">' + esc(t) + '</span>'; }).join('') + '</div>' +
          (/^https?:\/\//i.test(pr.link || '') ? '<div class="small" style="margin-top:8px"><a href="' + esc(pr.link) + '" target="_blank" rel="noopener">查看项目 →</a></div>' : '') +
          '<div class="proj-ops" style="display:none;margin-top:10px">' +
            '<button class="btn btn-ghost btn-sm" data-edit-proj="' + i + '">编辑</button> ' +
            '<button class="btn btn-danger btn-sm" data-del-proj="' + i + '">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');

      root.innerHTML =
        '<div class="card" style="background:linear-gradient(135deg,var(--accent-soft),transparent 55%)">' +
          '<div class="flex-between">' +
            '<div><h2 style="margin-bottom:4px">' + esc(p.name) + ' <span class="faint" style="font-weight:400;font-size:15px">· ' + esc(p.title || '') + '</span></h2>' +
            '<div class="small muted">' + esc(p.location || '') + '</div></div>' +
            '<div><button class="btn btn-ghost btn-sm" id="editProfileBtn">编辑资料</button> ' +
            '<button class="btn btn-ghost btn-sm" id="editSkillsBtn">编辑技能</button> ' +
            '<button class="btn btn-primary btn-sm" id="addProjBtn">+ 新增项目</button></div>' +
          '</div>' +
          '<p style="margin:12px 0 10px">' + esc(p.summary || '') + '</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' + contacts + '</div>' +
        '</div>' +

        '<div class="grid-2">' +
          '<div class="card"><div class="card-title">能力雷达<button class="btn btn-ghost btn-sm" id="editSkillsBtn2">调整</button></div>' +
            '<div id="radarBox" class="chart-sm"></div></div>' +
          '<div class="card"><div class="card-title">技能明细</div><div id="skillBars"></div></div>' +
        '</div>' +

        '<div class="card"><div class="card-title">项目时间线' +
          '<span class="spacer"></span><button class="btn btn-ghost btn-sm" id="toggleProjOps">管理</button></div>' +
          '<div class="timeline">' + (projects || '<p class="muted">暂无项目，点右上角新增。</p>') + '</div>' +
        '</div>';

      drawRadar(p.skills || []);
      drawBars(p.skills || []);
      bind(p);
    }

    function drawRadar(skills) {
      var box = document.getElementById('radarBox');
      if (!box) return;
      if (!NS.ui.hasChart() || !skills.length) {
        box.innerHTML = '<p class="muted small">图表组件未加载或暂无技能数据（联网后刷新即可看到雷达图）。</p>';
        return;
      }
      var chart = echarts.init(box);
      chart.setOption({
        radar: {
          indicator: skills.map(function (s) { return { name: s.name, max: 100 }; }),
          radius: '68%',
          axisName: { color: cssVar('--muted'), fontSize: 12 },
          splitLine: { lineStyle: { color: cssVar('--border') } },
          splitArea: { show: false },
          axisLine: { lineStyle: { color: cssVar('--border') } }
        },
        tooltip: {},
        series: [{
          type: 'radar',
          data: [{
            value: skills.map(function (s) { return s.level; }),
            name: '能力',
            areaStyle: { color: cssVar('--accent'), opacity: .25 },
            lineStyle: { color: cssVar('--accent'), width: 2 },
            itemStyle: { color: cssVar('--accent') }
          }]
        }]
      });
      window.addEventListener('resize', function () { chart.resize(); });
    }

    function drawBars(skills) {
      var box = document.getElementById('skillBars');
      if (!box) return;
      box.innerHTML = skills.length
        ? skills.map(function (s) {
            return '<div class="dim-row"><span class="dim-name">' + esc(s.name) + '</span>' +
              '<div class="dim-bar"><div class="dim-fill" style="width:' + s.level + '%"></div></div>' +
              '<span class="dim-val">' + s.level + '</span></div>';
          }).join('')
        : '<p class="muted small">暂无技能数据。</p>';
    }

    /* ---------- 编辑：个人资料 ---------- */
    function editProfile() {
      var p = NS.store.portfolio();
      var body = document.createElement('div');
      body.innerHTML =
        '<label class="field"><span>姓名</span><input type="text" id="pfName" value="' + esc(p.name) + '"></label>' +
        '<label class="field"><span>一句话头衔</span><input type="text" id="pfTitle" value="' + esc(p.title || '') + '"></label>' +
        '<label class="field"><span>城市</span><input type="text" id="pfLoc" value="' + esc(p.location || '') + '"></label>' +
        '<label class="field"><span>个人简介</span><textarea id="pfSummary">' + esc(p.summary || '') + '</textarea></label>' +
        '<label class="field"><span>联系方式（每行一条：标签, 值）</span><textarea id="pfContacts" placeholder="GitHub, github.com/CrediusW&#10;邮箱, you@example.com">' +
          esc((p.contacts || []).map(function (c) { return c.label + ',' + c.value; }).join('\n')) + '</textarea></label>';

      NS.ui.modal({
        title: '编辑资料', body: body,
        actions: [
          { label: '取消' },
          { label: '保存', cls: 'btn-primary', onClick: function () {
              p.name = body.querySelector('#pfName').value.trim() || '未命名';
              p.title = body.querySelector('#pfTitle').value.trim();
              p.location = body.querySelector('#pfLoc').value.trim();
              p.summary = body.querySelector('#pfSummary').value.trim();
              p.contacts = body.querySelector('#pfContacts').value.split('\n').map(function (l) {
                var parts = l.split(/[,，]/);
                return parts.length >= 2 ? { label: parts[0].trim(), value: parts.slice(1).join(',').trim() } : null;
              }).filter(Boolean);
              NS.store.savePortfolio(p);
              NS.ui.toast('资料已保存', 'good');
              render();
            } }
        ]
      });
    }

    /* ---------- 编辑：技能 ---------- */
    function editSkills() {
      var p = NS.store.portfolio();
      var body = document.createElement('div');
      body.innerHTML =
        '<p class="muted small">每行一条：<kbd>技能名, 熟练度(0-100)</kbd></p>' +
        '<textarea id="pfSkills" style="min-height:220px">' +
          esc((p.skills || []).map(function (s) { return s.name + ',' + s.level; }).join('\n')) +
        '</textarea>';
      NS.ui.modal({
        title: '编辑技能', body: body,
        actions: [
          { label: '取消' },
          { label: '保存', cls: 'btn-primary', onClick: function () {
              p.skills = body.querySelector('#pfSkills').value.split('\n').map(function (l) {
                var parts = l.split(/[,，]/);
                if (parts.length < 2) return null;
                var lv = Math.max(0, Math.min(100, parseInt(parts[1], 10) || 0));
                return { name: parts[0].trim(), level: lv };
              }).filter(function (s) { return s && s.name; });
              NS.store.savePortfolio(p);
              NS.ui.toast('技能已保存', 'good');
              render();
            } }
        ]
      });
    }

    /* ---------- 编辑：项目 ---------- */
    function editProject(idx) {
      var p = NS.store.portfolio();
      var isNew = idx === -1;
      var pr = isNew ? { title: '', period: '', role: '', desc: '', tech: [], link: '' } : p.projects[idx];
      var body = document.createElement('div');
      body.innerHTML =
        '<div class="row"><label class="field"><span>项目名</span><input type="text" id="pjTitle" value="' + esc(pr.title) + '"></label>' +
        '<label class="field"><span>时间段</span><input type="text" id="pjPeriod" value="' + esc(pr.period) + '" placeholder="2026.03 - 至今"></label></div>' +
        '<div class="row"><label class="field"><span>角色</span><input type="text" id="pjRole" value="' + esc(pr.role) + '"></label>' +
        '<label class="field"><span>链接（可选）</span><input type="text" id="pjLink" value="' + esc(pr.link) + '"></label></div>' +
        '<label class="field"><span>项目描述（做了什么 → 怎么做 → 量化结果）</span><textarea id="pjDesc">' + esc(pr.desc) + '</textarea></label>' +
        '<label class="field"><span>技术栈（逗号分隔）</span><input type="text" id="pjTech" value="' + esc((pr.tech || []).join(', ')) + '"></label>';

      NS.ui.modal({
        title: isNew ? '新增项目' : '编辑项目', body: body,
        actions: [
          { label: '取消' },
          { label: '保存', cls: 'btn-primary', onClick: function () {
              var item = {
                title: body.querySelector('#pjTitle').value.trim(),
                period: body.querySelector('#pjPeriod').value.trim(),
                role: body.querySelector('#pjRole').value.trim(),
                desc: body.querySelector('#pjDesc').value.trim(),
                link: body.querySelector('#pjLink').value.trim(),
                tech: body.querySelector('#pjTech').value.split(/[,，、]/).map(function (t) { return t.trim(); }).filter(Boolean)
              };
              if (!item.title) { NS.ui.toast('项目名不能为空', 'bad'); return false; }
              if (isNew) p.projects.push(item); else p.projects[idx] = item;
              NS.store.savePortfolio(p);
              NS.ui.toast('项目已保存', 'good');
              render();
            } }
        ]
      });
    }

    function bind(p) {
      document.getElementById('editProfileBtn').addEventListener('click', editProfile);
      document.getElementById('editSkillsBtn').addEventListener('click', editSkills);
      document.getElementById('editSkillsBtn2').addEventListener('click', editSkills);
      document.getElementById('addProjBtn').addEventListener('click', function () { editProject(-1); });

      var toggled = false;
      document.getElementById('toggleProjOps').addEventListener('click', function () {
        toggled = !toggled;
        root.querySelectorAll('.proj-ops').forEach(function (el) { el.style.display = toggled ? 'block' : 'none'; });
        this.textContent = toggled ? '完成' : '管理';
      });
      root.querySelectorAll('[data-edit-proj]').forEach(function (b) {
        b.addEventListener('click', function () { editProject(+b.dataset.editProj); });
      });
      root.querySelectorAll('[data-del-proj]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var i = +b.dataset.delProj;
          if (await NS.ui.confirmDlg('删除项目「' + p.projects[i].title + '」？', true)) {
            p.projects.splice(i, 1);
            NS.store.savePortfolio(p);
            render();
          }
        });
      });
    }

    render();
  };
})(window.JobLens);
