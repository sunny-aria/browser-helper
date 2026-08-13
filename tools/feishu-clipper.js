// ===== Browser Helper - 飞书剪藏配置模块 =====
// 复用 feishu-clipper 的配置逻辑（大模型 / 飞书凭据 / 多文档 / 测试写入）。
// 元素 ID 统一加 fs- 前缀，避免与其它面板冲突。

const FeishuClipper = (function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const DEFAULTS = {
    llmBaseUrl: 'https://api.openai.com/v1',
    llmModel: 'gpt-4o-mini',
    llmPrompt: '你是一个整理助手。请将下面的网页内容整理为结构化的中文笔记：保留关键信息，补充小标题，去掉广告和无关内容。',
    domain: 'feishu.cn'
  };

  let docs = [];
  let bound = false;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // 从文档链接/URL 中解析 token；识别不到则原样当作 token
  function extractToken(raw) {
    let m = raw.match(/\/docx\/([a-zA-Z0-9]+)/);
    if (m) return m[1];
    m = raw.match(/\/wiki\/([a-zA-Z0-9]+)/); // 支持 wiki 文档
    if (m) return m[1];
    m = raw.match(/[?&]docId=([a-zA-Z0-9]+)/);
    if (m) return m[1];
    return raw.trim();
  }

  function renderDocs() {
    const list = $('fs-docList');
    if (!list) return;
    list.innerHTML = '';
    if (docs.length === 0) {
      list.innerHTML = '<p class="fs-hint">尚未配置目标文档。</p>';
      return;
    }
    docs.forEach((d, i) => {
      const row = document.createElement('div');
      row.className = 'fs-docrow';
      row.innerHTML =
        '<span class="fs-docname">' + escapeHtml(d.name) + '</span>' +
        '<span class="fs-doctoken">' + escapeHtml(d.token) + '</span>' +
        '<button data-i="' + i + '">删除</button>';
      list.appendChild(row);
    });
    list.querySelectorAll('button[data-i]').forEach((b) => {
      b.addEventListener('click', () => {
        docs.splice(parseInt(b.dataset.i, 10), 1);
        renderDocs();
      });
    });
  }

  function loadConfig() {
    chrome.storage.local.get(
      ['llmEnabled', 'llmApiKey', 'llmBaseUrl', 'llmModel', 'llmPrompt', 'appId', 'appSecret', 'domain', 'docs', 'addTime'],
      (c) => {
        if ($('fs-llmEnabled')) $('fs-llmEnabled').checked = c.llmEnabled !== false;
        if ($('fs-addTime')) $('fs-addTime').checked = c.addTime !== false;
        if ($('fs-llmApiKey')) $('fs-llmApiKey').value = c.llmApiKey || '';
        if ($('fs-llmBaseUrl')) $('fs-llmBaseUrl').value = c.llmBaseUrl || DEFAULTS.llmBaseUrl;
        if ($('fs-llmModel')) $('fs-llmModel').value = c.llmModel || DEFAULTS.llmModel;
        if ($('fs-llmPrompt')) $('fs-llmPrompt').value = c.llmPrompt || DEFAULTS.llmPrompt;
        if ($('fs-appId')) $('fs-appId').value = c.appId || '';
        if ($('fs-appSecret')) $('fs-appSecret').value = c.appSecret || '';
        if ($('fs-domain')) $('fs-domain').value = c.domain || DEFAULTS.domain;
        docs = Array.isArray(c.docs) ? c.docs : [];
        renderDocs();
      }
    );
  }

  function bindUI() {
    if (bound) return;
    bound = true;

    const addDoc = $('fs-addDoc');
    if (addDoc) {
      addDoc.addEventListener('click', () => {
        const name = $('fs-docName').value.trim();
        const raw = $('fs-docUrl').value.trim();
        if (!raw) return;
        const token = extractToken(raw);
        if (!token) return alert('无法解析文档链接 / token');
        docs.push({ name: name || token, token });
        $('fs-docName').value = '';
        $('fs-docUrl').value = '';
        renderDocs();
      });
    }

    const save = $('fs-save');
    if (save) {
      save.addEventListener('click', () => {
        const data = {
          llmEnabled: $('fs-llmEnabled').checked,
          llmApiKey: $('fs-llmApiKey').value.trim(),
          llmBaseUrl: $('fs-llmBaseUrl').value.trim(),
          llmModel: $('fs-llmModel').value.trim(),
          llmPrompt: $('fs-llmPrompt').value.trim(),
          appId: $('fs-appId').value.trim(),
          appSecret: $('fs-appSecret').value.trim(),
          domain: $('fs-domain').value,
          addTime: $('fs-addTime').checked,
          docs: docs
        };
        chrome.storage.local.set(data, () => {
          const s = $('fs-status');
          if (s) {
            s.textContent = '已保存 ✓';
            setTimeout(() => { s.textContent = ''; }, 1500);
          }
        });
      });
    }

    const testWrite = $('fs-testWrite');
    if (testWrite) {
      testWrite.addEventListener('click', () => {
        const r = $('fs-testResult');
        r.textContent = '测试中…';
        r.style.color = '#646a73';
        sendToBackground({ type: 'TEST_WRITE' }, (resp) => {
          if (!resp || resp.ok === false) {
            r.style.color = '#d83931';
            r.textContent = '✗ ' + ((resp && resp.error) || '发送失败：后台未响应');
            return;
          }
          if (resp && resp.ok) {
            r.style.color = '#2ecc71';
            r.textContent = '✓ 测试写入成功（已写入「' + resp.name + '」，文档id=' + (resp.docId || '') + '），配置正确。';
          } else {
            r.style.color = '#d83931';
            r.textContent = '✗ ' + ((resp && resp.error) || '未知错误');
          }
        });
      });
    }
  }

  // MV3 service worker 空闲会被终止，popup 首次 sendMessage 可能因端口抢建失败而报
  // "Receiving end does not exist"。遇到该错误自动重试唤醒后台（最多 3 次）。
  function sendToBackground(msg, cb) {
    let tries = 0;
    const attempt = () => {
      tries += 1;
      chrome.runtime.sendMessage(msg, (resp) => {
        const err = chrome.runtime.lastError;
        if (err && /Receiving end does not exist/i.test(err.message || '') && tries < 3) {
          setTimeout(attempt, 150 * tries);
          return;
        }
        if (err) {
          if (cb) cb({ ok: false, error: '发送失败：' + err.message });
          return;
        }
        if (cb) cb(resp);
      });
    };
    attempt();
  }

  function init() {
    loadConfig();
    bindUI();
  }

  return { init: init };
})();
