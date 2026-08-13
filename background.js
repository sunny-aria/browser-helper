// ===== Browser Helper - Background Service Worker =====

// ---------- Tab count badge ----------
function updateBadge() {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const count = tabs.length;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: "#6366F1" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  });
}

chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onAttached.addListener(updateBadge);
chrome.tabs.onDetached.addListener(updateBadge);
chrome.windows.onFocusChanged.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);
updateBadge();

// ============================================================
// 飞书剪藏（Feishu Clipper）
// 流程：网页选区 → content.js 浮层 → PREVIEW（调 LLM + 加来源）
//        → 用户确认 → WRITE（循环写入多文档，走飞书 OpenAPI 直连）
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'clip-to-feishu',
    title: '整理并写入飞书',
    contexts: ['selection']
  });
});

// 右键菜单：把选区文本交给对应标签页的 content script 走预览流程
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clip-to-feishu' && info.selectionText && tab) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'RUN_PREVIEW',
      text: info.selectionText,
      pageUrl: tab.url,
      pageTitle: tab.title
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PREVIEW' && msg.text != null) {
    handlePreview(msg, sender).then((r) => sendResponse(r)).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'WRITE' && msg.content != null) {
    handleWrite(msg).then((r) => sendResponse(r)).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'TEST_WRITE') {
    handleTest().then((r) => sendResponse(r)).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});

async function handlePreview(msg, sender) {
  const cfg = await getConfig();
  const pageUrl = msg.pageUrl || (sender.tab && sender.tab.url) || '';
  const pageTitle = msg.pageTitle || (sender.tab && sender.tab.title) || '';
  let processed = msg.text;
  if (cfg.llmEnabled && cfg.llmApiKey) {
    processed = await callLLM(cfg, msg.text);
  }
  const stamp = cfg.addTime ? formatNow() : '';
  const content = withSource(processed, pageTitle, pageUrl, stamp);
  return { ok: true, content, docs: cfg.docs };
}

async function handleWrite(msg) {
  const cfg = await getConfig();
  const docs = msg.docs && msg.docs.length ? msg.docs : cfg.docs;
  if (!docs.length) {
    notify('飞书剪藏', '未配置目标文档，请先在插件里添加');
    return { ok: false, error: '未配置目标文档' };
  }
  const results = [];
  for (const d of docs) {
    try {
      await writeViaOpenAPI(cfg, d.token, msg.content);
      results.push({ name: d.name, ok: true });
    } catch (e) {
      results.push({ name: d.name, ok: false, error: String(e) });
    }
  }
  const allOk = results.every((r) => r.ok);
  const summary = results
    .map((r) => (r.ok ? '✓ ' : '✗ ') + r.name + (r.error ? ' (' + r.error.slice(0, 80) + ')' : ''))
    .join('\n');
  notify('飞书剪藏', allOk ? '已全部写入飞书文档' : '部分写入失败：\n' + summary);
  return { ok: allOk, results };
}

// 自动附加来源链接 + 剪藏时间
function withSource(text, title, url, stamp) {
  let out = String(text).replace(/\s*$/, '');
  const meta = [];
  if (url) meta.push('- 来源：[' + (title || url) + '](' + url + ')');
  if (stamp) meta.push('- 剪藏时间：' + stamp);
  if (meta.length) out += '\n\n---\n' + meta.join('\n') + '\n';
  return out;
}

// 生成本地时间字符串：YYYY-MM-DD HH:mm
function formatNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['llmEnabled', 'llmBaseUrl', 'llmApiKey', 'llmModel', 'llmPrompt', 'appId', 'appSecret', 'domain', 'docs', 'addTime'],
      (c) => {
        resolve({
          llmEnabled: c.llmEnabled !== false,
          llmBaseUrl: c.llmBaseUrl || 'https://api.openai.com/v1',
          llmApiKey: c.llmApiKey || '',
          llmModel: c.llmModel || 'gpt-4o-mini',
          llmPrompt:
            c.llmPrompt ||
            '你是一个整理助手。请将下面的网页内容整理为结构化的中文笔记：保留关键信息，补充小标题，去掉广告和无关内容。',
          appId: c.appId || '',
          appSecret: c.appSecret || '',
          domain: c.domain || 'feishu.cn',
          addTime: c.addTime !== false,
          docs: Array.isArray(c.docs) ? c.docs : []
        });
      }
    );
  });
}

