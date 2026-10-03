/* ============================================================
 * JobLens 主入口：hash 路由 + 导航态 + 主题切换
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';

  var ROUTES = {
    portfolio: NS.views && NS.views.portfolio,
    match: NS.views && NS.views.match,
    interview: NS.views && NS.views.interview,
    settings: NS.views && NS.views.settings
  };
  var THEME_LABEL = { dark: '深色', light: '浅色', system: '跟随系统' };
  var THEME_ORDER = ['dark', 'light', 'system'];

  function currentRoute() {
    var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES[h] ? h : 'match';
  }

  function render() {
    var route = currentRoute();
    var app = document.getElementById('app');
    app.innerHTML = '';
    document.querySelectorAll('#nav a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === route);
    });
    try {
      ROUTES[route](app);
    } catch (e) {
      app.innerHTML = '<div class="card"><div class="card-title">页面出错了</div>' +
        '<p class="muted">' + NS.ui.esc(e.message) + '</p>' +
        '<p class="small faint">' + NS.ui.esc(e.stack || '').split('\n').slice(0, 4).join('<br>') + '</p></div>';
      console.error(e);
    }
    window.scrollTo(0, 0);
  }

  function initTheme() {
    var btn = document.getElementById('themeBtn');
    function label() {
      var t = document.documentElement.getAttribute('data-theme') || 'light';
      btn.textContent = THEME_LABEL[t] || t;
    }
    btn.addEventListener('click', function () {
      var t = document.documentElement.getAttribute('data-theme') || 'light';
      var next = THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('jl:theme', next); } catch (e) {}
      label();
      /* 主题切换后重绘当前页（图表颜色依赖 CSS 变量） */
      render();
    });
    label();
  }

  function init() {
    if (window.Wenfeng && !window.Wenfeng.loaded) { window.Wenfeng.ready.then(init).catch(function(){}); return; }
    if (window.__echartsFailed) NS.ui.toast('图表组件加载失败（离线？），图表将降级为文字条', '', 4000);
    if (window.__pdfFailed) NS.ui.toast('PDF 组件加载失败（离线？），PDF 上传暂不可用', '', 4000);
    initTheme();
    window.addEventListener('hashchange', render);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.JobLens);
