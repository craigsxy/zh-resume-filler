// 与主世界脚本（main-world.js）的通信桥
// React fiber / Vue 实例只存在于页面主世界，隔离世界读不到，必须靠 DOM 自定义事件转交。

let seq = 0;
const pending = new Map();

function onResponse(e) {
  let msg;
  try {
    msg = JSON.parse(e.detail);
  } catch (_) {
    return;
  }
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  p.resolve(msg);
}

let listening = false;
function ensureListener() {
  if (listening) return;
  document.addEventListener('saa-rw-response', onResponse);
  listening = true;
}

function call(op, payload = {}, timeout = 1400) {
  ensureListener();
  return new Promise(resolve => {
    const id = `r${++seq}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, reason: 'bridge-timeout' });
    }, timeout);
    pending.set(id, {
      resolve: m => {
        clearTimeout(timer);
        resolve(m);
      },
    });
    try {
      document.dispatchEvent(
        new CustomEvent('saa-rw-request', { detail: JSON.stringify({ id, op, ...payload }) })
      );
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      resolve({ ok: false, reason: 'bridge-dispatch-failed' });
    }
  });
}

/** 元素 id：用 DOM 属性跨世界传递（JS 属性不跨世界） */
export function ensureId(el) {
  if (!el) return '';
  let id = el.getAttribute('data-saa-id');
  if (!id) {
    id = `e${++seq}_${Math.random().toString(36).slice(2, 8)}`;
    el.setAttribute('data-saa-id', id);
  }
  return id;
}

export async function ping() {
  const r = await call('ping', {}, 600);
  return !!r.ok;
}

export function reactClick(el) {
  return call('reactClick', { elId: ensureId(el) }, 900);
}

export function setModelValue(el, value) {
  return call('setFieldValue', { elId: ensureId(el), value }, 1600);
}

export function readModel(el) {
  return call('readModel', { elId: ensureId(el) }, 700);
}

export function optionValue(el) {
  return call('optionValue', { elId: ensureId(el) }, 700);
}
