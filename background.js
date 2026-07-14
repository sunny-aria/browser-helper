// ===== Browser Helper - Background Service Worker =====

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
