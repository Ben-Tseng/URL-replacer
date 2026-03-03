const api = typeof browser !== "undefined" ? browser : chrome;

function getSelectedText() {
  try {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "TEXTAREA" ||
        (active.tagName === "INPUT" &&
          /^(text|search|url|tel|password|email)$/i.test(active.type)))
    ) {
      const start = typeof active.selectionStart === "number" ? active.selectionStart : 0;
      const end = typeof active.selectionEnd === "number" ? active.selectionEnd : 0;
      if (end > start) return active.value.slice(start, end).trim();
    }

    const selected = window.getSelection ? String(window.getSelection()) : "";
    return selected.trim();
  } catch (e) {
    return "";
  }
}

function reportSelection() {
  const text = getSelectedText();
  if (!text) return;

  try {
    const maybePromise = api.runtime.sendMessage({
      type: "selection-updated",
      text
    });
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => {});
    }
  } catch (e) {
    // Ignore message failures (e.g. transient extension lifecycle events).
  }
}

let timer = null;
function reportSelectionDebounced() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(reportSelection, 120);
}

document.addEventListener("mouseup", reportSelection, true);
document.addEventListener("keyup", reportSelectionDebounced, true);
document.addEventListener("selectionchange", reportSelectionDebounced, true);
