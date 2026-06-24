// ===== Browser Helper - Main Controller =====

(function() {
  'use strict';

  var currentTool = 'tab-manager';
  var toolInitialized = { 'tab-manager': false, 'json-formatter': false };

  // ===== Theme =====
  function initTheme() {
    var saved;
    if (chrome && chrome.storage) {
      chrome.storage.local.get('theme', function(d) {
        applyTheme(d.theme || 'light');
      });
    } else {
      saved = localStorage.getItem('browser-helper-theme');
      applyTheme(saved || 'light');
    }
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.querySelector('.icon-sun').style.display = 'none';
      document.querySelector('.icon-moon').style.display = 'block';
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.querySelector('.icon-sun').style.display = 'block';
      document.querySelector('.icon-moon').style.display = 'none';
    }
  }

  function toggleTheme() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ theme: newTheme });
    } else {
      localStorage.setItem('browser-helper-theme', newTheme);
    }
  }

  // ===== Tool Switching =====
  function switchTool(toolName) {
    if (currentTool === toolName) return;

    // Update sidebar
    document.querySelectorAll('.tool-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    // Update panels
    document.querySelectorAll('.tool-panel').forEach(function(panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + toolName);
    });

    currentTool = toolName;

    // Lazy init tool
    if (!toolInitialized[toolName]) {
      if (toolName === 'tab-manager') {
        TabManager.init();
      } else if (toolName === 'json-formatter') {
        JSONFormatter.init();
      }
      toolInitialized[toolName] = true;
    }
  }

  // ===== Init =====
  function init() {
    // Theme toggle
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Tool switching
    document.querySelectorAll('.tool-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchTool(btn.dataset.tool);
      });
    });

    // Init theme
    initTheme();

    // Init default tool (tab-manager)
    switchTool('tab-manager');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
