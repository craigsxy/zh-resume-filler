// 日期适配器：精度感知 + 五级降级链
// L1 原生控件 → L2 框架模型写值 → L3 面板驱动（能力探测） → L4 键入 → L5 跳过并回滚
// 硬规则：任何一级失败都不写脏值；全链路失败回滚原值并跳过

import { clickEl, fire, isVisible, leavesOf, sleep, tagOf, waitFor, setNativeValue } from '../util.js';

const pad = n => String(n).padStart(2, '0');

export function parseTarget(raw, precision = 'day') {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})(?:\s*[-/.月]\s*(\d{1,2}))?/);
  if (!m) m = s.match(/^(\d{4})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : 1;
  const d = m[3] ? Number(m[3]) : 1;
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d, precision };
}

export function toISO(target, precision = 'day') {
  if (precision === 'year') return String(target.y);
  if (precision === 'month') return `${target.y}-${pad(target.m)}`;
  return `${target.y}-${pad(target.m)}-${pad(target.d)}`;
}

/**
 * 资料值本身的精度（不是字段声明的精度）。
 * v1 的资料库是月粒度，升级成日粒度字段后老数据仍然是 "2020-09"，
 * 不能因为字段声明是 day 就把它当 2020-09-01 写出去。
 */
export function rawPrecision(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 'day';
  if (/^\d{4}\s*年?$/.test(s)) return 'year';
  if (/^\d{4}\s*[-/.年]\s*\d{1,2}\s*月?$/.test(s)) return 'month';
  return 'day';
}

const PRECISION_RANK = { year: 0, month: 1, day: 2 };

/** 取更粗的那个精度：写进网页的有效精度 = min(资料精度, 控件精度) */
export function coarserPrecision(a, b) {
  const ra = PRECISION_RANK[a];
  const rb = PRECISION_RANK[b];
  if (ra == null) return rb == null ? 'day' : b;
  if (rb == null) return a;
  return ra <= rb ? a : b;
}

export function parseReadback(text) {
  const s = String(text || '');
  let m = s.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})(?:\s*[-/.月]\s*(\d{1,2}))?/);
  if (m) return { y: +m[1], m: +m[2], d: m[3] ? +m[3] : null };
  m = s.match(/(19|20)\d{2}(\d{2})(\d{2})?/);
  if (m) return { y: +m[0].slice(0, 4), m: +m[2], d: m[3] ? +m[3] : null };
  return null;
}

function verifyDate(rb, target) {
  if (!rb) return 'fail';
  if (target.precision === 'year') return rb.y === target.y ? 'ok' : 'fail';
  if (rb.y !== target.y || rb.m !== target.m) return 'fail';
  if (target.precision === 'month') return 'ok';
  // 回读里没有"日" = 网页控件只到年月。资料是日粒度也照样算成功：
  // 这就是"能填多细填多细，网页不收就降级"的落点，不能因此判失败回滚。
  if (rb.d == null) return 'month-ok';
  return rb.d === target.d ? 'ok' : 'fail';
}

