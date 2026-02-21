const DEFAULT_CONFIG = {
  urlTemplate: "",
  replaceToken: ""
};

const MENU_ID = "open-replaced-url";

async function getConfig() {
  const stored = await chrome.storage.local.get(["urlTemplate", "replaceToken"]);
  return {
    urlTemplate: stored.urlTemplate || DEFAULT_CONFIG.urlTemplate,
    replaceToken: stored.replaceToken || DEFAULT_CONFIG.replaceToken
  };
}

function buildTargetUrl(urlTemplate, replaceToken, value) {
  const cleanValue = (value || "").trim();
  if (!cleanValue) return null;

  const encodedValue = encodeURIComponent(cleanValue);
  return urlTemplate.includes(replaceToken)
    ? urlTemplate.split(replaceToken).join(encodedValue)
    : urlTemplate;
}

async function promptInputInPage(tabId, replaceToken) {
  const results = await chrome.scripting.executeScript({
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

async function handleContextMenuClick(info, tab) {
  const config = await getConfig();
  if (!config.urlTemplate || !config.replaceToken) return;

  const selection = (info.selectionText || "").trim();
  const value = selection || (await promptInputInPage(tab.id, config.replaceToken));
  const targetUrl = buildTargetUrl(config.urlTemplate, config.replaceToken, value);

  if (!targetUrl) return;
  await chrome.tabs.create({ url: targetUrl });
}

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Open replaced URL",
      contexts: ["page", "selection", "editable"]
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || typeof tab.id !== "number") return;
  handleContextMenuClick(info, tab).catch(() => {});
});
