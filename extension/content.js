const ext = (typeof chrome !== "undefined" && chrome.runtime ? chrome : browser);
function send(payload) {
  ext.runtime.sendMessage({ kind: "event", payload });
  if (typeof window !== "undefined" && window.__BROWSER_MEMORY_DEBUG) {
    console.log("[Browser Memory] captured:", payload.type, payload.url || location.href);
  }
}

function getSelector(el) {
  if (!el) return null;
  if (el.id) return `#${el.id}`;
  const tag = (el.tagName || "").toLowerCase();
  const name = el.getAttribute?.("name");
  if (name) return `${tag}[name="${name}"]`;
  const cls = (el.className || "").toString().split(" ").filter(Boolean).slice(0, 2).join(".");
  if (cls) return `${tag}.${cls}`;
  return tag || null;
}

document.addEventListener("click", (e) => {
  const el = e.target;
  const text = (el?.innerText || "").trim().slice(0, 80);
  send({
    type: "click",
    url: location.href,
    title: document.title,
    text_content: text || null,
    selector: getSelector(el),
    metadata: { x: e.clientX, y: e.clientY }
  });
}, true);

document.addEventListener("change", (e) => {
  const el = e.target;
  if (!el) return;

  const tag = (el.tagName || "").toLowerCase();
  if (tag !== "input" && tag !== "textarea" && tag !== "select") return;

  // DO NOT capture actual typed text; only safe context
  const placeholder = el.getAttribute?.("placeholder") || null;
  const ariaLabel = el.getAttribute?.("aria-label") || null;
  const name = el.getAttribute?.("name") || null;
  const type = el.getAttribute?.("type") || null;

  send({
    type: "form_interaction",
    url: location.href,
    title: document.title,
    text_content: `input changed: ${ariaLabel || placeholder || name || "unknown"}`.slice(0, 120),
    selector: getSelector(el),
    metadata: { inputType: type }
  });
}, true);
