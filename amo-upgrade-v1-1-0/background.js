const api = typeof browser !== "undefined" ? browser : chrome;

// [chrome-to-firefox-release] Hardened bulk-open handler.
function __openUrlsInTabsCompat(urls) {
  const list = Array.isArray(urls)
    ? [...new Set(urls.filter((u) => typeof u === "string" && u.trim()))]
    : [];

  list.forEach((url, index) => {
    if (api && api.tabs && typeof api.tabs.create === "function") {
      api.tabs.create({ url, active: index === 0 }, () => {});
      return;
    }

    if (typeof chrome !== "undefined" && chrome.tabs && typeof chrome.tabs.create === "function") {
      chrome.tabs.create({ url, active: index === 0 }, () => {});
    }
  });

  return list.length;
}

if (api && api.runtime && api.runtime.onMessage && typeof api.runtime.onMessage.addListener === "function") {
  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "open-urls") {
      const opened = __openUrlsInTabsCompat(message.urls);
      if (typeof sendResponse === "function") {
        sendResponse({ ok: true, opened });
      }
      return;
    }
  });
}

const DEFAULT_CONFIG = {
  urlTemplates: [],
  replaceToken: ""
};

const MENU_ID = "open-replaced-url-pro";
const COMMAND_OPEN_REPLACED_URLS = "open-replaced-urls";
const MAX_TEMPLATES = 10;

async function getConfig() {
  const stored = await api.storage.local.get(["urlTemplates", "replaceToken"]);
  const templates = Array.isArray(stored.urlTemplates)
    ? stored.urlTemplates.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean).slice(0, MAX_TEMPLATES)
    : [];

  return {
    urlTemplates: templates.length ? templates : DEFAULT_CONFIG.urlTemplates,
    replaceToken: (stored.replaceToken || DEFAULT_CONFIG.replaceToken || "").trim()
  };
}

function buildTargetUrls(urlTemplates, replaceToken, value) {
  const cleanValue = (value || "").trim();
  if (!cleanValue || !replaceToken) return [];

  const encodedValue = encodeURIComponent(cleanValue);
  return urlTemplates
    .filter((template) => template.includes(replaceToken))
    .map((template) => template.split(replaceToken).join(encodedValue));
}

async function promptInputInPage(tabId, replaceToken) {
  if (api.scripting && typeof api.scripting.executeScript === "function") {
    const results = await api.scripting.executeScript({
      target: { tabId },
      func: (token) => {
        const input = window.prompt(`Enter replacement text (for example ${token}):`, "");
        return input ? input.trim() : "";
      },
      args: [replaceToken]
    });

    const first = results && results[0];
    return first && typeof first.result === "string" ? first.result : "";
  }

  if (api.tabs && typeof api.tabs.executeScript === "function") {
    const script = `(() => {
      const input = window.prompt("Enter replacement text (for example ${replaceToken.replace(/"/g, '\\"')}):", "");
      return input ? input.trim() : "";
    })();`;
    const results = await api.tabs.executeScript(tabId, { code: script });
    const first = Array.isArray(results) ? results[0] : "";
    return typeof first === "string" ? first : "";
  }

  return "";
}

async function getSelectionTextInPage(tabId) {
  if (api.scripting && typeof api.scripting.executeScript === "function") {
    const results = await api.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selected = window.getSelection ? window.getSelection().toString() : "";
        return selected ? selected.trim() : "";
      }
    });

    const first = results && results[0];
    return first && typeof first.result === "string" ? first.result : "";
  }

  if (api.tabs && typeof api.tabs.executeScript === "function") {
    const code = `(() => {
      const selected = window.getSelection ? window.getSelection().toString() : "";
      return selected ? selected.trim() : "";
    })();`;
    const results = await api.tabs.executeScript(tabId, { code });
    const first = Array.isArray(results) ? results[0] : "";
    return typeof first === "string" ? first : "";
  }

  return "";
}

async function openReplacedUrls(info, tab) {
  const config = await getConfig();
  if (!config.urlTemplates.length || !config.replaceToken) return;

  const selection = info && typeof info.selectionText === "string" ? info.selectionText.trim() : "";
  const value = selection || (await promptInputInPage(tab.id, config.replaceToken));
  const targetUrls = buildTargetUrls(config.urlTemplates, config.replaceToken, value);

  for (const url of targetUrls) {
    await api.tabs.create({ url });
  }
}

async function getActiveTab() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  const first = Array.isArray(tabs) ? tabs[0] : null;
  return first && typeof first.id === "number" ? first : null;
}

function createContextMenu() {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({
      id: MENU_ID,
      title: "Open replaced URL(s)",
      contexts: ["page", "selection", "editable"]
    });
  });
}

api.runtime.onInstalled.addListener(createContextMenu);
api.runtime.onStartup.addListener(createContextMenu);

api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || typeof tab.id !== "number") return;
  openReplacedUrls(info, tab).catch(() => {});
});

if (api.commands && api.commands.onCommand && typeof api.commands.onCommand.addListener === "function") {
  api.commands.onCommand.addListener((command) => {
    if (command !== COMMAND_OPEN_REPLACED_URLS) return;
    getActiveTab()
      .then((tab) => {
        if (!tab) return;
        return getSelectionTextInPage(tab.id)
          .then((selectionText) => openReplacedUrls({ selectionText }, tab));
      })
      .catch(() => {});
  });
}
