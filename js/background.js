// background.js - Palext background worker
// Icon click opens floating page tool. Keyboard shortcut opens classic popup window.

const uiPorts = {
  popup: new Set()
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'palext-popup') return;
  uiPorts.popup.add(port);
  port.onDisconnect.addListener(() => uiPorts.popup.delete(port));
});

async function getActiveTabInCurrentWindow() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  }
  return tab || null;
}

async function openClassicPopupWindow(size = {}) {
  const width = Math.max(360, Math.min(520, Number(size.width) || 410));
  const height = Math.max(520, Math.min(760, Number(size.height) || 620));
  await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html?classic=1'),
    type: 'popup',
    width,
    height
  });
  return { ok: true, width, height };
}

async function tryInjectContentScript(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['js/content.js']
    });
    return true;
  } catch (_) {
    return false;
  }
}

function sendOpenFloatingMessage(tabId, startInspect = false) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'OPEN_FLOATING_TOOL', startInspect: !!startInspect }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message || 'Could not open floating tool.' });
        return;
      }
      resolve(resp && resp.ok ? { ok: true } : { ok: false, error: 'Could not open floating tool.' });
    });
  });
}

async function openFloatingToolOnTab(tabId, startInspect = false) {
  const first = await sendOpenFloatingMessage(tabId, startInspect);
  if (first.ok) return first;

  const reason = String(first.error || '').toLowerCase();
  const missingReceiver = reason.includes('receiving end does not exist') || reason.includes('could not establish connection');
  if (!missingReceiver) return first;

  const injected = await tryInjectContentScript(tabId);
  if (!injected) return first;

  return sendOpenFloatingMessage(tabId, startInspect);
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab || !tab.id || !/^https?:\/\//i.test(String(tab.url || ''))) {
      await openClassicPopupWindow();
      return;
    }
    const opened = await openFloatingToolOnTab(tab.id, false);
    if (!opened.ok) {
      await openClassicPopupWindow();
    }
  } catch (_) {
    void openClassicPopupWindow();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open_classic_popup') return;
  try {
    const tab = await getActiveTabInCurrentWindow();
    if (tab && tab.id && /^https?:\/\//i.test(String(tab.url || ''))) {
      const opened = await openFloatingToolOnTab(tab.id, false);
      if (opened.ok) return;
    }
    await openClassicPopupWindow({ width: 420, height: 640 });
  } catch (_) {}
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return false;

  if (msg.type === 'OPEN_DETACHED_POPUP') {
    (async () => {
      try {
        sendResponse(await openClassicPopupWindow(msg));
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not open detached window.' });
      }
    })();
    return true;
  }

  if (msg.type !== 'INSPECT_CAPTURED') return false;

  (async () => {
    try {
      chrome.runtime.sendMessage({ type: 'PAL_EXT_INSPECT_CAPTURED' }, () => {
        void chrome.runtime.lastError;
      });

      if (uiPorts.popup.size > 0) {
        sendResponse({ ok: true, reopened: false, surface: 'popup' });
        return;
      }

      if (chrome.action && chrome.action.openPopup) {
        await chrome.action.openPopup();
        sendResponse({ ok: true, reopened: true, surface: 'popup' });
        return;
      }

      await openClassicPopupWindow({ width: 410, height: 620 });
      sendResponse({ ok: true, reopened: true, surface: 'popup' });
    } catch (_) {
      sendResponse({ ok: false, reopened: false });
    }
  })();

  return true;
});
