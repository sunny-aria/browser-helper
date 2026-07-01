// ===== Browser Helper - JSON Formatter Module =====
// Scoped to #panel-json-formatter

const JSONFormatter = (function() {
  let lastFormattedJson = '';

  // DOM refs (set in init)
  let inputArea, outputCode, outputArea, statusBadge, statusMsg;
  let copyBtn, clearBtn, sampleBtn;

  // ===== Helpers =====
  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getSize(str) {
    const bytes = new Blob([str]).size;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function getObjectInfo(obj) {
    if (Array.isArray(obj)) return `数组[${obj.length}]`;
    if (obj && typeof obj === 'object') return `对象{${Object.keys(obj).length}键}`;
    return typeof obj;
  }

  // ===== Toast =====
  function showToast(message, type) {
    if (type === void 0) type = 'info';
    var t = document.getElementById('toast');
    t.textContent = message;
    t.className = 'toast show';
    if (type) t.classList.add(type);
    setTimeout(function(){ t.className = 'toast'; }, 1800);
  }

  function setStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = 'status-msg' + (type ? ' ' + type : '');
  }

  function setBadge(text, type) {
    statusBadge.textContent = text;
    statusBadge.className = 'jf-badge' + (type ? ' ' + type : '');
  }

  // ===== Syntax Highlighting =====
  function highlightValue(val) {
    if (val === null) return '<span class="syn-null">null</span>';
    if (typeof val === 'boolean') return '<span class="syn-bool">'+val+'</span>';
    if (typeof val === 'number') return '<span class="syn-number">'+val+'</span>';
    if (typeof val === 'string') return '<span class="syn-string">'+escapeHtml(val)+'</span>';
    return escapeHtml(String(val));
  }

  function getSummary(data) {
    if (Array.isArray(data)) return data.length+' 项';
    if (data && typeof data === 'object') return Object.keys(data).length+' 键';
    return '';
  }

  // ===== Collapsible JSON Tree =====
  function renderJsonTree(data, key, isLast) {
    const comma = isLast ? '' : ',';
    const keyHtml = key !== null
      ? '<span class="syn-key">"'+escapeHtml(String(key))+'"</span>: '
      : '';

    if (data === null || typeof data !== 'object') {
      return '<div class="json-line">'+keyHtml+highlightValue(data)+comma+'</div>';
    }

    const isArray = Array.isArray(data);
    const open = isArray ? '[' : '{';
    const close = isArray ? ']' : '}';
    const entries = isArray ? data.map(function(v,i){return [i,v];}) : Object.entries(data);
    const summary = getSummary(data);

    if (entries.length === 0) {
      return '<div class="json-line">'+keyHtml+'<span class="syn-bracket">'+open+close+'</span>'+comma+'</div>';
    }

    var html = '<div class="json-node">';
    html += '<div class="json-open">';
    html += '<span class="json-toggle"></span>';
    html += keyHtml+'<span class="syn-bracket">'+open+'</span>';
    html += '<span class="json-summary"> '+summary+'</span>';
    html += '<span class="json-collapsed-hint"> … <span class="syn-bracket">'+close+'</span>'+comma+'</span>';
    html += '</div>';
    html += '<div class="json-children">';
    entries.forEach(function(kv, i){
      var childIsLast = i === entries.length - 1;
      html += renderJsonTree(kv[1], isArray ? null : kv[0], childIsLast);
    });
    html += '</div>';
    html += '<div class="json-close"><span class="syn-bracket">'+close+'</span>'+comma+'</div>';
    html += '</div>';
    return html;
  }

  function bindToggles() {
    outputCode.querySelectorAll('.json-toggle').forEach(function(toggle){
      toggle.addEventListener('click', function(){
        var node = toggle.closest('.json-node');
        node.classList.toggle('collapsed');
      });
    });
  }

  function highlightJsonFallback(json) {
    var escaped = escapeHtml(json);
    return escaped.replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function(match){
        var cls = 'syn-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) cls = 'syn-key';
          else cls = 'syn-string';
        } else if (/true|false/.test(match)) cls = 'syn-bool';
        else if (/null/.test(match)) cls = 'syn-null';
        return '<span class="'+cls+'">'+match+'</span>';
      }
    ).replace(/([{}\[\]])/g, '<span class="syn-bracket">$1</span>');
  }

  function renderOutput(text, isJson, useTree) {
    if (useTree) {
      lastFormattedJson = text;
      try {
        var parsed = JSON.parse(text);
        outputCode.className = 'json-tree';
        outputCode.innerHTML = renderJsonTree(parsed, null, true);
        bindToggles();
      } catch(e) {
        outputCode.className = '';
        outputCode.innerHTML = highlightJsonFallback(text);
      }
    } else if (isJson) {
      lastFormattedJson = text;
      outputCode.className = '';
      outputCode.innerHTML = highlightJsonFallback(text);
    } else {
      lastFormattedJson = '';
      outputCode.className = '';
      outputCode.textContent = text;
    }
  }

  // ===== JSON Repair =====
  function tryParseJSON(input) {
    try { return { parsed: JSON.parse(input), repaired: false }; }
    catch(e) { var repaired = repairJSON(input); return { parsed: JSON.parse(repaired), repaired: true }; }
  }

  function repairJSON(input) {
    var fixed = input;
    fixed = repairJSONSmart(fixed);
    try { JSON.parse(fixed); return fixed; }
    catch(e) { return repairJSONIterative(fixed); }
  }

  function repairJSONSmart(input) {
    var result = [];
    var inString = false, inValueString = false, inEmbeddedJson = false;
    var bracketDepth = 0, n = input.length, i = 0;

    while (i < n) {
      var ch = input[i];
      if (!inString) {
        result.push(ch);
        if (ch === '"') {
          inString = true;
          var j = result.length - 2;
          while (j >= 0 && (result[j] === ' ' || result[j] === '\t' || result[j] === '\n' || result[j] === '\r')) j--;
          inValueString = (j >= 0 && result[j] === ':');
          inEmbeddedJson = false; bracketDepth = 0;
        }
        i++;
      } else {
        if (ch === '\\') {
          result.push(ch);
          if (i + 1 < n) { result.push(input[i+1]); i += 2; } else { i++; }
        } else if (ch === '"') {
          if (inEmbeddedJson && bracketDepth > 0) {
            result.push('\\', '"'); i++;
          } else {
            var k = i + 1;
            while (k < n && (input[k] === ' ' || input[k] === '\t' || input[k] === '\n' || input[k] === '\r')) k++;
            if (k >= n || ',}]:'.includes(input[k])) {
              result.push(ch); i++;
              inString = false; inEmbeddedJson = false; bracketDepth = 0;
            } else {
              result.push('\\', '"'); i++;
            }
          }
        } else {
          result.push(ch);
          if (inValueString && !inEmbeddedJson) {
            if (ch === '[' || ch === '{') { inEmbeddedJson = true; bracketDepth = 1; }
          } else if (inEmbeddedJson) {
            if (ch === '[' || ch === '{') bracketDepth++;
            else if (ch === ']' || ch === '}') bracketDepth--;
          }
          i++;
        }
      }
    }
    return result.join('');
  }

  function repairJSONIterative(input) {
    var fixed = input;
    for (var attempt = 0; attempt < 1000; attempt++) {
      try { JSON.parse(fixed); return fixed; }
      catch(e) {
        var posMatch = e.message.match(/position\s+(\d+)/i);
        if (!posMatch) throw e;
        var pos = parseInt(posMatch[1]);
        var found = false;
        for (var offset = 0; offset < 50; offset++) {
          for (var pi = 0; pi < 2; pi++) {
            var p = pi === 0 ? pos - 1 - offset : pos + offset;
            if (p >= 0 && p < fixed.length && fixed[p] === '"') {
              var backslashes = 0, kk = p - 1;
              while (kk >= 0 && fixed[kk] === '\\') { backslashes++; kk--; }
              if (backslashes % 2 === 0) {
                fixed = fixed.substring(0, p) + '\\"' + fixed.substring(p + 1);
                found = true; break;
              }
            }
          }
          if (found) break;
        }
        if (!found) throw new SyntaxError('JSON 格式无效，无法自动修复');
      }
    }
    throw new SyntaxError('JSON 格式无效，修复尝试超限');
  }

  // ===== Core Functions =====
  function formatJSON(input) {
    var r = tryParseJSON(input);
    var result = JSON.stringify(r.parsed, null, 2);
    renderOutput(result, true, true);
    if (r.repaired) {
      setBadge('已修复', 'success');
      setStatus('已自动修复内嵌引号并格式化 · '+getSize(result)+' · '+getObjectInfo(r.parsed), 'success');
    } else {
      setBadge('有效 JSON', 'success');
      setStatus('格式化成功 · '+getSize(result)+' · '+getObjectInfo(r.parsed), 'success');
    }
  }

  function minifyJSON(input) {
    var r = tryParseJSON(input);
    var result = JSON.stringify(r.parsed);
    renderOutput(result, true, false);
    setBadge(r.repaired ? '已修复' : '已压缩', 'success');
    setStatus((r.repaired ? '已自动修复并压缩' : '压缩成功')+' · '+getSize(result), 'success');
  }

  function expandJSON(input) {
    var parsed, repaired = false;
    try { parsed = JSON.parse(input); }
    catch(e) { var r = tryParseJSON(input); parsed = r.parsed; repaired = r.repaired; }
    var result = JSON.stringify(parsed, null, 4);
    renderOutput(result, true, true);
    setBadge(repaired ? '已修复' : '已展开', 'success');
    setStatus('解压缩成功 · '+getSize(result), 'success');
  }

  function escapeJSON(input) {
    var r = tryParseJSON(input);
    var result = JSON.stringify(JSON.stringify(r.parsed));
    renderOutput(result, false);
    setBadge(r.repaired ? '已修复' : '已转义', 'success');
    setStatus('转义成功 · '+getSize(result), 'success');
  }

  function unescapeJSON(input) {
    var str = input.trim();
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      str = str.slice(1, -1);
    }
    var result = unescapeString(str);
    try {
      JSON.parse(result);
      renderOutput(result, true, true);
      setBadge('有效 JSON', 'success');
    } catch(e) {
      renderOutput(result, false);
      setBadge('已还原', 'success');
    }
    setStatus('去除转义成功 · '+getSize(result), 'success');
  }

  function unescapeString(str) {
    return str
      .replace(/\\"/g, '"').replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\').replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r').replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b').replace(/\\f/g, '\f')
      .replace(/\\u([\da-fA-F]{4})/g, function(_, code){ return String.fromCharCode(parseInt(code, 16)); });
  }

  // ===== Divider Drag =====
  function setupDivider() {
    var divider = document.getElementById('divider');
    var inputPanel = document.getElementById('inputPanel');
    var outputPanel = document.getElementById('outputPanel');
    var editorContainer = document.getElementById('editorContainer');
    if (!divider || !editorContainer) return;

    var isDragging = false;

    divider.addEventListener('mousedown', function(e){
      isDragging = true;
      divider.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e){
      if (!isDragging) return;
      var rect = editorContainer.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var tw = rect.width, dw = 7, minW = 120;
      var iw = Math.max(minW, Math.min(x - dw/2, tw - minW - dw));
      var ip = (iw / (tw - dw)) * 100;
      inputPanel.style.flex = '0 0 '+ip+'%';
      outputPanel.style.flex = '0 0 '+(100-ip)+'%';
    });

    document.addEventListener('mouseup', function(){
      if (!isDragging) return;
      isDragging = false;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });

    divider.addEventListener('dblclick', function(){
      inputPanel.style.flex = '1 1 50%';
      outputPanel.style.flex = '1 1 50%';
    });
  }

  function init() {
    // DOM refs
    inputArea = document.getElementById('inputArea');
    outputCode = document.getElementById('outputCode');
    outputArea = document.getElementById('outputArea');
    statusBadge = document.getElementById('statusBadge');
    statusMsg = document.getElementById('statusMsg');
    copyBtn = document.getElementById('copyBtn');
    clearBtn = document.getElementById('clearBtn');
    sampleBtn = document.getElementById('sampleBtn');

    // Action buttons
    var actions = {
      format: formatJSON, minify: minifyJSON,
      expand: expandJSON, escape: escapeJSON, unescape: unescapeJSON
    };

    document.querySelectorAll('#panel-json-formatter .jf-btn[data-action]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var input = inputArea.value.trim();
        if (!input) { showToast('请先输入内容', 'error'); setStatus('输入为空', 'error'); return; }
        try {
          actions[btn.dataset.action](input);
        } catch(e) {
          var msg = e instanceof SyntaxError
            ? 'JSON 语法错误：'+e.message.slice(0,80)
            : '处理失败：'+e.message.slice(0,80);
          setBadge('错误', 'error'); setStatus(msg, 'error');
          outputCode.textContent = msg;
          showToast(msg, 'error');
        }
      });
    });

    // Copy
    if (copyBtn) {
      copyBtn.addEventListener('click', function(){
        var text = lastFormattedJson || outputCode.textContent;
        if (!text) { showToast('没有可复制的内容', 'error'); return; }
        navigator.clipboard.writeText(text).then(function(){
          copyBtn.classList.add('copied');
          var orig = copyBtn.innerHTML;
          copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> 已复制';
          showToast('已复制到剪贴板', 'success');
          setTimeout(function(){ copyBtn.classList.remove('copied'); copyBtn.innerHTML = orig; }, 1500);
        }).catch(function(){
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
          showToast('已复制到剪贴板', 'success');
        });
      });
    }

    // Clear
    if (clearBtn) {
      clearBtn.addEventListener('click', function(){
        inputArea.value = '';
        outputCode.textContent = ''; outputCode.className = '';
        lastFormattedJson = '';
        setBadge('', ''); setStatus('');
        showToast('已清空', 'success');
        inputArea.focus();
      });
    }

    // Sample
    if (sampleBtn) {
      sampleBtn.addEventListener('click', function(){
        var sample = {
          "name": "Browser Helper",
          "version": "1.0.0",
          "description": "浏览器工具箱",
          "tools": ["标签页管理", "JSON 格式化"],
          "config": { "theme": "auto", "indent": 2 },
          "stats": { "users": 12800, "rating": 4.9, "active": true }
        };
        inputArea.value = JSON.stringify(sample);
        setStatus('已加载示例数据', 'success');
        inputArea.focus();
      });
    }

    // Input clear sync
    if (inputArea) {
      inputArea.addEventListener('input', function(){
        if (!inputArea.value.trim()) {
          outputCode.textContent = ''; outputCode.className = '';
          lastFormattedJson = '';
          setBadge('', ''); setStatus('');
        }
      });

      // Tab key
      inputArea.addEventListener('keydown', function(e){
        if (e.key === 'Tab') {
          e.preventDefault();
          var s = inputArea.selectionStart, end = inputArea.selectionEnd;
          inputArea.value = inputArea.value.substring(0, s) + '  ' + inputArea.value.substring(end);
          inputArea.selectionStart = inputArea.selectionEnd = s + 2;
        }
      });

      // Auto-format on paste: detect from clipboardData, format immediately
      inputArea.addEventListener('paste', function(e){
        var text = (e.clipboardData || window.clipboardData).getData('text');
        if (!text) return;
        var t = text.trim();
        if ((t.startsWith('{')&&t.endsWith('}')) || (t.startsWith('[')&&t.endsWith(']'))) {
          try { formatJSON(t); } catch(e){}
        } else if (t.startsWith('"')&&t.endsWith('"')) {
          try { unescapeJSON(t); } catch(e){}
        }
      });

      // Auto-paste
      inputArea.addEventListener('focus', function(){
        if (!inputArea.value) {
          try {
            navigator.clipboard.readText().then(function(text){
              if (text && !inputArea.value) {
                var t = text.trim();
                if ((t.startsWith('{')&&t.endsWith('}')) || (t.startsWith('[')&&t.endsWith(']')) || (t.startsWith('"')&&t.endsWith('"'))) {
                  inputArea.value = text;
                  setStatus('已粘贴并格式化', 'success');
                  var pasteText = text.trim();
                  if ((pasteText.startsWith('{')&&pasteText.endsWith('}')) || (pasteText.startsWith('[')&&pasteText.endsWith(']'))) {
                    try { formatJSON(pasteText); } catch(e){}
                  }
                }
              }
            }).catch(function(){});
          } catch(e) {}
        }
      });
    }

    // Divider
    setupDivider();
  }

  return { init: init };
})();
