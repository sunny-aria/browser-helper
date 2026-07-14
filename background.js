// ===== Browser Helper - Background Service Worker =====

// Open (or focus an existing) Browser Helper standalone window.
// A standalone window is not auto-closed by Chrome when focus leaves it
// (unlike a default_popup). We capture the user's current browser window id
// and pass it via ?win= so the tab manager always targets the right window,
// regardless of which window currently has focus.
function openHelperWindow() {
  chrome.windows.getLastFocused(function(focusedWin) {
    var targetId = focusedWin ? focusedWin.id : null;
    chrome.windows.getAll({ populate: true }, function(windows) {
      var existing = windows.find(function(w) {
        return w.type === "popup" &&
          w.tabs &&
          w.tabs.some(function(t) { return t.url && t.url.indexOf("popup.html") >= 0; });
      });
      if (existing) {
        chrome.windows.update(existing.id, { focused: true });
        return;
      }
      var url = chrome.runtime.getURL("popup.html");
      if (targetId != null) url += "?win=" + targetId;
      chrome.windows.create({
        url: url,
        type: "popup",
        width: 780,
        height: 640,
        resizable: true
      });
    });
  });
}

chrome.action.onClicked.addListener(openHelperWindow);

// Update badge showing total tab count across normal browser windows
function updateBadge() {
  chrome.windows.getAll({ populate: true }, function(wins) {
    var count = 0;
    wins.forEach(function(w) {
      if (w.type === "normal" && w.tabs) count += w.tabs.length;
    });
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