async function callLLM(cfg, text) {
  const url = cfg.llmBaseUrl.replace(/\/+$/, '') + '/chat/completions';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.llmApiKey },
    body: JSON.stringify({
      model: cfg.llmModel,
      temperature: 0.3,
      messages: [
        { role: 'system', content: cfg.llmPrompt },
        { role: 'user', content: text }
      ]
    })
  });
  if (!resp.ok) throw new Error('LLM 调用失败 ' + resp.status + ': ' + (await resp.text()).slice(0, 200));
  const data = await resp.json();
  return (data.choices && data.choices[0] && data.choices[0].message.content) || text;
}

// 飞书 OpenAPI 直连（无需本地桥接服务）
function openApiBase(domain) {
  return domain === 'larksuite.com' ? 'https://open.larksuite.com' : 'https://open.feishu.cn';
}

// 统一读取 JSON 响应：非 JSON（如网关 404 文本页）时抛出可读错误，避免难懂的 SyntaxError
async function parseJson(r, label) {
  const ct = r.headers.get('content-type') || '';
  const body = await r.text();
  if (!r.ok || !ct.includes('json')) {
    throw new Error((label || '飞书接口') + ' 返回非预期响应 (status=' + r.status + ', content-type=' + ct + '): ' + body.slice(0, 120));
  }
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error((label || '飞书接口') + ' 响应不是合法 JSON: ' + body.slice(0, 120));
  }
}

async function getTenantToken(cfg) {
  if (!cfg.appId || !cfg.appSecret) {
    throw new Error(
      '未填写飞书 App ID / App Secret。插件需以自己的应用身份（tenant_access_token）写入飞书，请在配置中填写开放平台的 App ID 与 App Secret；' +
      '并确保：① 应用已开启 docx:document 权限；② 把机器人加入目标文档的协作者。'
    );
  }
  const cacheKey = 'feishu_token_cache';
  const cached = await new Promise((res) => chrome.storage.session.get(cacheKey, res));
  if (cached[cacheKey] && cached[cacheKey].exp > Date.now()) {
    return cached[cacheKey].token;
  }
  const r = await fetch(openApiBase(cfg.domain) + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: cfg.appId, app_secret: cfg.appSecret })
  });
  const data = await parseJson(r, 'tenant_access_token');
  if (data.code !== 0) throw new Error('获取 token 失败: ' + JSON.stringify(data).slice(0, 200));
  const token = data.tenant_access_token;
  const exp = Date.now() + (data.expire || 7200) * 1000 - 60000;
  await new Promise((res) => chrome.storage.session.set({ [cacheKey]: { token, exp } }, res));
  return token;
}

// 解析文档 id：
// - 普通 docx 文档：URL 里的 token 即 document_id，可直接用
// - wiki 文档（/wiki/wikcn...）：必须先通过 wiki 接口解析出真实的 docx document_id
async function resolveDocId(cfg, token) {
  const t = (token || '').trim();
  if (/wikcn/i.test(t) || /\/wiki\//i.test(t)) {
    const base = openApiBase(cfg.domain);
    const tk = await getTenantToken(cfg);
    const nodeToken = t.split('/wiki/').pop().trim();
    // 飞书 wiki 节点接口是 GET + 查询参数（POST 会返回 404 文本页导致 JSON 解析失败）
    // 注意：查 wiki 节点 token（wikcn...）必须用 node_type（表示“这是个 wiki 节点”）；
    // 若误用 obj_type=docx，接口会把 token 当成 docx 文档 token 去查 → 131005 not found。
    // 返回结构见 data.node，文档 token 在 obj_token 字段（节点对象无 document_id 字段）。
    const r = await fetch(
      base + '/open-apis/wiki/v2/spaces/get_node?token=' + encodeURIComponent(nodeToken) + '&node_type=docx',
      { method: 'GET', headers: { Authorization: 'Bearer ' + tk } }
    );
    const d = await parseJson(r, 'Wiki 节点解析');
    if (d.code !== 0 || !d.data || !d.data.node) {
      let hint = '';
      if (d.code === 131006) {
        hint =
          ' 这是权限错误：飞书应用（机器人）没有该知识库节点的读取权限。请按三步处理：' +
          '① 在飞书开发者后台为应用开通「wiki:wiki（只读）」权限范围，写入还需额外开通「docx:document」；' +
          '② 打开对应的知识库空间，进入「管理空间 → 成员与权限」，把本应用的机器人添加为协作者（至少给阅读权限）；' +
          '③ 若刚新增过权限范围，需重新发布/授权应用使权限生效（管理员可能要再次审批）。';
      }
      throw new Error(
        'Wiki 文档解析失败 (code=' + d.code + (d.msg ? ', msg=' + d.msg : '') + '):' + hint +
        (hint ? '' : ' ' + JSON.stringify(d).slice(0, 160))
      );
    }
    const node = d.data.node;
    // 块写入 API 仅支持新版文档 docx；旧版 doc / 表格 / 多维表格等需单独处理
    if (node.obj_type && node.obj_type !== 'docx') {
      throw new Error(
        '该 wiki 节点类型为「' + node.obj_type + '」，当前仅支持新版文档（docx）。请在飞书里把文档转为新版文档后再试。'
      );
    }
    // obj_token 即 docx 文档 id；部分旧版本可能返回 document_id，做兼容回退
    const docId = node.obj_token || node.document_id;
    if (!docId) {
      throw new Error('Wiki 节点未返回文档 token（obj_token/document_id 均缺失）：' + JSON.stringify(d).slice(0, 160));
    }
    return docId;
  }
  return t;
}

