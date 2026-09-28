// js/core/utils.js
export function uid(prefix = "id") {
  const rnd = (crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rnd}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function on(el, evt, handler, opts) {
  el.addEventListener(evt, handler, opts);
}

export function randomCode(len = 4) {
  let code = "";
  for (let i = 0; i < len; i++) code += Math.floor(Math.random() * 10);
  return code;
}
