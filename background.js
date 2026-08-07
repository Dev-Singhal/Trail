// Minimal service worker. Currently just handles first-install setup;
// the popup and board pages talk to chrome.storage directly.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("board/board.html") });
  }
});
