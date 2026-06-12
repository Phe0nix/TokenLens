// background.js - TokenLens background worker
// Re-opens the extension UI after inspect capture is completed.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'INSPECT_CAPTURED') return false;

  (async () => {
    try {
      if (chrome.action && chrome.action.openPopup) {
        await chrome.action.openPopup();
        sendResponse({ ok: true, reopened: true });
        return;
      }

      // Fallback for browsers where action.openPopup is unavailable.
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 430,
        height: 650
      });
      sendResponse({ ok: true, reopened: true });
    } catch (_) {
      sendResponse({ ok: false, reopened: false });
    }
  })();

  return true;
});