// 取文档最后一个 block 的真实 id（用于可靠追加到文末）
async function getLastBlockId(cfg, documentId) {
  try {
    const base = openApiBase(cfg.domain);
    const token = await getTenantToken(cfg);
    const br = await fetch(
      base + '/open-apis/docx/v1/documents/' + encodeURIComponent(documentId) + '/blocks?page_size=50',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const ct = br.headers.get('content-type') || '';
    // 非 JSON（如 wiki token 误打到 docx 接口返回 text/plain）直接回退，避免抛错
    if (!br.ok || !ct.includes('json')) {
      console.warn('[getLastBlockId] blocks 接口返回非预期，回退 -1；status=' + br.status + ' ct=' + ct);
      return '-1';
    }
    const bj = await parseJson(br, 'docx blocks');
    if (bj.code !== 0) {
      console.warn('[getLastBlockId] blocks 接口返回错误码，回退 -1：', bj.msg || bj.code);
      return '-1';
    }
    const items = (bj.data && bj.data.items) || [];
    if (!items.length) return '-1';
    return items[items.length - 1].block_id || '-1';
  } catch (e) {
    console.warn('[getLastBlockId] 取末尾 block 失败，回退到 -1:', e);
    return '-1';
  }
}

async function writeViaOpenAPI(cfg, docToken, content) {
  const documentId = await resolveDocId(cfg, docToken);
  // 关键修复：不要直接用 block_id='-1' 追加。
  // 非空文档下 '-1'（文档末尾哨兵）在 docs_ai 的 block_insert_after 中不可靠，
  // 会导致「能写一次、无法继续追加」。正确做法：先取到文档最后一个 block 的
  // 真实 id，再插到它后面；取不到时才回退到 '-1'（空文档场景）。
  const blockId = await getLastBlockId(cfg, documentId);
  const token = await getTenantToken(cfg);
  const base = openApiBase(cfg.domain);
  const r = await fetch(base + '/open-apis/docs_ai/v1/documents/' + encodeURIComponent(documentId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      block_id: blockId,
      command: 'block_insert_after',
      content: content,
      format: 'markdown',
      revision_id: -1
    })
  });
  const data = await parseJson(r, 'docs_ai 写入');
  if (data.code !== 0) {
    let hint = '';
    if (data.code === 131006 || data.code === 1254001 || String(data.code).startsWith('12540')) {
      hint =
        ' 这是权限错误：机器人没有该文档的写入权限。请打开目标飞书文档，点击右上角「··· → 添加协作者」，' +
        '把本应用的机器人加入并赋予可编辑权限；wiki 文档则需先给机器人知识库空间的协作者权限，再单独给文档编辑权限。';
    }
    throw new Error('docs_ai 写入失败 (code=' + data.code + (data.msg ? ', msg=' + data.msg : '') + '):' + hint);
  }
  return data;
}

// 诊断：向第一个目标文档写一条测试内容，返回真实错误，便于排查鉴权/权限问题
async function handleTest() {
  const cfg = await getConfig();
  if (!cfg.docs.length) return { ok: false, error: '未配置目标文档，请先在「目标文档」添加' };
  const d = cfg.docs[0];
  try {
    await writeViaOpenAPI(cfg, d.token, '# 连接测试\n这是一条来自「飞书剪藏插件」的连接测试，若已出现在文档里说明配置正确。');
    return { ok: true, name: d.name };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function notify(title, message) {
  try {
    chrome.notifications.create(
      {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon16.png'),
        title: title,
        message: message.slice(0, 250)
      },
      () => {
        if (chrome.runtime.lastError) console.warn('[notify] 通知创建失败:', chrome.runtime.lastError.message);
      }
    );
  } catch (e) {
    console.warn('[notify] 异常:', e);
  }
}
