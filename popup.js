const DEFAULT_CONFIG = {
  urlTemplate: "",
  replaceToken: ""
};

const urlTemplateInput = document.getElementById("urlTemplate");
const replaceTokenInput = document.getElementById("replaceToken");
const saveBtn = document.getElementById("saveBtn");
const statusText = document.getElementById("status");
let autoSaveTimer = null;

function showStatus(text) {
  statusText.textContent = text;
}

async function loadConfig() {
  const stored = await chrome.storage.local.get(["urlTemplate", "replaceToken"]);
  const urlTemplate = stored.urlTemplate || DEFAULT_CONFIG.urlTemplate;
  let replaceToken = stored.replaceToken || DEFAULT_CONFIG.replaceToken;

  if (!urlTemplate || (replaceToken && !urlTemplate.includes(replaceToken))) {
    replaceToken = "";
    await chrome.storage.local.set({ replaceToken: "" });
  }

  urlTemplateInput.value = urlTemplate;
  replaceTokenInput.value = replaceToken;
}

async function saveConfig() {
  const urlTemplate = urlTemplateInput.value.trim();
  const replaceToken = replaceTokenInput.value.trim();

  if (!urlTemplate || !replaceToken) {
    showStatus("Please complete both fields before saving.");
    return;
  }

  if (!urlTemplate.includes(replaceToken)) {
    showStatus("Save failed: the replace token is not in the URL template.");
    return;
  }

  await chrome.storage.local.set({ urlTemplate, replaceToken });
  showStatus("Saved.");
}

function scheduleAutoSaveUrlTemplate() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    const urlTemplate = urlTemplateInput.value.trim();
    if (!urlTemplate) {
      replaceTokenInput.value = "";
      await chrome.storage.local.set({ urlTemplate: "", replaceToken: "" });
      showStatus("URL template is empty. Replace token cleared.");
      return;
    }

    await chrome.storage.local.set({ urlTemplate });
    showStatus("URL template auto-saved.");
  }, 300);
}

async function clearReplaceTokenIfInvalidOnBlur() {
  const urlTemplate = urlTemplateInput.value.trim();
  const replaceToken = replaceTokenInput.value.trim();

  if (!urlTemplate) {
    replaceTokenInput.value = "";
    await chrome.storage.local.set({ replaceToken: "" });
    showStatus("URL template is empty. Replace token cleared.");
    return;
  }

  if (replaceToken && !urlTemplate.includes(replaceToken)) {
    replaceTokenInput.value = "";
    await chrome.storage.local.set({ replaceToken: "" });
    showStatus("Replace token does not match URL template. Cleared.");
  }
}

saveBtn.addEventListener("click", () => {
  saveConfig().catch(() => showStatus("Save failed."));
});

urlTemplateInput.addEventListener("input", () => {
  scheduleAutoSaveUrlTemplate();
});

replaceTokenInput.addEventListener("blur", () => {
  clearReplaceTokenIfInvalidOnBlur().catch(() => showStatus("Validation failed."));
});

loadConfig().catch(() => showStatus("Failed to load settings."));
