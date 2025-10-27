const copyBtn = document.getElementById("copyBtn");
const statusEl = document.getElementById("status");

const setStatus = (msg, ok = true) => {
  statusEl.textContent = msg || "";
  statusEl.className = "status " + (ok ? "ok" : "err");
};

async function runInActiveTab(fnOrFileCall) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab.");
  if (fnOrFileCall.files) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: fnOrFileCall.files,
    });
    return tab.id;
  } else {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fnOrFileCall.func,
    });
    return result;
  }
}

async function copyChapter() {
  copyBtn.disabled = true;
  setStatus("Working…", true);

  try {
    const tabId = await runInActiveTab({ files: ["content.js"] });

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__chapterToMarkdown?.run(),
    });

    const payload = result?.[0]?.result;
    if (!payload || !payload.markdown)
      throw new Error("No content found on this page.");

    await navigator.clipboard.writeText(payload.markdown);

    setStatus(`Copied: ${payload.title}`, true);
  } catch (e) {
    console.error(e);
    setStatus(e.message || "Failed to copy content.", false);
  } finally {
    copyBtn.disabled = false;
  }
}

copyBtn.addEventListener("click", copyChapter);
