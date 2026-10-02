/* ============================================================
 * JobLens PDF 解析：pdf.js（本地托管）在前端抽文本，PDF 不上传任何服务器
 * ============================================================ */
window.JobLens = window.JobLens || {};
(function (NS) {
  'use strict';

  NS.pdfToText = async function (file) {
    if (!window.pdfjsLib) {
      throw new Error('PDF 解析组件未加载成功。可先改用"粘贴文本"入口。');
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'assets/vendor/pdf.worker.min.js';

    var buf = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
    var pages = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var tc = await page.getTextContent();
      pages.push(tc.items.map(function (it) { return it.str; }).join(' '));
    }
    var text = pages.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) {
      throw new Error('这份 PDF 里抽不到文字（可能是扫描件/纯图片）。请改用"粘贴文本"手动录入。');
    }
    return text;
  };
})(window.JobLens);
