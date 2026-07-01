// ===== Browser Helper - Background Service Worker =====

let helperWindowId = null;

// Update badge showing tab count on extension icon
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

// Update badge on tab events
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onAttached.addListener(updateBadge);
chrome.tabs.onDetached.addListener(updateBadge);
chrome.windows.onFocusChanged.addListener(updateBadge);

// Initial badge update
chrome.runtime.onInstalled.addListener(updateBadge);
updateBadge();

// Open helper as standalone window (stays open when switching tabs)
chrome.action.onClicked.addListener(() => {
  if (helperWindowId !== null) {
    chrome.windows.get(helperWindowId, (win) => {
      if (chrome.runtime.lastError || !win) {
        // Window was closed, create new one
        createWindow();
      } else {
        // Window exists, refocus it
        chrome.windows.update(helperWindowId, { focused: true });
      }
    });
  } else {
    createWindow();
  }
});

function createWindow() {
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 800,
    height: 580,
    focused: true
  }, (win) => {
    helperWindowId = win.id;
  });
}

// Track window close
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === helperWindowId) {
    helperWindowId = null;
  }
});
