/* ============================================================
 * JobLens 存储层：localStorage 封装（浏览器本地保存）
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';

  var PREFIX = 'jl:';

  function lsGet(key, def) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return def;
      return JSON.parse(raw);
    } catch (e) { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; }
    catch (e) {
      if (NS.ui && NS.ui.toast) NS.ui.toast('本地存储失败：' + e.message, 'bad');
      return false;
    }
  }
  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var DEFAULT_SETTINGS = {
    engine: 'local',                       // 'local' | 'llm'
    llm: {
      baseUrl: 'https://api.openai.com/v1', // OpenAI 兼容地址（DeepSeek/Kimi/通义均可改）
      apiKey: '',                           // 仅存本浏览器，不随仓库分发
      model: 'gpt-4o-mini',
      proxyUrl: ''                          // 填了则走代理（Key 藏服务端），优先于 baseUrl+key
    }
  };

  NS.store = {
    /* ---- 通用 ---- */
    get: lsGet,
    set: lsSet,

    /* ---- 设置 ---- */
    settings: function () {
      var s = lsGet('settings', null);
      if (!s) { s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); lsSet('settings', s); }
      // 兼容旧结构
      if (!s.llm) s.llm = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.llm));
      return s;
    },
    saveSettings: function (s) { lsSet('settings', s); },

    /* ---- 简历（统一数据结构：structured 结构化 / raw 纯文本） ---- */
    resumes: function () { return lsGet('resumes', []); },
    saveResume: function (resume) {
      var list = lsGet('resumes', []);
      resume.updatedAt = new Date().toISOString().slice(0, 10);
      if (resume.id) {
        var idx = list.findIndex(function (r) { return r.id === resume.id; });
        if (idx >= 0) { list[idx] = resume; } else { list.push(resume); }
      } else {
        resume.id = uid();
        list.push(resume);
      }
      lsSet('resumes', list);
      return resume;
    },
    deleteResume: function (id) {
      lsSet('resumes', lsGet('resumes', []).filter(function (r) { return r.id !== id; }));
    },
    currentResumeId: function (id) {
      if (typeof id === 'string') { lsSet('currentResume', id); return id; }
      return lsGet('currentResume', null);
    },

    /* ---- 简历文本化（喂给匹配引擎的唯一入口） ---- */
    resumeText: function (resume) {
      if (!resume) return '';
      if (resume.type === 'raw') return resume.data || '';
      var d = resume.data || {};
      var out = [];
      var b = d.basic || {};
      out.push([b.name, b.title, b.location].filter(Boolean).join(' · '));
      if (b.summary) out.push(b.summary);
      (d.education || []).forEach(function (e) {
        out.push('教育：' + [e.school, e.major, e.degree, e.period].filter(Boolean).join(' / '));
      });
      (d.projects || []).forEach(function (p) {
        out.push('项目：' + p.title + (p.role ? '（' + p.role + '）' : '') + ' — ' + (p.desc || ''));
        if (p.tech && p.tech.length) out.push('技术：' + p.tech.join('、'));
      });
      if (d.skills && d.skills.length) out.push('技能：' + d.skills.join('、'));
      if (d.awards && d.awards.length) out.push('荣誉：' + d.awards.join('；'));
      return out.join('\n');
    },

    /* ---- 作品集 ---- */
    portfolio: function () { return lsGet('portfolio', null) || JSON.parse(JSON.stringify(NS.DEFAULT_PORTFOLIO)); },
    savePortfolio: function (p) { lsSet('portfolio', p); },

    /* ---- 历史记录 ---- */
    matchHistory: function (list) {
      if (Array.isArray(list)) { lsSet('matchHistory', list.slice(0, 30)); return list; }
      return lsGet('matchHistory', []);
    },
    interviewHistory: function (list) {
      if (Array.isArray(list)) { lsSet('interviewHistory', list.slice(0, 30)); return list; }
      return lsGet('interviewHistory', []);
    },

    /* ---- 导入导出 ---- */
    exportAll: function () {
      var out = { app: 'JobLens', version: 1, exportedAt: new Date().toISOString() };
      ['resumes', 'portfolio', 'settings', 'matchHistory', 'interviewHistory', 'currentResume'].forEach(function (k) {
        out[k] = lsGet(k, null);
      });
      if (out.settings && out.settings.llm) out.settings.llm.apiKey = '';
      return out;
    },
    importAll: function (obj) {
      if (!obj || obj.app !== 'JobLens') throw new Error('不是有效的 JobLens 备份文件');
      ['resumes', 'portfolio', 'settings', 'matchHistory', 'interviewHistory', 'currentResume'].forEach(function (k) {
        if (obj[k] !== undefined && obj[k] !== null) lsSet(k, obj[k]);
      });
    },
    clearAll: function () {
      ['resumes', 'portfolio', 'settings', 'matchHistory', 'interviewHistory', 'currentResume', 'theme'].forEach(function (k) {
        try { localStorage.removeItem(PREFIX + k); } catch (e) {}
      });
    }
  };
})(window.JobLens);
