// content.js — 注入网页：捕获选中文本 + 预览浮层 + 仅复制
(function () {
  let btn = null;

  // 注入一次统一样式（浮层与选区工具条），避免散落 inline style
  function ensureStyle() {
    if (document.getElementById('feishu-clipper-style')) return;
    const s = document.createElement('style');
    s.id = 'feishu-clipper-style';
    s.textContent = CSS;
    document.documentElement.appendChild(s);
  }

  function removeBtn() {
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    btn = null;
  }

  // 选区旁的小工具条：整理并写入飞书 / 仅复制（复制原文）
  function showBtn(x, y, text) {
    removeBtn();
    const bar = document.createElement('div');
    bar.id = 'fs-clip-toolbar';
    bar.style.left = x + 12 + 'px';
    bar.style.top = y + 12 + 'px';

    const b1 = document.createElement('button');
    b1.className = 'fs-btn-primary';
    b1.textContent = '整理并写入飞书';
    b1.addEventListener('click', () => doPreview(text, location.href, document.title));

    const b2 = document.createElement('button');
    b2.className = 'fs-btn-ghost';
    b2.textContent = '仅复制';
    b2.addEventListener('click', () => {
      copyText(text).then((ok) => {
        toast(ok ? '已复制原文 ✓' : '复制失败，请手动复制');
        removeBtn();
      });
    });

    bar.appendChild(b1);
    bar.appendChild(b2);
    document.body.appendChild(bar);
    btn = bar;
  }

  document.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text.length > 0) showBtn(e.clientX, e.clientY, text);
      else removeBtn();
    }, 10);
  });
  document.addEventListener('scroll', removeBtn);

  // 来自右键菜单（background 转发）
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'RUN_PREVIEW') doPreview(msg.text, msg.pageUrl, msg.pageTitle);
    });
  }

  // 安全的消息发送：检测扩展上下文是否可用，并在调用时捕获
  // "Extension context invalidated"（扩展重载后网页未重载会抛此错）以免硬崩溃
  function safeSend(msg, cb) {
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      console.warn('[飞书剪藏] 无法访问 chrome.runtime，可能扩展未正确加载或页面非扩展上下文');
      if (cb) cb({ ok: false, error: '扩展未就绪：请在 chrome://extensions 重新加载扩展，并刷新本网页标签页后重试' });
      return;
    }
    let tries = 0;
    const attempt = () => {
      tries += 1;
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          const err = chrome.runtime.lastError;
          // MV3 service worker 空闲终止后，第一次 sendMessage 常因端口抢建失败报此错，重试唤醒即可
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
      } catch (e) {
        console.warn('[飞书剪藏] 发送消息时扩展上下文已失效：', e);
        if (cb) cb({ ok: false, error: '扩展上下文已失效，请刷新本网页标签页后重试' });
      }
    };
    attempt();
  }

  function doPreview(text, pageUrl, pageTitle) {
    removeBtn();
    safeSend({ type: 'PREVIEW', text: text, pageUrl: pageUrl, pageTitle: pageTitle }, (resp) => {
      if (!resp || !resp.ok) {
        alert('预览失败：' + ((resp && resp.error) || '未知错误'));
        return;
      }
      renderOverlay(resp.content, resp.docs);
    });
  }

  function renderOverlay(content, docs) {
    removeOverlay();

    const backdrop = document.createElement('div');
    backdrop.id = 'feishu-preview-backdrop';
    backdrop.addEventListener('click', removeOverlay);

    const panel = document.createElement('div');
    panel.id = 'feishu-preview-panel';

    panel.innerHTML =
      '<div class="fp-header">写入预览</div>' +
      '<div class="fp-sub">整理后的内容可直接编辑，选择要写入的文档后确认。</div>' +
      '<textarea id="fp-content" placeholder="内容"></textarea>' +
      '<div class="fp-section-title">目标文档（可多选）</div>' +
      '<div id="fp-docs"></div>' +
      '<div id="fp-msg" class="fp-msg"></div>' +
      '<div class="fp-actions">' +
      '<button id="fp-cancel" class="fp-cancel">取消</button>' +
      '<button id="fp-copy" class="fp-copy">仅复制</button>' +
      '<button id="fp-ok" class="fp-ok">确认写入</button>' +
      '</div>';

    backdrop.appendChild(panel);
    document.documentElement.appendChild(backdrop);

    const ta = panel.querySelector('#fp-content');
    ta.value = content;

    const docsBox = panel.querySelector('#fp-docs');
    const msg = panel.querySelector('#fp-msg');

    if (!docs || docs.length === 0) {
      docsBox.innerHTML = '<div class="fp-empty">未配置目标文档，请先在插件里添加。仍可「仅复制」。</div>';
    } else {
      docs.forEach((d) => {
        const lab = document.createElement('label');
        lab.className = 'fp-doc-item';
        lab.innerHTML =
          '<input type="checkbox" class="fp-doc" data-name="' + escapeAttr(d.name) + '" data-token="' + escapeAttr(d.token) + '" checked>' +
          '<span class="fp-doc-name">' + escapeHtml(d.name) + '</span>' +
          '<span class="fp-doc-token">' + escapeHtml(d.token) + '</span>';
        docsBox.appendChild(lab);
      });
    }

    panel.querySelector('#fp-cancel').addEventListener('click', removeOverlay);

    // 仅复制：复制预览框内（已处理 + 来源链接 + 剪藏时间）内容
    panel.querySelector('#fp-copy').addEventListener('click', () => {
      copyText(ta.value).then((ok) => toast(ok ? '已复制到剪贴板 ✓' : '复制失败，请手动复制'));
    });

    panel.querySelector('#fp-ok').addEventListener('click', () => {
      const selected = Array.from(panel.querySelectorAll('.fp-doc:checked')).map((c) => ({
        name: c.dataset.name,
        token: c.dataset.token
      }));
      if (selected.length === 0) {
        msg.textContent = '请至少选择一个目标文档';
        return;
      }
      const okBtn = panel.querySelector('#fp-ok');
      okBtn.textContent = '写入中…';
      okBtn.disabled = true;
      safeSend({ type: 'WRITE', content: ta.value, docs: selected }, (resp) => {
        if (resp && resp.ok) {
          panel.innerHTML = '<div class="fp-done">已写入 ✓</div>' +
            '<div class="fp-done-sub">' + escapeHtml((resp.results || []).map((r) => r.name).join('、')) + '</div>';
          setTimeout(removeOverlay, 1400);
        } else {
          msg.textContent = '写入失败：' + ((resp && resp.error) || '未知错误');
          okBtn.textContent = '确认写入';
          okBtn.disabled = false;
        }
      });
    });
  }

  function removeOverlay() {
    const b = document.getElementById('feishu-preview-backdrop');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  // 复制文本：优先 Clipboard API，失败回退 execCommand
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      /* 回退 */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // 轻量 toast
  function toast(msg) {
    let t = document.getElementById('fs-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'fs-toast';
      document.documentElement.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.opacity = '0';
    }, 1400);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function escapeAttr(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  const CSS =
    '#fs-clip-toolbar{position:fixed;z-index:2147483647;display:flex;gap:6px;background:#fff;padding:5px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.18);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;}' +
    '#fs-clip-toolbar button{border:none;cursor:pointer;font-size:13px;padding:7px 12px;border-radius:7px;font-family:inherit;}' +
    '.fs-btn-primary{background:#3370ff;color:#fff;}.fs-btn-primary:hover{background:#245bdb;}' +
    '.fs-btn-ghost{background:#f2f3f5;color:#1f2329;}.fs-btn-ghost:hover{background:#e8eaed;}' +
    '#feishu-preview-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.28);z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;}' +
    '#feishu-preview-panel{position:fixed;top:24px;right:24px;width:440px;max-height:88vh;overflow:auto;background:#fff;border-radius:14px;padding:20px;z-index:2147483647;box-shadow:0 16px 48px rgba(0,0,0,0.28);color:#1f2329;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;}' +
    '#feishu-preview-panel .fp-header{font-size:16px;font-weight:600;margin-bottom:2px;}' +
    '#feishu-preview-panel .fp-sub{font-size:12px;color:#8f959e;margin-bottom:12px;line-height:1.5;}' +
    '#feishu-preview-panel textarea#fp-content{width:100%;height:260px;padding:10px;border:1px solid #dee0e3;border-radius:8px;font-size:13px;font-family:inherit;line-height:1.6;resize:vertical;outline:none;color:#1f2329;}' +
    '#feishu-preview-panel textarea#fp-content:focus{border-color:#3370ff;box-shadow:0 0 0 3px rgba(51,112,255,0.12);}' +
    '#feishu-preview-panel .fp-section-title{font-size:12px;color:#646a73;margin:16px 0 6px;}' +
    '#feishu-preview-panel .fp-empty{color:#8f959e;font-size:12px;padding:8px 10px;background:#f6f7f9;border-radius:8px;}' +
    '#feishu-preview-panel .fp-doc-item{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f6f7f9;border-radius:8px;margin-bottom:6px;cursor:pointer;}' +
    '#feishu-preview-panel .fp-doc-item:hover{background:#eef0f3;}' +
    '#feishu-preview-panel .fp-doc-item input{width:auto;margin:0;}' +
    '#feishu-preview-panel .fp-doc-name{font-weight:500;}' +
    '#feishu-preview-panel .fp-doc-token{color:#8f959e;font-size:11px;font-family:monospace;margin-left:auto;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#feishu-preview-panel .fp-msg{color:#d83931;font-size:12px;min-height:16px;margin-top:8px;white-space:pre-wrap;}' +
    '#feishu-preview-panel .fp-actions{display:flex;gap:8px;margin-top:14px;}' +
    '#feishu-preview-panel .fp-actions button{flex:1;padding:10px;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit;}' +
    '#feishu-preview-panel .fp-cancel{background:#f2f3f5;color:#1f2329;}.fp-cancel:hover{background:#e8eaed;}' +
    '#feishu-preview-panel .fp-copy{background:#fff;color:#3370ff;border:1px solid #3370ff;}.fp-copy:hover{background:#eef3ff;}' +
    '#feishu-preview-panel .fp-ok{background:#3370ff;color:#fff;}.fp-ok:hover{background:#245bdb;}' +
    '#feishu-preview-panel .fp-ok:disabled{opacity:0.6;cursor:default;}' +
    '#feishu-preview-panel .fp-done{font-size:16px;font-weight:600;color:#2ecc71;text-align:center;margin-top:20px;}' +
    '#feishu-preview-panel .fp-done-sub{color:#646a73;font-size:12px;margin-top:8px;text-align:center;}' +
    '#fs-toast{position:fixed;left:50%;top:20px;transform:translateX(-50%);background:rgba(31,35,41,0.92);color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;pointer-events:none;opacity:0;transition:opacity 0.2s;}';

  ensureStyle();
})();
