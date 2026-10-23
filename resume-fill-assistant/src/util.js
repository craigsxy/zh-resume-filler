// 通用工具：归一化、相似度、冲突守卫、DOM 动作、条件等待

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 归一化：小写 + 去掉空白/标点/符号，用于标签与选项比对 */
export const normalize = s => String(s ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

/** 清掉占位噪音，避免"请输入/请选择"干扰匹配 */
export const cleanLabel = s =>
  String(s ?? '')
    .replace(/请输入|请选择|请填写|请上传|选填|必填|（必填）|\(必填\)/g, '')
    .replace(/^[*＊\s]+/, '')
    .replace(/[:：]\s*$/, '')
    .trim();

/** 字符多重集 Dice 系数（对中文比 Jaccard 稳，"开始时间"vs"结束时间"=0.5） */
export function charDice(a, b) {
  const A = [...a];
  const B = [...b];
  if (!A.length || !B.length) return 0;
  const bag = new Map();
  for (const c of A) bag.set(c, (bag.get(c) || 0) + 1);
  let inter = 0;
  for (const c of B) {
    const n = bag.get(c) || 0;
    if (n > 0) {
      inter++;
      bag.set(c, n - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

const START_RE = /开始|起始|入学|入职|进入|就读|起|start|begin/;
const END_RE = /结束|毕业|离职|离开|终止|止|end|finish/;

/**
 * 语义冲突守卫：起止时间、学历学位这类"长得像但含义相反"的标签必须硬隔离，
 * 否则字符 Dice 会把"开始时间"误配到"结束时间"。
 */
export function conflicts(a, b) {
  const A = String(a || '');
  const B = String(b || '');
  if (START_RE.test(A) && END_RE.test(B)) return true;
  if (END_RE.test(A) && START_RE.test(B)) return true;
  return false;
}

/** 标签文本越长，越可能是整块容器的聚合文本，权重越低 */
export function lengthPenalty(text) {
  const n = [...String(text || '')].length;
  if (n > 24) return 0.45;
  if (n > 14) return 0.78;
  if (n > 10) return 0.92;
  return 1;
}

let layoutChecked = false;
let layoutAvailable = true;

/** 无布局引擎（jsdom 等测试环境）时跳过几何可见性判断，只认样式与 hidden 属性 */
function hasLayoutEngine() {
  if (!layoutChecked) {
    layoutChecked = true;
    try {
      layoutAvailable = !!(document.body && document.body.getClientRects && document.body.getClientRects().length);
    } catch (_) {
      layoutAvailable = false;
    }
  }
  return layoutAvailable;
}

export function isVisible(el) {
  if (!el || !el.getClientRects) return false;
  if (el.hasAttribute && el.hasAttribute('hidden')) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none') return false;
  if (Number(cs.opacity) === 0) return false;
  if (!hasLayoutEngine()) return true;
  return el.getClientRects().length > 0;
}

/** 元素所属的 window realm：iframe / 测试环境（jsdom）里全局 Event 与文档不同源 */
function realmOf(el) {
  const doc = el && el.ownerDocument;
  const view = doc && doc.defaultView;
  if (view && typeof view.Event === 'function') return view;
  if (typeof window !== 'undefined' && window && typeof window.Event === 'function') return window;
  return globalThis;
}

/**
 * 派发事件：必须用元素自己 realm 的构造器，否则会报
 * "Failed to execute 'dispatchEvent': parameter 1 is not of type 'Event'"
 */
export function fire(el, type, init = {}) {
  if (!el || typeof el.dispatchEvent !== 'function') return false;
  const R = realmOf(el);
  const opts = { bubbles: true, cancelable: true, ...init };
  const ctors = type.startsWith('key')
    ? [R.KeyboardEvent, R.Event]
    : /^(mouse|click|pointer|focus|blur)/.test(type)
      ? [R.MouseEvent, R.Event]
      : [R.Event];
  for (const C of ctors) {
    if (typeof C !== 'function') continue;
    try {
      el.dispatchEvent(new C(type, opts));
      return true;
    } catch (_) {}
  }
  try {
    const ev = el.ownerDocument.createEvent('Event');
    ev.initEvent(type, opts.bubbles !== false, true);
    el.dispatchEvent(ev);
    return true;
  } catch (_) {}
  return false;
}

/** 绕过 React/Vue 的 value tracker，直接写原生值 */
export function setNativeValue(el, value) {
  const view = realmOf(el);
  const tag = el.tagName;
  const proto =
    tag === 'TEXTAREA'
      ? view.HTMLTextAreaElement && view.HTMLTextAreaElement.prototype
      : tag === 'SELECT'
        ? view.HTMLSelectElement && view.HTMLSelectElement.prototype
        : view.HTMLInputElement && view.HTMLInputElement.prototype;
  let desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
  if (!desc || !desc.set) {
    // 兜底：沿原型链往上找带 setter 的 value
    let n = Object.getPrototypeOf(el);
    while (n && !desc) {
      desc = Object.getOwnPropertyDescriptor(n, 'value');
      n = Object.getPrototypeOf(n);
    }
  }
  if (desc && desc.set) desc.set.call(el, value);
  else el.value = value;
}

/**
 * 完整指针/鼠标序列：比单个 click() 更容易被自绘组件接住。
 *
 * v2.0.15 起补了两样东西，都是为了更贴近"真人用鼠标点"：
 * ① **真实坐标**（元素中心点）—— 有些组件在事件里做 hit-test 或用坐标算落点，
 *    事件坐标恒为 (0,0) 时会被判成"点在不可交互区域"直接忽略；
 * ② `pointerId` 与 `detail` —— 指针状态机和双击判定都依赖这两个字段。
 */
export function clickEl(el) {
  if (!el) return false;
  const R = realmOf(el);
  let cx = 0;
  let cy = 0;
  try {
    const r = el.getBoundingClientRect();
    if (r && (r.width || r.height)) {
      cx = Math.round(r.left + r.width / 2);
      cy = Math.round(r.top + r.height / 2);
    }
  } catch (_) {}
  const opts = {
    bubbles: true,
    cancelable: true,
    view: R,
    button: 0,
    buttons: 1,
    clientX: cx,
    clientY: cy,
    screenX: cx,
    screenY: cy,
    detail: 1,
  };
  // 部分自绘列表项只在 hover 之后才挂"可点"状态（真机：北森多选下拉的网格项
  // 点下去没反应，但真实鼠标划过再点就正常）——补上 hover 序列，代价很小。
  try {
    fire(el, 'pointerover', { ...opts, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
    fire(el, 'mouseover', opts);
    fire(el, 'pointermove', { ...opts, buttons: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
    fire(el, 'mousemove', opts);
  } catch (_) {}
  const P = R.PointerEvent;
  if (P) {
    fire(el, 'pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
    fire(el, 'mousedown', opts);
    fire(el, 'pointerup', { ...opts, buttons: 0, pointerType: 'mouse', isPrimary: true, pointerId: 1 });
    fire(el, 'mouseup', { ...opts, buttons: 0 });
  } else {
    fire(el, 'mousedown', opts);
    fire(el, 'mouseup', { ...opts, buttons: 0 });
  }
  fire(el, 'click', { ...opts, buttons: 0 });
  return true;
}

/** 条件等待：替代固定 sleep，命中即返回 */
export async function waitFor(fn, timeout = 1500, interval = 60) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    let r = null;
    try {
      r = fn();
    } catch (_) {
      r = null;
    }
    if (r) return r;
    await sleep(interval);
  }
  return null;
}

/** 从任意文本里抽数字（"3.6/4.0"→3.6，"15k-20k"→15000） */
export function numericOf(text) {
  const s = String(text ?? '').replace(/\s/g, '');
  const k = s.match(/(-?\d+(?:\.\d+)?)\s*[kK]/);
  if (k) return String(Math.round(parseFloat(k[1]) * 1000));
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

export function textOf(el) {
  if (!el) return '';
  if ('value' in el && typeof el.value === 'string' && el.value.trim()) return el.value.trim();
  return String(el.innerText || el.textContent || '').trim();
}

export function shortText(el, max = 24) {
  return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** 叶子节点：没有子元素的有文本节点，日历/选项面板常用 */
export function leavesOf(root) {
  if (!root) return [];
  return [...root.querySelectorAll('*')].filter(
    e => e.children.length === 0 && String(e.textContent || '').trim()
  );
}

export function cssEsc(s) {
  try {
    return CSS.escape(s);
  } catch (_) {
    return String(s).replace(/["\\]/g, '\\$&');
  }
}

/** 诊断用短标签：<div.phoenix-select.phoenix-select--large> */
export function tagOf(el) {
  if (!el || !el.tagName) return '';
  const cls = String(el.className || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join('.');
  return `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}>`;
}

/** 诊断用祖先链：往上一层层拼出来，定位"扫描器停在了哪" */
export function pathOf(el, max = 6) {
  const out = [];
  let n = el && el.parentElement;
  let d = 0;
  while (n && n.nodeType === 1 && n !== document.body && d < max) {
    out.push(tagOf(n));
    n = n.parentElement;
    d++;
  }
  return out.join(' < ');
}