async function readDateBack(field, deps) {
  const el = field.el;
  if (deps && deps.bridge && el) {
    const r = await deps.bridge.readModel(el);
    if (r && r.ok && r.value) return String(r.value);
  }
  if (el && 'value' in el && String(el.value || '').trim()) return String(el.value).trim();
  const box = field.container || (el && el.parentElement);
  if (box) return String(box.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return '';
}

function rawValueOf(field) {
  try {
    return field.el && 'value' in field.el ? String(field.el.value || '') : '';
  } catch (_) {
    return '';
  }
}

function restore(field, original) {
  try {
    if (!field.el || field.el.readOnly) return;
    if (rawValueOf(field) === original) return;
    setNativeValue(field.el, original);
    fire(field.el, 'input', { bubbles: true });
    fire(field.el, 'change', { bubbles: true });
  } catch (_) {}
}

function writeNativeDate(el, target, mode) {
  const v = mode === 'month' ? `${target.y}-${pad(target.m)}` : `${target.y}-${pad(target.m)}-${pad(target.d)}`;
  try {
    setNativeValue(el, v);
    fire(el, 'input', { bubbles: true });
    fire(el, 'change', { bubbles: true });
    return { ok: String(el.value || '') !== '', readback: String(el.value || '') };
  } catch (_) {
    return { ok: false };
  }
}

function classifySelect(sel) {
  const nums = [...sel.options]
    .map(o => {
      const raw = String(o.value || o.textContent || '').replace(/[^\d]/g, '');
      return raw ? Number(raw) : NaN;
    })
    .filter(n => !Number.isNaN(n));
  if (!nums.length) return 'unknown';
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  if (max > 1900) return 'year';
  if (max === 12 && min <= 1) return 'month';
  if (max >= 28) return 'day';
  return 'unknown';
}

async function writeTripleSelect(selects, target) {
  if (!selects || !selects.length) return { ok: false };
  const want = { year: target.y, month: target.m, day: target.d };
  const order = ['year', 'month', 'day'];
  let allOk = true;
  const readback = [];
  selects.forEach((sel, i) => {
    let kind = classifySelect(sel);
    if (kind === 'unknown') kind = order[i] || 'unknown';
    const value = want[kind];
    if (value == null) return;
    const opts = [...sel.options];
    let hit = opts.find(o => Number(String(o.value || o.textContent).replace(/[^\d]/g, '')) === value);
    if (!hit) hit = opts.find(o => String(o.textContent).trim() === String(value));
    if (!hit) {
      allOk = false;
      return;
    }
    try {
      setNativeValue(sel, hit.value);
      fire(sel, 'input', { bubbles: true });
      fire(sel, 'change', { bubbles: true });
      readback.push(String(hit.textContent || '').trim());
    } catch (_) {
      allOk = false;
    }
  });
  await sleep(80);
  return { ok: allOk, readback: readback.join('-') };
}

// ---------- 日历面板 ----------

const PANEL_SEL = [
  '[class*="calendar"]',
  '[class*="Calendar"]',
  '[class*="datepicker"]',
  '[class*="date-picker"]',
  '[class*="picker-panel"]',
  '[class*="date-panel"]',
  '[class*="DatePanel"]',
].join(',');

/**
 * 同一个日期，不同站点认不同写法：有的只认 2026-10-01，有的认 2026/10/01，
 * 有的必须带年月日（2026年10月1日），个别老系统只吃 20261001。
 * 原来只试一种格式，一种被拒就整条链判失败 —— 这是"有的时间能填、有的不能"的主因。
 */
function dateInputVariants(target, precision = 'day') {
  const iso = toISO(target, precision);
  const y = target.y;
  const m = target.m || 1;
  const d = target.d || 1;
  const out = [];
  if (precision === 'year') {
    out.push(String(y), `${y}年`);
    return out;
  }
  if (precision === 'month') {
    out.push(iso, iso.replace(/-/g, '/'), iso.replace(/-/g, '.'), String(y) + pad(m), `${y}年${m}月`, `${y}-${m}`);
    return out;
  }
  out.push(
    iso,
    iso.replace(/-/g, '/'),
    iso.replace(/-/g, '.'),
    `${y}/${m}/${d}`,
    `${y}年${m}月${d}日`,
    `${y}年${pad(m)}月${pad(d)}日`,
    `${y}${pad(m)}${pad(d)}`,
    // 以下四种是"网页只到年月"时的降级写法：控件会拒收完整日期，只认年月
    iso.slice(0, 7),
    iso.slice(0, 7).replace('-', '/'),
    `${y}年${m}月`,
    `${y}${pad(m)}`
  );
  return [...new Set(out)];
}

/** 能不能直接键入：只有原生 input / textarea 才算能写（div 伪控件交给面板） */
function canTypeInto(field) {
  const el = field && field.el;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
  if (el.readOnly || el.disabled) return false;
  return (el.type || 'text').toLowerCase() !== 'file';
}

function depthOf(el) {
  let d = 0;
  let n = el;
  while (n && n !== document.body) {
    d++;
    n = n.parentElement;
  }
  return d;
}

function findCalendarPanel(field, known) {
  const trig = field.el;
  const cands = [];
  for (const el of document.querySelectorAll(PANEL_SEL)) {
    if (!isVisible(el)) continue;
    if (trig && el.contains(trig)) continue;
    const leaves = leavesOf(el);
    const numeric = leaves.filter(l => /^\d{1,4}$/.test(String(l.textContent).trim())).length;
    const txt = String(el.innerText || el.textContent || '');
    // 北森的日历是 panel > header(年月标题/日期输入框) + pane(日网格) 两层，
    // 只按"最深"会把 header 甩在外面 → 年月读成 null（真机 day:view-mismatch(null-null)）
    const hasYM = /(19|20)\d{2}\s*年/.test(txt) && /\d{1,2}\s*月/.test(txt);
    // 有的版本年份只存在于 header 输入框的 value 里，不在文本里。
    // 输入框为空时靠类名/type 认（.phoenix-calendar-date-input），
    // 否则面板根会被判成"没有日期输入框"，输给下面的日网格
    const hasDateInput = [...el.querySelectorAll('input')].some(x => {
      const meta =
        String(x.className || '') +
        ' ' +
        String(x.getAttribute('name') || '') +
        ' ' +
        String(x.getAttribute('type') || '');
      const v = String(x.value || '') + ' ' + String(x.placeholder || '');
      return /date/i.test(meta) || /\d{4}\s*[-/年]/.test(v) || /请选择|请输入日期|日期/.test(v);
    });
    if (numeric < 10 && !hasYM) continue;
    // 点开字段时"新冒出来的那个"才是这个字段的面板：
    // 上一个字段的日历若还挂在 DOM 里（有的组件只隐藏不销毁），
    // 会按"最深/最多数字"把旧的挑走，于是点了半天空转 → 弹出弹窗但填不上。
    const isNew = known ? !known.has(el) : 0;
    cands.push({ el, numeric, hasYM, hasDateInput, depth: depthOf(el), isNew });
  }
  if (!cands.length) return null;
  // v2.0.30：**被更大候选包含的不算独立面板**。真机教训：日历结构是
  //   <div.phoenix-calendar-panel>（真根：header + 日格子） > <span.phoenix-calendar-ym-select>（头部）
  // 两个类名都命中 PANEL_SEL。旧的"数字叶子更少/更深优先"排序会把**头部 span**选成面板根，
  // 真根被当成它的内层候选丢掉 → 日格子永远探测不到 → 只能走年月下拉，
  // 站点明明支持"年月日"却被填成年月、甚至被站点自动落成错误日期（2026-10-02 → 2026-10-10）。
  // 现在先剔除"被包含的候选"，再优先选数字叶子多（真有日格子）的那层。
  const tops = cands.filter(c => !cands.some(o => o !== c && o.el.contains(c.el)));
  const pool = tops.length ? tops : cands;
  pool.sort(
    (a, b) =>
      b.isNew - a.isNew ||
      b.hasDateInput - a.hasDateInput ||
      b.hasYM - a.hasYM ||
      b.numeric - a.numeric ||
      b.depth - a.depth
  );
  return pool[0].el;
}

async function typeInto(el, text) {
  try {
    el.focus();
  } catch (_) {}
  setNativeValue(el, text);
  fire(el, 'input', { bubbles: true });
  fire(el, 'change', { bubbles: true });
  await sleep(150);
  return String(el.value || '').trim();
}

/**
 * 提交一次日期文本，返回"组件是否接受了这次输入"。
 * 受控组件拒收时的表现是：回车后输入框被清空、面板仍开着。
 * 只看回车前的值会被骗过去（写进去了又被清掉 = 没填上）。
 */
async function commitPanelDate(panel, el, text, target, field) {
  const kept = await typeInto(el, text);
  if (!kept || !new RegExp(String(target.y)).test(kept)) return false;
  try {
    fire(el, 'keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
  } catch (_) {}
  await sleep(240);
  const after = String(el.value || '').trim();
  if (after) return true;
  // 输入框被清空：面板关了说明值已提交到外层，没关就是被拒收
  const stillOpen = document.body.contains(panel) && isVisible(panel);
  if (stillOpen) return false;
  const trig = String((field && field.el && field.el.value) || '');
  return new RegExp(String(target.y)).test(trig);
}

/** 部分选择器/日历需要再点一次"确定"才把值提交到外层输入框 */
async function clickConfirm(panel) {
  const confirm = [...panel.querySelectorAll('button,[role="button"],[class*="confirm"],[class*="ok"]')].find(
    b => isVisible(b) && /^(确定|确认|完成|ok|confirm)$/i.test(String(b.textContent || '').trim().slice(0, 4))
  );
  if (!confirm) return false;
  clickEl(confirm);
  await sleep(180);
  return true;
}

/**
 * 日历自带的日期输入框（北森 .phoenix-calendar-date-input）是最快的入口：
 * 它是 React 受控输入，必须走原型 setter + 冒泡 input 事件，React 才会收到 onChange
 */
async function fillPanelInput(panel, target, field) {
  const cands = [...panel.querySelectorAll('input')].filter(el => {
    if (!isVisible(el) || el.readOnly || el.disabled) return false;
    const t = String(el.type || 'text').toLowerCase();
    return ['text', 'search', ''].includes(t) || t === 'tel';
  });
  if (!cands.length) return false;
  // 优先选"里面已经有日期文本"的那个输入框
  const el =
    cands.find(x => /\d{4}\s*[-/年]/.test(String(x.value || '') + String(x.placeholder || ''))) || cands[0];

  // 月/年粒度：组件只认完整日期时，YYYY-MM 会被拒收，
  // 这时补一个 01 号再试（组件按字段格式回显，界面上仍然只显示到月）
  const variants = [toISO(target, target.precision)];
  if (target.precision !== 'day') {
    variants.push(toISO({ ...target, m: target.m || 1, d: 1 }, 'day'));
    variants.push(toISO({ ...target, d: target.d || 1 }, 'day'));
  }
  let accepted = false;
  for (const text of [...new Set(variants)]) {
    if (await commitPanelDate(panel, el, text, target, field)) {
      accepted = true;
      break;
    }
  }
  if (!accepted) return false;

  // 部分选择器需要再点一次"确定"
  if (document.body.contains(panel) && isVisible(panel)) await clickConfirm(panel);
  return true;
}

/** 关闭日历面板：失败后不关，会把下一个字段的下拉面板搜索污染成"又一个日历" */
async function closeDatePanel(field) {
  try {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  } catch (_) {}
  if (field && field.el) {
    fire(field.el, 'keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
  }
  try {
    if (document.body) clickEl(document.body);
  } catch (_) {}
  await sleep(160);
}

/**
 * 写成功之后必须把日历面板收掉。
 *
 * 真机截图（用户提供）：`开始时间` 已经有值了，但**日历面板还开着**挂在页面上，
 * 于是下一个 `结束时间` 的点击打在了面板上 → 结束时间永远是空的；
 * 第 2 段的两个日期同理，整段日期都填不上。
 * 之前只在"失败"和"降级"分支里关面板，成功路径没关 —— 这就是漏的那一步。
 */
async function settleAfterFill(field, out) {
  if (out && out.status === 'filled') {
    try {
      await closeDatePanel(field);
    } catch (_) {}
  }
  return out;
}

function readView(panel) {  // innerText 在部分环境（jsdom / 某些 portal）拿不到，必须退到 textContent
  const txt = String(panel.innerText || panel.textContent || '');
  const years = txt.match(/(19|20)\d{2}/g);
  const mm = txt.match(/(\d{1,2})\s*月/);
  let y = years ? Number(years[0]) : null;
  let m = mm ? Number(mm[1]) : null;
  // 日网格拼起来的数字串会伪造出"年份"（…18 19 20 21… → 1920），
  // 有月份标题才算可信；否则以 header 输入框的值为准
  if (m == null || y == null) {
    for (const el of panel.querySelectorAll('input')) {
      const hit = String(el.value || '').match(/(\d{4})\s*[-/年]\s*(\d{1,2})/);
      if (hit) {
        y = Number(hit[1]);
        m = Number(hit[2]);
        break;
      }
    }
  }
  return { y, m };
}

function probePanel(panel) {
  const leaves = leavesOf(panel).filter(l => isVisible(l));
  const numLeaves = leaves.filter(l => /^\d{1,4}$/.test(String(l.textContent).trim()));
  const years = numLeaves.filter(l => {
    const n = Number(l.textContent);
    return n > 1900 && n < 2100;
  });
  const small = numLeaves.filter(l => {
    const n = Number(l.textContent);
    return n >= 1 && n <= 31;
  });
  const months = numLeaves.filter(l => {
    const n = Number(l.textContent);
    return n >= 1 && n <= 12;
  });
  return {
    leaves,
    years,
    small,
    months,
    selects: [...panel.querySelectorAll('select')].filter(isVisible),
    hasYearGrid: years.length >= 8,
    hasDayGrid: small.length >= 20,
    hasMonthGrid: months.length >= 10 && small.length < 20,
    view: readView(panel),
  };
}

function clickLeaf(leaf) {
  if (!leaf) return false;
  clickEl(leaf);
  if (leaf.parentElement) clickEl(leaf.parentElement);
  return true;
}

function pickExact(leaves, value) {
  const hit = leaves.filter(l => String(l.textContent).trim() === String(value));
  if (!hit.length) return false;
  return clickLeaf(hit[0]);
}

function findNav(panel, targetYear) {
  const p = probePanel(panel);
  const cur = p.years.map(l => Number(l.textContent));
  if (!cur.length) return null;
  const dir = targetYear < Math.min(...cur) ? 'prev' : 'next';
  const pat =
    dir === 'prev' ? /prev|before|left|上一|前一|last/i : /next|after|right|下一|后一|forward/i;
  const cands = [...panel.querySelectorAll('button,[role="button"],a,span,i')].filter(
    el => isVisible(el) && el.children.length <= 1
  );
  return (
    cands.find(el => {
      const cls = String(el.className || '');
      const aria = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      return pat.test(cls) || pat.test(aria) || pat.test(title);
    }) || null
  );
}

async function pickYear(panel, target) {
  let p = probePanel(panel);
  if (!p.hasYearGrid) {
    // 点标题里的年份切到"年视图"：标题可能是 "2026"、"2026年"、"2026年10月" 三种写法，
    // 原来只认第一种，后两种会直接判失败 → 年份切不过去 → 后面的月份/日子全对不上
    const label = p.leaves.find(l => {
      const t = String(l.textContent).trim();
      if ([...t].length > 8) return false;
      return /^(19|20)\d{2}\s*年?$/.test(t) || (/^(19|20)\d{2}\s*年/.test(t) && /年/.test(t));
    });
    if (label) {
      clickLeaf(label);
      await sleep(220);
      p = probePanel(panel);
    }
  }
  if (!p.hasYearGrid) return false;
  for (let i = 0; i < 14; i++) {
    if (p.years.some(l => Number(l.textContent) === target)) {
      if (pickExact(p.years, target)) {
        await sleep(220);
        return true;
      }
      return false;
    }
    const nav = findNav(panel, target);
    if (!nav) return false;
    clickEl(nav);
    await sleep(220);
    p = probePanel(panel);
  }
  return false;
}

async function pickMonth(panel, target) {
  let p = probePanel(panel);
  if (!p.hasMonthGrid) {
    const label = p.leaves.find(l => {
      const t = String(l.textContent).trim();
      if (!/^\d{1,2}$/.test(t)) return false;
      const near = String((l.parentElement && l.parentElement.textContent) || '');
      return /月/.test(near);
    });
    if (label) {
      clickLeaf(label);
      await sleep(200);
      p = probePanel(panel);
    }
  }
  if (p.hasDayGrid) {
    // 月精度控件若直接是日面板，选中当月任意一天会写错日，交由调用方判失败
    return false;
  }
  if (!p.hasMonthGrid) return false;
  if (!pickExact(p.months, target)) return false;
  await sleep(220);
  return true;
}

function findNavByDir(panel, dir, preferMonth = false) {
  const pat = dir === 'prev' ? /prev|before|left|上一|前一|last/i : /next|after|right|下一|后一|forward/i;
  const monthPat = dir === 'prev' ? /(prev|last|上一|前一).*month|month.*(prev|last)/i : /(next|后一|下一).*month|month.*(next)/i;
  const cands = [...panel.querySelectorAll('button,[role="button"],a,span,i')].filter(
    el => isVisible(el) && el.children.length <= 1
  );
  const match = el => {
    const cls = String(el.className || '');
    const aria = el.getAttribute('aria-label') || '';
    const title = el.getAttribute('title') || '';
    return pat.test(cls) || pat.test(aria) || pat.test(title) || pat.test(String(el.textContent || ''));
  };
  if (preferMonth) {
    const m = cands.find(el => monthPat.test(String(el.className || '')) || monthPat.test(el.getAttribute('aria-label') || ''));
    if (m) return m;
  }
  return cands.find(match) || null;
}

/** 在"日格子"面板上翻月：日期组件靠左右箭头切月，不是点月份格子 */
async function shiftMonth(panel, target) {
  for (let i = 0; i < 24; i++) {
    const v = readView(panel);
    if (v.y == null || v.m == null) return false;
    if (v.y === target.y && v.m === target.m) return true;
    const back = target.y < v.y || (target.y === v.y && target.m < v.m);
    const nav = findNavByDir(panel, back ? 'prev' : 'next', true);
    if (!nav) return false;
    clickEl(nav);
    await sleep(170);
  }
  return false;
}

/** 失败/存疑时把面板长什么样记下来，下一轮不用再靠现象猜 */
function panelHint(panel) {
  if (!panel) return {};
  const leaves = leavesOf(panel)
    .map(l => String(l.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  // 日网格会把 1~31 全拼进文本（"2026年8月123456…"），对定位毫无用处，剔掉
  const nums = leaves.filter(t => /^\d{1,4}$/.test(t));
  const keep = nums.length >= 20 ? leaves.filter(t => !/^\d{1,4}$/.test(t)) : leaves;
  const txt = [...new Set(keep)].join(' ').slice(0, 120);
  return { panelSel: tagOf(panel), panelText: txt };
}

/**
 * 在一批根节点的可见"短文本叶子"里找文本完全匹配的节点并点它。
 * 用于年月下拉面板：年份列表（2025 / 2025年）、月份列表（9月 / 09月）。
 * 搜索范围限定在面板和浮层容器里，避免点到页面正文中碰巧同名的字。
 *
 * v2.0.29 新增 exclude：下拉头自己的子树要**排除**。真机证据：面板头是
 * 「<span>2026年</span><span>10月</span>」两个子节点，头部文字会被当成"年份选项/月份选项"
 * 点中（attempts 里 ym-year:ok + ym-month:ok，但 panel 还开着、值没提交）——
 * 点头部只会开合下拉，永远选不中。
 */
async function clickTextLeaf(re, roots, exclude) {
  const blocked = el => {
    if (!exclude) return false;
    try {
      return el === exclude || exclude.contains(el);
    } catch (_) {
      return false;
    }
  };
  for (const root of roots) {
    if (!root || blocked(root)) continue;
    let nodes = [];
    try {
      nodes = [...root.querySelectorAll('li,td,div,span,a,p')];
    } catch (_) {
      continue;
    }
    const hit = nodes.find(el => {
      if (blocked(el)) return false;
      if (!isVisible(el)) return false;
      if (el.children.length > 2) return false; // 只认叶子/浅节点
      const t = String(el.textContent || '').replace(/\s+/g, '');
      return t && re.test(t);
    });
    if (hit) {
      clickLeaf(hit);
      await sleep(240);
      return true;
    }
  }
  return false;
}

/**
 * 虚拟滚动列表兜底：目标项没渲染出来时，滚动容器找它。
 * 真机证据：年列表是虚拟滚动，面板默认 2026 年时列表里**根本没有 2025**，
 * 直接找会 ym-year:fail；接着点月就会用面板里的旧年份（2026）提交出错误日期。
 * jsdom 等无布局环境 scrollHeight=0，自动退化为普通查找，不影响测试。
 */
async function clickTextLeafScrollable(re, roots, exclude) {
  if (await clickTextLeaf(re, roots, exclude)) return true;
  const scrollables = [];
  for (const root of roots) {
    if (!root || root === exclude) continue;
    let els = [];
    try {
      els = [...root.querySelectorAll('*')];
    } catch (_) {
      continue;
    }
    for (const el of els) {
      try {
        if (el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 20) scrollables.push(el);
      } catch (_) {}
      if (scrollables.length > 6) break;
    }
    if (scrollables.length > 6) break;
  }
  for (const sc of scrollables) {
    const saved = sc.scrollTop;
    let top = 0;
    try {
      top = Math.max(0, (sc.scrollHeight || 0) - (sc.clientHeight || 0));
    } catch (_) {}
    for (let y = 0; y <= top; y += 160) {
      try {
        sc.scrollTop = y;
      } catch (_) {}
      await sleep(90);
      if (await clickTextLeaf(re, roots, exclude)) return true;
    }
    try {
      sc.scrollTop = saved;
    } catch (_) {}
  }
  return false;
}

/**
 * 年月下拉面板（北森 phoenix-calendar-ym-select）：
 * 面板上没有日格子、也没有月格子，只有一个「2026年 10月」的下拉头；
 * 点它才展开年份列表和月份列表。真机证据：4 个日期字段全部
 * `panel:no-day-grid` + `panelText: "2026年 10月"`，连月粒度降级都失败。
 * 流程：点头 → 点目标年 → 点目标月（很多组件点完月就提交并关面板）。
 */
async function driveYmPanel(panel, target, attempts) {
  let head = null;
  try {
    head = [...panel.querySelectorAll('[class*="ym-select"],[class*="ymSelect"]')].find(isVisible);
  } catch (_) {}
  if (!head) {
    head = leavesOf(panel).find(l => {
      const t = String(l.textContent || '').replace(/\s+/g, '');
      return /^\d{4}年\d{1,2}月?$/.test(t);
    });
  }
  // 面板被识别得很深（比如整个"面板"就是那个下拉头 span 自己）时，
  // 叶子里不会有它 —— 直接看面板自身的文本
  if (!head) {
    const selfText = String(panel.textContent || '').replace(/\s+/g, '');
    if (/^\d{4}年\d{1,2}月?$/.test(selfText)) head = panel;
  }
  if (!head) return false;
  if (head === panel) clickEl(head);
  else clickLeaf(head);
  await sleep(320);

  // 展开后的列表可能在面板里，也可能在兄弟浮层里 —— 两处都找
  const roots = [panel];
  try {
    roots.push(
      ...[...document.querySelectorAll('[class*="unmodeled-layer"],[class*="calendar"],[class*="dropdown"]')].filter(
        el => isVisible(el) && el.tagName !== 'INPUT'
      )
    );
  } catch (_) {}

  const yOk = await clickTextLeafScrollable(new RegExp('^' + target.y + '年?$'), roots, head);
  attempts.push('ym-year:' + (yOk ? 'ok' : 'fail'));
  if (yOk) await sleep(280);

  // 年没点到时不能照旧点月：面板还停在旧年份，点月会提交出**错误年份**的日期
  // （真机：目标 2025-09，年没点到就点了 9月 → 提交 2026-09，页面被写花）。
  // 只有"下拉头当前显示的年份恰好就是目标年"才允许继续。
  if (!yOk) {
    let headYear = null;
    try {
      const m = String((head && head.textContent) || '').match(/(19|20)\d{2}/);
      if (m) headYear = Number(m[0]);
    } catch (_) {}
    if (headYear !== target.y) {
      attempts.push('ym-year-mismatch:' + headYear);
      return false;
    }
  }

  const mOk = await clickTextLeafScrollable(new RegExp('^0?' + target.m + '月?$'), roots, head);
  attempts.push('ym-month:' + (mOk ? 'ok' : 'fail'));
  await sleep(260);
  return mOk;
}

/** 外层控件是否已落上 y-m 这个年月（"2026-10" / "2026年10月" / "2026/10"，可带日） */
function trigHasYm(field, y, m) {
  try {
    const v = String((field && field.el && field.el.value) || '');
    if (!v) return false;
    return new RegExp(String(y) + '\\s*[-/年]\\s*0?' + m + '(月|\\D|$)').test(v);
  } catch (_) {
    return false;
  }
}

/**
 * 中间月跳板（2.0.32，真机诊断 8 个 date-failed 的最后一块）：
 * 月份列表缺的是「当前视图月」——目标月恰好是当前月时列表里没有它，
 * 「本月」在真机上又不落值（复刻页里能落、真机不能，`ymsel-month:already` 全是假成功）。
 * 办法：先点一个**别的月**（必然在列表里）提交出中间值，点月即提交的组件会顺带关面板；
 * 再重开面板——此时视图/已选月已变成中间月，目标月回到列表里，点它即可。
 * 证据：同站点目标月≠当前月的字段（2026-09、2025-11、2026-06）全部一次点中；
 * 失败的 8 个全是 2026-10-xx（=今天 10 月）。
 */
async function driveYmViaIntermediate(field, panel, target, attempts) {
  const trigger = field && field.el;
  if (!trigger) return false;
  // ⑤a 现面板里点一个「中间月」（≠目标月；优先相邻月，多半不用滚动就在列表里）
  const cands = [target.m === 1 ? 2 : target.m - 1, target.m === 12 ? 11 : target.m + 1, 1, 12].filter(
    m => m !== target.m
  );
  let interOk = false;
  for (const im of [...new Set(cands)]) {
    // 视图月（标题里那个）不在候选里，所以不会误点头部标签
    if (await clickTextLeafScrollable(new RegExp('^0?' + im + '月$'), [panel], null)) {
      interOk = true;
      break;
    }
  }
  attempts.push('ymsel-inter-month:' + (interOk ? 'ok' : 'fail'));
  await sleep(320);

  // ⑤b 面板还开着就直接复用；关了就重开（点月即提交的组件此刻已关）
  let panel2 = panel;
  const stillOpen = document.body.contains(panel) && isVisible(panel);
  if (stillOpen) {
    attempts.push('ymsel-reopen:reuse');
  } else {
    const known = new Set();
    try {
      for (const el of document.querySelectorAll(PANEL_SEL)) known.add(el);
    } catch (_) {}
    try {
      trigger.focus();
    } catch (_) {}
    clickEl(trigger);
    panel2 = await waitFor(() => findCalendarPanel(field, known), 1000, 80);
    attempts.push('ymsel-reopen:' + (panel2 ? 'ok' : 'fail'));
    if (!panel2) return false;
  }

  // ⑤c 目标月现在应该回到列表里了；点它 + 确认，回读裁决
  const mOk = await clickTextLeafScrollable(new RegExp('^0?' + target.m + '月?$'), [panel2], null);
  attempts.push('ymsel-inter-target:' + (mOk ? 'ok' : 'fail'));
  await clickConfirm(panel2);
  await sleep(300);
  return trigHasYm(field, target.y, target.m);
}

/**
 * 年月选择器（形态 2，phoenix-date-picker 年月模式）：
 * 面板打开就是「标题 + 年份入口 + 月份列表」的月份视图；点**标题里的年份标签**
 * （如「2026年」）切到年份视图（年代 + 年份列表），点年份回月份视图，点月份提交。
 * 月份列表会缺「当前月」（已选中态不在可选列表里）。
 *
 * 真机证据（16 个 date-failed 的两个模式）：
 *  - `ym-year:fail + ym-year-mismatch`：目标年≠当前年。driveYmPanel 点「完整年月标题」
 *    切不到年份视图，点年自然失败；而 pickYear 点「年份标签」能切过去。
 *  - `ym-year:ok + ym-month:fail`：目标年=当前年。driveYmPanel 点年误点了「年份入口」，
 *    面板停在了年份视图，点月找不到；且目标月=当前月时列表里根本没有这个月。
 * 这里不走「点头部展开下拉」，而是读视图 → pickYear 点年 → 点月 → 点「本月」提交。
 *
 * 2.0.32 补充（真机第二轮诊断，8 个 date-failed 全是 2026-10-xx）：
 * 目标月=当前月时走 `already` 是**假成功**——「本月」在真机上不落值。
 * 所以提交后必须回读外层输入框裁决；没落上就走 driveYmViaIntermediate 中间月跳板。
 */
async function driveYmSelector(field, panel, target, attempts) {
  let view = readView(panel);
  if (!view || view.y == null || view.m == null) return false;

  // ① 年份不对 → pickYear 点年（点标题年份标签切年份视图 + pickExact 点目标年）
  if (view.y !== target.y) {
    const ok = await pickYear(panel, target.y);
    attempts.push('ymsel-year:' + (ok ? 'ok' : 'fail'));
    if (!ok) return false;
    await sleep(220);
    view = readView(panel);
  } else {
    attempts.push('ymsel-year:already');
  }

  // ② 确保回到月份视图：点标题里的月份标签（当前月「N月」）切回月份列表。
  //    pickYear 点完年可能停在年份视图；driveYmPanel 失败也可能把面板留在年份视图。
  //    列表缺「当前月」，所以「N月」只存在于标题里，点它不会误点到列表项。
  view = readView(panel);
  if (view && view.m != null) {
    const back = await clickTextLeafScrollable(new RegExp('^0?' + view.m + '月$'), [panel], null);
    attempts.push('ymsel-month-view:' + (back ? 'ok' : 'none'));
    if (back) await sleep(200);
    view = readView(panel);
  }

  // ③ 月份不对 → 点目标月（列表「N月」文本）。目标月=当前月时列表缺它，走 already。
  let mOk = !!(view && view.m === target.m);
  if (mOk) {
    attempts.push('ymsel-month:already');
  } else {
    mOk = await clickTextLeafScrollable(new RegExp('^0?' + target.m + '月?$'), [panel], null);
    attempts.push('ymsel-month:' + (mOk ? 'ok' : 'fail'));
  }
  if (!mOk) return false;

  // ④ 年月已对齐 → 提交：点「本月」这类快捷项（若存在）+「确定」（若存在），
  //    然后**回读外层输入框裁决**——真机上「本月」可能只是导航不落值，不能凭"点了"就算成功。
  await clickTextLeafScrollable(/^(本月|这个月|当前月|今月)$/, [panel], null);
  await clickConfirm(panel);
  await sleep(260);
  if (trigHasYm(field, target.y, target.m)) return true;

  // ⑤ 没落上（真机：目标月=当前月，列表缺它且「本月」无效）→ 中间月跳板
  attempts.push('ymsel-this-month:no-commit');
  return await driveYmViaIntermediate(field, panel, target, attempts);
}

async function drivePanel(field, target) {
  const trigger = field.el;
  const attempts = [];
  // 点之前先记下"已经存在的日历面板"：点开之后新冒出来的那个才是这个字段的。
  // 上一个字段的日历若只隐藏不销毁，会被按"最深/数字最多"挑走 → 空转 → 弹窗拉起了但填不上。
  const knownPanels = new Set(document.querySelectorAll(PANEL_SEL));
  try {
    trigger.focus();
  } catch (_) {}
  clickEl(trigger);
  let panel = await waitFor(() => findCalendarPanel(field, knownPanels), 1000, 80);
  if (!panel) return { ok: false, reason: 'panel-not-open', attempts };

  /** 成功返回：带上面板引用 + 面板文本，上层据此判断"值是提交了还是只是点了一下" */
  const done = extra => ({ ok: true, ...extra, panel, ...panelHint(panel) });

  // ⓪ 面板自带日期输入框（北森 .phoenix-calendar-date-input）：直接键入最快，
  //    它是 React 受控输入，必须走原型 setter + 冒泡 input 事件，React 才会收到 onChange
  const typed = await fillPanelInput(panel, target, field);
  attempts.push('panel-input:' + (typed ? 'ok' : 'none'));
  if (typed) {
    const closed = !document.body.contains(panel) || !isVisible(panel);
    if (closed) return done({ via: 'panel-input', attempts });
    const pv = probePanel(panel);
    if (pv.view.y === target.y && pv.view.m === target.m) {
      if (target.precision === 'day' && pv.hasDayGrid) {
        const hit = pickExact(pv.small, target.d);
        attempts.push('panel-input-day:' + (hit ? 'ok' : 'fail'));
        await sleep(200);
        return done({ ok: hit, via: 'panel-input', attempts });
      }
      return done({ via: 'panel-input', attempts });
    }
  }

  let p = probePanel(panel);

  // ⓪.6 年月下拉面板：既没有日格子也没有月格子，只有一个「2026年 10月」下拉头。
  //     这是"网页只收年月"的另一种形态（点选而不是键入），必须在 no-day-grid
  //     判失败**之前**试掉 —— 真机上 4 个日期字段全卡在这里。
  if (!p.hasDayGrid && !p.hasMonthGrid) {
    const okYm = await driveYmPanel(panel, target, attempts);
    attempts.push('ym-panel:' + (okYm ? 'ok' : 'fail'));
    if (okYm) {
      await clickConfirm(panel);
      return done({ via: 'panel-ym', precision: 'month', attempts });
    }
    // 形态 2：年月选择器（点标题年份切视图，而非点头部展开下拉）
    const okYm2 = await driveYmSelector(field, panel, target, attempts);
    attempts.push('ymsel-panel:' + (okYm2 ? 'ok' : 'fail'));
    if (okYm2) {
      return done({ via: 'panel-ym', precision: 'month', attempts });
    }
  }

  // ① 面板内部是原生 select
  if (p.selects.length >= 2) {
    const r = await writeTripleSelect(p.selects, target);
    attempts.push('panel-selects:' + (r.ok ? 'ok' : 'fail'));
    if (r.ok) return done({ via: 'panel-selects', attempts });
  }

  // ② 年
  if (p.view.y !== target.y || (!p.hasDayGrid && !p.hasMonthGrid)) {
    const ok = await pickYear(panel, target.y);
    attempts.push('year:' + (ok ? 'ok' : 'fail'));
    await sleep(160);
    p = probePanel(panel);
  }

  if (target.precision === 'year') {
    return done({ ok: p.view.y === target.y, via: 'panel-year', attempts });
  }

  // ②.5 面板能力探测：只有年月网格、没有日格子的面板 = 网页只收年月。
  //      日粒度资料在这里降级成月粒度写入并判成功（原来会一路走到 no-day-grid 而失败，
  //      等于"资料越细，在粗粒度网页上越填不上"，和需求正好相反）。
  if (target.precision === 'day' && !p.hasDayGrid && p.hasMonthGrid) {
    const rightMonth = p.view.y === target.y && p.view.m === target.m;
    const okM = rightMonth ? true : await pickMonth(panel, target.m);
    attempts.push('month-fallback:' + (okM ? 'ok' : 'fail'));
    if (!okM) return { ok: false, reason: 'no-month-grid', attempts, panel, ...panelHint(panel) };
    await clickConfirm(panel);
    return done({ via: 'panel-month', precision: 'month', attempts });
  }

  // ③ 月：月精度必须点月份；**日精度也必须先把视图切到目标月**，
  //    否则日格子还停在当月，点"7"只会写成本月的 7 号（这是 date-failed 的常见原因）
  if (target.precision === 'month') {
    const alreadyRight = p.view.y === target.y && p.view.m === target.m && !p.hasMonthGrid;
    if (!alreadyRight) {
      const ok = await pickMonth(panel, target.m);
      attempts.push('month:' + (ok ? 'ok' : 'fail'));
      await sleep(160);
      p = probePanel(panel);
    }
    return done({ ok: p.view.m === target.m || alreadyRight, via: 'panel-month', attempts });
  }

  // 日精度：先对齐月份
  p = probePanel(panel);
  if (p.view.m !== target.m || p.view.y !== target.y) {
    const shifted = await shiftMonth(panel, target);
    attempts.push('shift-month:' + (shifted ? 'ok' : 'fail'));
    if (!shifted) {
      // 兜底：点"2026年1月"标题切到月视图，再点月份（很多日历组件这么做）
      const head = p.leaves.find(l => {
        const t = String(l.textContent || '').trim();
        return [...t].length <= 12 && /年|\d{1,2}\s*月/.test(t);
      });
      if (head) {
        clickLeaf(head);
        await sleep(240);
        let q = probePanel(panel);
        if (q.hasYearGrid && q.view.y !== target.y) {
          await pickYear(panel, target.y);
          await sleep(200);
          q = probePanel(panel);
        }
        const okM = q.hasMonthGrid ? await pickMonth(panel, target.m) : false;
        attempts.push('month-view:' + (okM ? 'ok' : 'fail'));
        await sleep(200);
      }
    }
    await sleep(160);
    p = probePanel(panel);
  }

  // ④ 日
  if (!p.hasDayGrid) return { ok: false, reason: 'no-day-grid', attempts, panel, ...panelHint(panel) };
  const view = readView(panel);
  if (view.y !== target.y || view.m !== target.m) {
    attempts.push('day:view-mismatch(' + view.y + '-' + view.m + ')');
    return { ok: false, reason: 'view-mismatch', attempts, panel, ...panelHint(panel) };
  }
  const ok = pickExact(p.small, target.d);
  attempts.push('day:' + (ok ? 'ok' : 'fail'));
  await sleep(200);
  return done({ ok, via: 'panel', attempts });
}

/**
 * 直接键入。
 * ① 依次试多种日期写法，谁"粘住了"就用谁（组件会把不接受的格式当场清空）；
 * ② 粘住之前**不 fire blur**：很多站点的格式化/校验挂在 blur 上，
 *    提前 blur 会把刚写进去的值改写成别的样子（甚至清空），这是我们自己制造的失败；
 * ③ 返回实际生效的格式，报告里能看到"这次是靠哪种写法填上的"。
 */
/** 记住"这个站点上哪种日期写法是通的"，下一个日期字段直接先试它 */
let preferredFormat = null;

async function typeDate(field, target) {
  const el = field.el;
  if (!el || el.readOnly || el.disabled) return { ok: false, reason: 'readonly' };
  const all = dateInputVariants(target, target.precision);
  const variants =
    preferredFormat && all.includes(preferredFormat)
      ? [preferredFormat, ...all.filter(v => v !== preferredFormat)]
      : all;

  for (const v of variants) {
    try {
      el.focus();
    } catch (_) {}
    setNativeValue(el, v);
    fire(el, 'input', { bubbles: true });
    await sleep(70);

    let kept = String(el.value || '').trim();
    if (!kept) continue; // 组件当场清空 = 不认这个格式

    fire(el, 'change', { bubbles: true });
    await sleep(30);
    kept = String(el.value || '').trim();
    if (!kept) continue;

    const rb = parseReadback(kept);
    // 年月对得上就算"粘住了"（日/精度差异交给 finish() 统一裁决）
    if (rb && rb.y === target.y && (rb.m == null || rb.m === target.m)) {
      fire(el, 'blur', { bubbles: false });
      await sleep(60);
      preferredFormat = v;
      return { ok: true, typed: v, kept: String(el.value || '').trim() || kept, format: v };
    }
  }
  // 一种都没粘住：把控件恢复原状，不留半截脏值
  try {
    setNativeValue(el, '');
  } catch (_) {}
  return { ok: false, reason: 'value-rejected' };
}

/**
 * 日期字段写入
 *
 * 精度是"资料精度"和"控件精度"取更粗的那个：
 * 资料库按日存（能填多细填多细），网页只要年月（有的网申压根不看日）时自动降级写 YYYY-MM，
 * 校验也只比年月，判成功而不是日期失败。
 *
 * @returns {{status:'filled'|'skipped'|'failed', reason?:string, via?:string, precision?:string, downgraded?:string, readback?:string, attempts?:string[]}}
 */
async function writeDateOnce(plan, deps) {
  const declared = plan.precision || 'day';
  const parsed = parseTarget(plan.value, declared);
  if (!parsed) return { status: 'skipped', reason: 'value-not-a-date' };

  // v1 老数据只有年月（"2020-09"）：字段声明是 day 也不能当成 2020-09-01
  const target = { ...parsed, precision: coarserPrecision(declared, rawPrecision(plan.value)) };

  const field = plan.field;
  const ck = field.controlKind;
  const original = rawValueOf(field);
  const attempts = [];

  /** @param {{via?:string, precision?:string}} info 精度可由具体写入路径按控件能力改写 */
  const finish = async info => {
    const prec = info.precision || target.precision;
    const rb = await readDateBack(field, deps);
    const verdict = verifyDate(parseReadback(rb), { ...target, precision: prec });
    const downgraded = prec !== target.precision ? prec : undefined;
    if (verdict === 'ok') {
      return { status: 'filled', via: info.via, readback: rb, attempts, ...(downgraded ? { downgraded } : {}) };
    }
    if (verdict === 'month-ok') {
      return { status: 'filled', via: info.via, readback: rb, downgraded: 'month', attempts };
    }
    return { status: 'skipped', reason: 'date-verify-failed', readback: rb, attempts };
  };

  // L1 原生控件。控件能接受的最细格式（type=date 必须给完整日期）和"校验精度"是两件事：
  // 后者取控件精度的更粗者，前者照控件本身的类型来。
  if (ck === 'DATE_NATIVE_DAY' || ck === 'DATE_NATIVE_MONTH') {
    const controlPrec = ck === 'DATE_NATIVE_MONTH' ? 'month' : 'day';
    const r = writeNativeDate(field.el, target, controlPrec === 'month' ? 'month' : 'day');
    attempts.push('native:' + (r.ok ? 'ok' : 'fail'));
    if (r.ok) {
      const out = await finish({ via: 'native', precision: coarserPrecision(target.precision, controlPrec) });
      if (out.status === 'filled') return settleAfterFill(field, out);
    }
  }
  if (ck === 'DATE_TRIPLE_SELECT') {
    const selects = field.inputs || [];
    const controlPrec = selects.length >= 3 ? 'day' : 'month';
    const r = await writeTripleSelect(selects, target);
    attempts.push('triple:' + (r.ok ? 'ok' : 'fail'));
    if (r.ok) {
      const out = await finish({ via: 'triple-select', precision: coarserPrecision(target.precision, controlPrec) });
      if (out.status === 'filled') return settleAfterFill(field, out);
    }
  }

  // L2 框架模型写值
  if (deps && deps.bridge) {
    const iso = toISO(target, target.precision);
    const r2 = await deps.bridge.setModelValue(field.el, iso);
    attempts.push('model:' + (r2 && r2.ok ? 'ok' : (r2 && r2.reason) || 'fail'));
    if (r2 && r2.ok) {
      const out = await finish({ via: 'model' });
      if (out.status === 'filled') return settleAfterFill(field, out);
    }
  }

  // L3a 键入优先（只对"可编辑的普通文本框"）
  //
  // 这是这轮的关键调整。北森这类站点的日期控件在 DOM 里就是一个 type="text" 的普通输入框
  // （值就是 "2026-10-01" 字符串），能直接键入。原来的顺序是"先开面板、面板失败才键入"，
  // 而面板失败后**面板还开着**，焦点被面板抢走 → 键入被组件当场清空 → 判失败，
  // 表面现象就是"弹窗拉起了，但开始/结束时间没填上"。
  // 现在：能键入的**纯文本框**先键入（多种格式依次试），成了就不碰面板；不行再走面板。
  // 组件化日期控件（phoenix-date-picker 这类，controlKind = DATE_CUSTOM/PICKER）
  // 仍然面板优先：它们只认自己面板里的选中动作，硬写 DOM 值往往是"看着在、模型里没有"。
  const wantsPanelFirst =
    ck === 'DATE_CUSTOM' || ck === 'PICKER' || ck === 'SELECT_CUSTOM' || !canTypeInto(field);
  if (!wantsPanelFirst) {
    const r = await typeDate(field, target);
    attempts.push('typing:' + (r.ok ? 'ok(' + r.format + ')' : r.reason || 'fail'));
    if (r.ok) {
      const out = await finish({ via: 'typing' });
      if (out.status === 'filled') return settleAfterFill(field, out);
      attempts.push('typing-verify:fail');
    }
  }

  // L3 面板驱动（面板自身的能力探测在 drivePanel 里做，可能把精度改成 month）
  const r3 = await drivePanel(field, target);
  attempts.push('panel:' + (r3.ok ? 'ok' : r3.reason || 'fail'));
  if (r3.attempts && r3.attempts.length) attempts.push(...r3.attempts.map(a => 'panel>' + a));
  if (r3.ok) {
    // 「弹窗拉起来了」≠「值提交了」。面板没自行关闭时补点一次确定，
    // 再把外层控件的真实值读回来判断，不能只凭 drivePanel 自称成功就收工。
    const stillOpen = !!(r3.panel && document.body.contains(r3.panel) && isVisible(r3.panel));
    if (stillOpen) {
      attempts.push('panel-open');
      if (await clickConfirm(r3.panel)) attempts.push('panel-confirm');
      await sleep(200);
    }
    const out = await finish({ via: r3.via || 'panel', precision: r3.precision });
    if (out.status === 'filled') return settleAfterFill(field, out);
    // 值没落到控件上：把面板特征带进 attempts，方便在报告里定位是哪个日历
    if (r3.panelSel) attempts.push('panel-sel:' + r3.panelSel);
    if (r3.panelText) attempts.push('panel-text:' + String(r3.panelText).slice(0, 40));
  }

  // L4 键入兜底：面板已经开过一轮，**必须先关掉面板再键入**，
  // 否则焦点还在面板上，键入的字符进不了控件（这轮之前就是漏了这一步）
  if (canTypeInto(field)) {
    await closeDatePanel(field);
    attempts.push('panel-closed');
    const r4 = await typeDate(field, target);
    attempts.push('typing2:' + (r4.ok ? 'ok(' + r4.format + ')' : r4.reason || 'fail'));
    if (r4.ok) {
      const out = await finish({ via: 'typing' });
      if (out.status === 'filled') return settleAfterFill(field, out);
    }
  }

  // L4.5 整条链降级到「月」
  //
  // 很多网申的日期控件只收年月（界面就是 `2026-10`，右侧挂个日历图标，根本没有"日"），
  // 资料里 `2025-10-01` 这种日粒度值怎么写都进不去 —— 原来会直接判 date-failed，
  // 等于"资料越细越填不上"，和需求正好相反。
  // 这里用 `2025-10` 把完整链路（原生 / 键入 / 面板）重跑一遍，成功就按
  // "网页只到年月，已按年月写入"收工。**网页只到年月不是错误，是站点能力。**
  if (target.precision === 'day') {
    await closeDatePanel(field);
    const monthPlan = { ...plan, precision: 'month', value: toISO(target, 'month') };
    const r5 = await writeDate(monthPlan, deps);
    attempts.push('downgrade-month:' + (r5.status === 'filled' ? 'ok' : r5.reason || 'fail'));
    if (r5.status === 'filled') {
      return {
        ...r5,
        attempts: [...attempts, ...(r5.attempts || []).map(a => 'm>' + a)],
        downgraded: 'month',
        precision: 'month',
      };
    }
  }

  // L5 全部失败：关掉面板（否则会污染下一个字段的下拉搜索），回滚原值，绝不留下脏值
  await closeDatePanel(field);
  restore(field, original);
  return {
    status: 'skipped',
    reason: 'date-failed',
    attempts,
    ...(r3 && r3.panelSel ? { panelSel: r3.panelSel } : {}),
    ...(r3 && r3.panelText ? { panelText: String(r3.panelText).slice(0, 120) } : {}),
  };
}

/**
 * 资料只到年月（「2025-08」）、网页日历只收完整日期时：先按年月试，被拒就补成该月 1 号再试一次。
 * 真机（tupu360 · antd 日历）：面板输入框只认 YYYY-MM-DD，年月面板点不出来 → 五级全失败。
 * 补的是 1 号，报告里标注 padded-day，让你知道"日"是插件补的。
 */
export async function writeDate(plan, deps) {
  const first = await writeDateOnce(plan, deps);
  if (first.status === 'filled') return first;
  const raw = String(plan.value ?? '').trim();
  const prec = rawPrecision(raw);
  if (prec !== 'month' && prec !== 'year') return first;
  // 第一遍连日历面板都没打开、也没能键入：控件根本不接，补成 1 号也一样，别再等一轮超时
  const reached = (first.attempts || []).some(a => /^(panel>|typing:ok|native:ok|triple:ok)/.test(String(a)));
  if (!reached) return first;
  const t = parseTarget(raw, prec);
  if (!t) return first;
  const padded = `${t.y}-${String(t.m || 1).padStart(2, '0')}-01`;
  const second = await writeDateOnce({ ...plan, value: padded, precision: 'day' }, deps);
  if (second.status !== 'filled') {
    return { ...first, attempts: [...(first.attempts || []), 'pad-01:' + (second.reason || 'fail')] };
  }
  return { ...second, note: 'padded-day', attempts: [...(first.attempts || []), 'pad-01:ok', ...(second.attempts || [])] };
}
