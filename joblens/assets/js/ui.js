/* ============================================================
 * JobLens UI 工具：toast / 模态框 / markdown 渲染 / 下载 / 评分环
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---- 极简 Markdown 渲染（用于 LLM 输出 / 参考答案） ---- */
  function md(src) {
    var t = esc(src);
    // 代码块
    t = t.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, l, c) {
      return '<pre><code>' + c.replace(/\n$/, '') + '</code></pre>';
    });
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // 标题
    t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>')
         .replace(/^## (.+)$/gm, '<h2>$1</h2>')
         .replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // 粗体 / 斜体
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 列表
    t = t.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    t = t.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, function (m) {
      return '<ul>' + m + '</ul>';
    });
    // 换行
    t = t.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
    return '<div class="md"><p>' + t + '</p></div>';
  }

  /* ---- Toast ---- */
  function toast(msg, type, ms) {
    var wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(function () { el.remove(); }, 320);
    }, ms || 2600);
  }

  /* ---- 模态框 ---- */
  function modal(opts) {
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    var actionsHtml = (opts.actions || []).map(function (a, i) {
      return '<button class="btn ' + (a.cls || 'btn-ghost') + '" data-i="' + i + '">' + esc(a.label) + '</button>';
    }).join('');
    mask.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><span>' + esc(opts.title || '') + '</span>' +
          '<button class="close" aria-label="关闭">×</button></div>' +
        '<div class="modal-body"></div>' +
        (actionsHtml ? '<div class="modal-foot">' + actionsHtml + '</div>' : '') +
      '</div>';
    var body = mask.querySelector('.modal-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    function close() { mask.remove(); if (opts.onClose) opts.onClose(); }
    mask.querySelector('.close').addEventListener('click', close);
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    mask.querySelectorAll('.modal-foot .btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = opts.actions[+btn.dataset.i];
        if (a.onClick) { if (a.onClick(close) !== false && !a.keepOpen) close(); }
        else close();
      });
    });
    document.body.appendChild(mask);
    return { close: close, body: body };
  }

  function confirmDlg(msg, danger) {
    return new Promise(function (resolve) {
      modal({
        title: '请确认',
        body: '<p>' + esc(msg) + '</p>',
        actions: [
          { label: '取消', onClick: function () { resolve(false); } },
          { label: danger ? '确认删除' : '确认', cls: danger ? 'btn-danger' : 'btn-primary', onClick: function () { resolve(true); } }
        ]
      });
    });
  }

  /* ---- 文件下载 ---- */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* ---- 当前日期字符串 ---- */
  function today() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  /* ---- 评分环 SVG（含动画） ---- */
  function scoreRing(score, size) {
    size = size || 150;
    var r = (size - 16) / 2, c = 2 * Math.PI * r;
    var color = score >= 75 ? 'var(--good)' : score >= 50 ? 'var(--accent)' : 'var(--bad)';
    var circ = c * (100 - score) / 100;
    return '<div class="score-ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--panel-2)" stroke-width="10"/>' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="10" ' +
          'stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" ' +
          'style="stroke-dashoffset:' + circ + ';transition:stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)"/>' +
      '</svg>' +
      '<div class="score-num"><span class="n" style="color:' + color + '">' + score + '</span><span class="t">匹配度</span></div>' +
    '</div>';
  }

  /* ---- ECharts 可用性 ---- */
  function hasChart() { return typeof window.echarts === 'object' || typeof window.echarts === 'function'; }

  NS.ui = {
    esc: esc, md: md, toast: toast, modal: modal, confirmDlg: confirmDlg,
    download: download, today: today, scoreRing: scoreRing, hasChart: hasChart
  };
})(window.JobLens);
