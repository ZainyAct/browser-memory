// Use same API in both options and background: Firefox = browser, Chrome = chrome
const ext = (typeof browser !== "undefined" && browser.storage) ? browser : chrome;

const tokenEl = document.getElementById("token");
const statusEl = document.getElementById("status");

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#c00" : "#333";
}

async function load() {
  const obj = await ext.storage.local.get(["supabaseToken"]);
  const supabaseToken = obj && obj.supabaseToken;
  tokenEl.value = supabaseToken || "";
  if (supabaseToken) {
    const len = supabaseToken.length;
    const preview = len > 20 ? supabaseToken.slice(0, 10) + "…" + supabaseToken.slice(-6) : "(short)";
    showStatus(`Loaded: token in storage (length ${len}). Preview: ${preview}`);
    console.log("[Browser Memory Options] Token loaded from storage, length:", len);
  } else {
    showStatus("No token in storage. Paste your token above and click Save.");
    console.log("[Browser Memory Options] No token in storage.");
  }
}
load();

document.getElementById("save").addEventListener("click", async () => {
  const token = tokenEl.value.trim();
  if (!token) {
    showStatus("Paste a token first, then click Save.", true);
    return;
  }
  try {
    await ext.storage.local.set({ supabaseToken: token });
  } catch (e) {
    showStatus("Storage set failed: " + e.message, true);
    console.error("[Browser Memory Options] storage.local.set error:", e);
    return;
  }
  // Verify it was stored (read back)
  let obj2;
  try {
    obj2 = await ext.storage.local.get(["supabaseToken"]);
  } catch (e) {
    showStatus("Storage get failed: " + e.message, true);
    console.error("[Browser Memory Options] storage.local.get error:", e);
    return;
  }
  const supabaseToken = obj2 && obj2.supabaseToken;
  console.log("[Browser Memory Options] After save, get returned:", typeof obj2, obj2 ? Object.keys(obj2) : "n/a", "supabaseToken length:", supabaseToken ? supabaseToken.length : "missing");
  if (supabaseToken === token) {
    showStatus(`Saved. Token stored (length ${token.length}). Reload the extension, then switch tabs to test.`);
    console.log("[Browser Memory Options] Token saved and verified, length:", token.length);
  } else {
    showStatus("Save verification failed – storage read back different. See console. Reload extension and try again.", true);
    console.warn("[Browser Memory Options] Save verification failed. Read back:", supabaseToken ? "length " + supabaseToken.length : "undefined", "expected length:", token.length);
  }
});

document.getElementById("clear").addEventListener("click", async () => {
  await ext.storage.local.remove(["supabaseToken"]);
  tokenEl.value = "";
  const obj3 = await ext.storage.local.get(["supabaseToken"]);
  const supabaseToken = obj3 && obj3.supabaseToken;
  showStatus(supabaseToken ? "Clear may have failed." : "Cleared. No token in storage.");
  console.log("[Browser Memory Options] Cleared. Token in storage now:", !!supabaseToken);
});
