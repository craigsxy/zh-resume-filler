// L1 表单地图：把页面扫成 区块 → 重复块 → 字段 的结构化中间表示
// 目标：先建地图再动手，杜绝"边遍历边猜边填"
//
// 关键约束（北森这类结构逼出来的）：
//   ① 标签常在"只包 input 的那层 div"外面 → 容器必须选到同时含标签文本的那一层
//   ② 区块必须至少含 2 个字段，否则每个字段自己那行都会被当成区块
//   ③ 字段自己的标签文字不能被当成区块标题

import { cleanLabel, normalize, isVisible, shortText, cssEsc } from './util.js';
import { CATEGORIES } from './schema.js';

const categoryById = id => CATEGORIES.find(c => c.id === id) || { multiple: false, fields: [] };

export const FIELD_SEL = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';

const IGNORE_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

const LABEL_SEL =
  'label,[class*="label"],[class*="Label"],[class*="title"],[class*="Title"],[class*="caption"]';

// 选项节点：不能当标签用（否则"男/女/保密"会被当成字段标签）
const OPTION_SEL = '[role="radio"],[role="checkbox"],[class*="radio"],[class*="Radio"],[class*="checkbox"],[class*="Checkbox"]';
function isOptionish(n) {
  try {
    return !!(n && n.matches && n.matches(OPTION_SEL));
  } catch (_) {
    return false;
  }
}

// 区块词典：长 key 优先，保证"个人基本信息"不会被"基本信息"抢先
const SECTION_KEYS = CATEGORIES.filter(c => (c.sectionKeys || []).length)
  .flatMap(c => c.sectionKeys.map(k => ({ id: c.id, key: k })))
  .sort((a, b) => b.key.length - a.key.length);

/** 全部字段标签（归一后），用于"这是字段名不是区块名"的守卫 */
const FIELD_LABEL_SET = new Set();
for (const c of CATEGORIES) {
  for (const f of c.fields) {
    FIELD_LABEL_SET.add(normalize(f.label));
    for (const a of f.alias || []) FIELD_LABEL_SET.add(normalize(a));
  }
}

// 单次扫描内的字段计数缓存，避免同一祖先被反复 querySelectorAll
let countCache = new Map();
function countFields(node) {
  if (!node || node.nodeType !== 1) return 0;
  if (countCache.has(node)) return countCache.get(node);
  let n = 0;
  try {
    n = node.querySelectorAll(FIELD_SEL).length;
  } catch (_) {
    n = 0;
  }
  countCache.set(node, n);
  return n;
}

function matchSection(text) {
  const n = normalize(text);
  if (!n) return null;
  const len = [...n].length;
  if (len > 12) return null;
  // ① 精确等于区块名 → 最高优先级。
  //    必须先于字段守卫判断：北森里"在校职务"既是区块名、又恰好是某个字段的别名
  for (const { id, key } of SECTION_KEYS) {
    const kn = normalize(key);
    if (kn && n === kn) return { categoryId: id, key };
  }
  // ② 字段自己的标签不能当区块标题（北森会把"在校职务类别"这种字段名渲染成标题样式）
  if (FIELD_LABEL_SET.has(n)) return null;
  // ③ 包含式匹配："教育经历（本科）""一、个人信息"
  for (const { id, key } of SECTION_KEYS) {
    const kn = normalize(key);
    if (kn && n.includes(kn)) return { categoryId: id, key };
  }
  return null;
}

/** 词典里没有、但长得像区块标题（≥2 字、非字段名、非纯数字）→ 只当边界用，类目交给 inferCategory */
function looksLikeSectionTitle(t) {
  const n = normalize(t);
  if (!n) return false;
  const len = [...n].length;
  if (len < 2 || len > 12) return false;
  if (FIELD_LABEL_SET.has(n)) return false;
  if (/^[\d.\-/]+$/.test(n)) return false;
  return /[\u4e00-\u9fa5a-z]/.test(n);
}

function ownText(node) {
  if (!node) return '';
  let t = '';
  for (const c of node.childNodes) if (c.nodeType === 3) t += c.textContent;
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * 像不像一个字段标签：1-12 字、有中文、不是占位提示、不是纯数字。
 * maxLen 只对"明确的 label 节点"放宽到 30：网申常有整句问题当标签
 * （「你是从哪个渠道获取招聘信息的」「是否有医药类公司或医药类项目实习经验」），
 * 12 字上限会把它们整个丢掉 → 空标签 / 被邻居标签抢走。
 */
function looksLikeLabel(t, maxLen = 12) {
  const s = String(t || '').replace(/\s+/g, '');
  if (!s) return false;
  const len = [...s].length;
  if (len < 1 || len > maxLen) return false;
  if (/^[\d.\-/年月日]+$/.test(s)) return false;
  if (/^(请选择|请输入|请填写|请上传|选填|必填|请输入内容|暂无)$/.test(s)) return false;
  return /[\u4e00-\u9fa5]/.test(s);
}

/**
 * 纯拉丁标签（GitHub / WeChat / Email / QQ / LinkedIn）。
 * v2.0.19 起只在"明确的 label 节点"上认（见 labelTextsOf 的 ① 号通道）：
 * 兄弟文本那两条启发式通道不认，否则按钮文案（Submit / Search / Next）会被当成字段名。
 * 这是"自定义字段填不上"的一个真实原因——原来要求标签必须含中文，
 * 英文标签连字段都算不上，用户怎么命名都对不上。
 */
const LATIN_LABEL_STOP = /^(submit|reset|search|ok|yes|no|cancel|confirm|close|next|prev|back|save|login|logout|more)$/i;
function looksLikeLatinLabel(t) {
  const s = String(t || '').replace(/\s+/g, '');
  if (!s) return false;
  const len = [...s].length;
  if (len < 2 || len > 20) return false;
  if (!/^[A-Za-z][A-Za-z0-9_+#.\-]*$/.test(s)) return false;
  return !LATIN_LABEL_STOP.test(s);
}

/** <label> 或类名带 label 的节点（不含 title：区块标题也常带 title 类） */
function isExplicitLabel(n) {
  if (!n || !n.tagName) return false;
  if (n.tagName === 'LABEL') return true;
  return /label/i.test(String(n.className || ''));
}

/**
 * 收集某一层容器里"属于这个字段"的标签文本
 * 覆盖三种常见写法：label 元素 / 带 label|title 类的节点 / 兄弟元素的短文本
 */
function labelTextsOf(node, el) {
  const out = [];
  if (!node) return out;
  // body 级容器会把整页第一个"像标签"的文字捡来当字段名，纯噪音
  if (node === document.body || node === document.documentElement) return out;
  const add = (t, allowLatin = false, allowLong = false) => {
    const s = cleanLabel(t);
    if (looksLikeLabel(s) || (allowLatin && looksLikeLatinLabel(s))) {
      out.push(s);
      return;
    }
    // 明确的 label 节点上的长问题句：整句收下（自定义字段照抄网页标签就能精确命中），
    // 同时再收第一个短片段（「可实习时长（要求最少3个月及以上）」→「可实习时长」）
    if (allowLong && looksLikeLabel(s, 30)) out.push(s);
    // 整段太长时（"手机 请输入11位手机号"这种带提示语的标签）取第一个短片段
    const cut = String(s)
      .split(/[\s，,。；;：:（(【[|/]+/)
      .map(x => cleanLabel(x))
      .find(x => x && (looksLikeLabel(x) || (allowLatin && looksLikeLatinLabel(x))));
    if (cut) out.push(cut);
  };

  // ① label / label 类 / title 类节点（这条通道允许纯英文标签）
  try {
    for (const n of node.querySelectorAll(LABEL_SEL)) {
      if (n.contains(el)) continue;
      if (isOptionish(n)) continue;
      if (countFields(n) > 0) continue;
      add(shortText(n, 40), true, isExplicitLabel(n));
    }
  } catch (_) {}

  // ② 直接子元素的短文本（<div class="x"><span>姓名</span></div> 这种）
  for (const k of node.children || []) {
    if (k.contains && k.contains(el)) continue;
    if (isOptionish(k)) continue;
    if (countFields(k) > 0) continue;
    add(shortText(k, 24));
  }

  // ③ 前一个兄弟（标签独占一格时最常见）；但区块标题不能算字段标签
  const prev = node.previousElementSibling;
  if (prev && !isOptionish(prev) && !(prev.contains && prev.contains(el)) && countFields(prev) === 0) {
    const t = shortText(prev, 24);
    const looksHeader = /(title|header|head|caption|legend)/i.test(String(prev.className || ''));
    if (!(looksHeader && matchSection(cleanLabel(t)))) add(t);
  }

  return [...new Set(out)];
}

/**
 * 字段行根节点：BEM 组件库都有一层"一个字段一行"的容器
 * 北森 .form-item、antd .ant-form-item、Element .el-form-item …
 * 有了它就不用靠"向上 N 层碰运气"——phoenix-select 内部包了 3 层，
 * 只按层数爬会停在 .phoenix-unmodeled-layer__inner，标签取不到。
 */
const FORM_ITEM_TOKENS = new Set([
  'form-item',
  'formitem',
  'form_item',
  'form-field',
  'formfield',
  'form_field',
  'ant-form-item',
  'el-form-item',
  'ivu-form-item',
  'van-field',
  'moka-form-item',
  'field-item',
  'form-row',
  'input-item',
]);

function formItemAncestor(el) {
  let n = el.parentElement;
  let depth = 0;
  while (n && n !== document.body && depth < 14) {
    const tokens = String(n.className || '')
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.some(t => FORM_ITEM_TOKENS.has(t.toLowerCase()))) {
      const c = countFields(n);
      // 单字段行（含单选组的多个 input）才算字段行；整块容器不算
      if (c >= 1 && c <= 8) return n;
    }
    n = n.parentElement;
    depth++;
  }
  return null;
}

/**
 * 找"字段行"容器：既包含该控件，又能取到标签文本的最小祖先
 * ① 优先 BEM 字段行（标签与控件是兄弟，最可靠）
 * ② 否则向上找第一个能取到标签的容器（兜底 10 层）
 */
function findContainer(el) {
  const item = formItemAncestor(el);
  if (item && labelTextsOf(item, el).length) return item;

  let node = el.parentElement;
  let depth = 0;
  let fallback = el.parentElement;

  while (node && node !== document.body && depth < 10) {
    const n = countFields(node);
    if (n <= 8) {
      fallback = node;
      if (labelTextsOf(node, el).length) return node;
    }
    node = node.parentElement;
    depth++;
  }
  const safe = n => (n && n !== document.body && n !== document.documentElement ? n : null);
  return safe(item) || safe(fallback) || el.parentElement;
}

/** 从一段候选文本里判定区块标题：词典命中优先，其次接受"长得像标题"的短文本 */
function pickSectionFromText(raw) {
  const t = cleanLabel(raw);
  if (!t) return null;
  const r = matchSection(t);
  if (r) return { title: t, ...r };
  if (looksLikeSectionTitle(t)) return { title: t, categoryId: null };
  // "个人信息 请如实填写" 这类带副标题的，取第一段
  const seg = String(t)
    .split(/[\s|｜·•—–\-\/]+/)
    .map(x => cleanLabel(x))
    .find(x => x && [...x].length <= 12 && (matchSection(x) || looksLikeSectionTitle(x)));
  if (seg) {
    // 「教育背景-最高学历专业类别」「求职意向-请选择你的意向城市…」：前缀才是区块名
    const r2 = matchSection(seg);
    return r2 ? { title: seg, ...r2 } : { title: seg, categoryId: null };
  }
  return null;
}

function sectionTitleOf(node) {
  if (!node || node.nodeType !== 1) return null;
  // ① legend / 标题标签
  let heads = [];
  try {
    heads = node.querySelectorAll(':scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5');
  } catch (_) {
    heads = [];
  }
  for (const h of heads) {
    const r = pickSectionFromText(shortText(h, 40));
    if (r) return { ...r, strong: true };
  }
  // ② 形如 title / header / caption 的直接子节点（北森 .bx-card-header 走这条）
  for (const k of node.children) {
    if (countFields(k) > 0) continue;
    const cls = String(k.className || '');
    if (!/(title|header|head|caption|legend)/i.test(cls)) continue;
    const r = pickSectionFromText(shortText(k, 40));
    if (r) return SECTION_HEAD_RE.test(cls) ? { ...r, strong: true } : r;
  }
  // ③ 节点自身的直接文本节点
  const own = ownText(node);
  if (own) {
    const r = pickSectionFromText(own);
    if (r) return r;
  }

  // ④ 深扫：北森 .form-part 这类容器，标题节点既不是 legend/h*，
  //    类名也不一定带 title/header（有的是 <div class="form-part"><div>教育经历</div>…）。
  //    只认"出现在第一个字段之前 + 精确命中区块词典"的短文本，避免把字段值当标题。
  try {
    let firstField = null;
    try {
      firstField = node.querySelector(FIELD_SEL);
    } catch (_) {}
    if (firstField) {
      let checked = 0;
      for (const el of node.querySelectorAll('*')) {
        if (++checked > 800) break;
        if (el.children.length) continue; // 只看叶子，文本才干净
        if (el.matches(FIELD_SEL)) continue;
        if (isOptionish(el)) continue;
        if (el.closest && el.closest('[class*="form-item"]')) continue; // 字段行里的文字不算
        // 标题一定在字段之前
        if (!(el.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        const t = cleanLabel(el.textContent);
        const len = [...t].length;
        if (len < 2 || len > 12) continue;
        const r = matchSection(t);
        if (r) return { title: t, ...r };
      }
    }
  } catch (_) {}

  return null;
}

/**
 * 区块 = 至少含 2 个字段、并且能取到区块标题的祖先。
 * 例外：标题是 legend / h* 或类名明说是"区块标题"（section-title / card-header / module-title…）
 * 时，1 个字段也成区块。网申里大量"一个区块只问一个问题"（申请信息 · 是否服从调剂、
 * 实践活动经验 · 是否有经历），按 ≥2 的规则它们全被并进上一个无标题大块，分类全丢。
 */
const SECTION_HEAD_RE = /(section|card|module|part|group|block|panel|area|step)[-_]?(title|header|head|caption)|(title|header|head)[-_]?(section|card|module|wrapper|wrap|bar)/i;

function sectionOf(container) {
  let node = container.parentElement;
  let depth = 0;
  while (node && node !== document.body && depth < 16) {
    const n = countFields(node);
    if (n >= 1) {
      const t = sectionTitleOf(node);
      if (t && (n >= 2 || t.strong)) return { title: t.title, categoryId: t.categoryId, container: node };
    }
    node = node.parentElement;
    depth++;
  }
  return { title: '', categoryId: null, container: null };
}

export function detectControlKind(el) {
  const tag = el.tagName;
  if (tag === 'SELECT') return 'SELECT_NATIVE';
  if (tag === 'TEXTAREA') return 'TEXTAREA';
  if (el.isContentEditable) return 'RICH_TEXT';
  if (tag === 'INPUT') {
    const t = (el.type || 'text').toLowerCase();
    if (t === 'file') return 'UPLOAD';
    if (t === 'date') return 'DATE_NATIVE_DAY';
    if (t === 'month') return 'DATE_NATIVE_MONTH';
    if (t === 'radio') return 'RADIO_GROUP';
    if (t === 'checkbox') return 'CHECKBOX_GROUP';
    if (t === 'number') return 'NUMBER';
    if (el.readOnly || el.getAttribute('aria-haspopup') || el.getAttribute('role') === 'combobox') return 'PICKER';
    return 'TEXT';
  }
  if (el.getAttribute('role') === 'combobox') return 'SELECT_CUSTOM';
  return 'TEXT';
}

/** 只读输入框 + 日期线索 = 日期选择器；其余只读输入框按下拉处理 */
function refinePickerKind(field) {
  if (field.controlKind !== 'PICKER') return field.controlKind;
  const box = field.container || field.el.parentElement;
  const hints = [
    field.labelParts.join(' '),
    field.el.getAttribute('placeholder') || '',
    String((box && box.className) || ''),
    String((box && box.innerHTML) || '').slice(0, 1500),
  ].join(' ');
  if (/(日历|calendar|date-picker|datepicker|日期选择|时间选择)/i.test(hints)) return 'DATE_CUSTOM';
  if (/(日期|时间|年月|出生|生日|date|time)/i.test(hints)) return 'DATE_CUSTOM';
  return 'SELECT_CUSTOM';
}

/**
 * 按组件类名判定控件类型。
 * 自绘组件（北森 phoenix-*、antd、Element）的输入框在 DOM 里就是一个普通 input，
 * 只有祖先类名能说明它其实是下拉/日期/级联。
 */
const KIND_HINTS = [
  { re: /cascader|area-select|region-select|city-select/i, kind: 'CASCADER' },
  { re: /date-?picker|datepicker|datetime|time-?picker|calendar|date-?select/i, kind: 'DATE_CUSTOM' },
  { re: /(^|[\s_-])select([\s_-]|$)|select__|select--/i, kind: 'SELECT_CUSTOM' },
];

function classChainOf(el, max = 5) {
  const out = [];
  let n = el;
  let d = 0;
  while (n && n.nodeType === 1 && d < max) {
    out.push(String(n.className || ''));
    n = n.parentElement;
    d++;
  }
  return out.join(' ').replace(/\s+/g, ' ');
}

function refineKindByComponent(field) {
  const k = field.controlKind;
  if (!['TEXT', 'PICKER', 'SELECT_CUSTOM', 'DATE_CUSTOM'].includes(k)) return k;
  const chain = classChainOf(field.el, 5);
  for (const h of KIND_HINTS) if (h.re.test(chain)) return h.kind;
  return k;
}

function pickLabel(parts) {
  const cjk = parts.find(p => /[\u4e00-\u9fa5]/.test(p) && [...p].length <= 12);
  return cjk || parts[0] || '';
}

// 元素编号（WeakMap，不污染 DOM 属性），用于给"没有 name 的单选组"生成稳定 key
const elIds = new WeakMap();
let elSeq = 0;
function idOf(el) {
  if (!el) return '0';
  if (!elIds.has(el)) elIds.set(el, ++elSeq);
  return String(elIds.get(el));
}

/**
 * 选项组容器：从选项往上找"最小、能包住全部选项、并且能取到标签"的那一层
 * —— 只按"包住全部"会停在没有标签的 .bx-radio-group 上；只按标签会停在单个选项上
 */
function groupContainer(items) {
  if (!items || !items.length) return null;
  const first = items[0];
  let c = first.parentElement;
  let depth = 0;
  while (c && c !== document.body && depth < 8) {
    const containsAll = items.every(e => e === first || c.contains(e));
    if (containsAll && labelTextsOf(c, first).length) return c;
    c = c.parentElement;
    depth++;
  }
  return null;
}

/**
 * 同组选项的 key：
 * ① 有 name 就按 name（最可靠）
 * ② 没有 name 时，向上找"只含同类选项、不含其他控件"的最小祖先（北森常不给 radio 写 name）
 */
function choiceKeyOf(el, container, type) {
  const name = el.getAttribute('name') || '';
  if (name) return 'n:' + name;
  let n = el.parentElement;
  let depth = 0;
  while (n && n !== document.body && depth < 6) {
    let same = 0;
    let others = 0;
    try {
      for (const x of n.querySelectorAll('input,textarea,select,[role="combobox"],[contenteditable="true"]')) {
        if (x.tagName === 'INPUT' && String(x.type || '').toLowerCase() === type) same++;
        else others++;
      }
    } catch (_) {}
    if (same >= 2 && others === 0) return 'a:' + idOf(n);
    n = n.parentElement;
    depth++;
  }
  return 'c:' + idOf(container || el.parentElement);
}

/**
 * 原生单选/复选：同一个 name 的多个 input 是"一个字段的多个选项"
 * 不合并的话，性别会被切成两个字段，各自只看到自己那一个选项 → option-no-match
 */
function mergeChoiceGroups(items) {
  const out = [];
  const groups = new Map();
  for (const it of items) {
    const el = it.el;
    const t = el.tagName === 'INPUT' ? String(el.type || '').toLowerCase() : '';
    if (t !== 'radio' && t !== 'checkbox') {
      out.push(it);
      continue;
    }
    const key = `${t}:${choiceKeyOf(el, it.container, t)}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        el,
        container: it.container,
        forceKind: t === 'radio' ? 'RADIO_GROUP' : 'CHECKBOX_GROUP',
        choiceInputs: [el],
      };
      groups.set(key, g);
      out.push(g);
    } else {
      g.choiceInputs.push(el);
    }
  }
  // 容器必须同时满足"包住全部选项"和"能取到标签"
  for (const g of groups.values()) {
    if (g.choiceInputs.length < 2) continue;
    const c = groupContainer(g.choiceInputs);
    if (c) g.container = c;
  }
  return out;
}

function collectFields(root) {
  const out = [];
  let all = [];
  try {
    all = [...root.querySelectorAll(FIELD_SEL)];
  } catch (_) {
    all = [];
  }
  for (const el of all) {
    if (el.tagName === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      if (IGNORE_INPUT_TYPES.has(t)) continue;
    }
    if (el.disabled) continue;
    const container = findContainer(el);
    if (!container) continue;
    // 直接挂在 body 下的控件是组件库的隐藏工具节点（真机出现过 container=<body>
    // 的空标签 textarea），不是表单字段，收进来只会变成一条无意义的 label-uncertain
    if (container === document.body || container === document.documentElement) continue;
    if (!isVisible(container) && !isVisible(el)) continue;
    out.push({ el, container });
  }

  const merged = mergeChoiceGroups(out);
  // 自绘单选组（北森 phoenix-radio / bx-radio 这类纯 div）：
  // 不能按"直接父级相同"分组——有的库是 .radio > .radio__circle 两层，
  // 最内层叶子的父级各自不同，会全部漏掉。改为"向上找第一个同时满足
  // ① ≥2 个选项叶子 ② 能取到标签 ③ 不含原生控件 的祖先"。
  try {
    const SEL = '[role="radio"],[class*="radio"],[class*="Radio"]';
    const leaves = [...root.querySelectorAll(SEL)]
      .filter(el => isVisible(el))
      .filter(el => !el.querySelector(SEL));
    const used = new Set();
    for (const leaf of leaves) {
      if (used.has(leaf)) continue;
      let n = leaf.parentElement;
      let depth = 0;
      while (n && n !== document.body && depth < 6) {
        const inside = leaves.filter(x => n.contains(x));
        if (
          inside.length >= 2 &&
          inside.length <= 8 &&
          !n.querySelector('input,textarea,select') &&
          labelTextsOf(n, leaf).length
        ) {
          inside.forEach(x => used.add(x));
          merged.push({ el: inside[0], container: n, forceKind: 'RADIO_GROUP' });
          break;
        }
        n = n.parentElement;
        depth++;
      }
    }
  } catch (_) {}

  return merged;
}

/**
 * 同一个父容器里塞了多段重复字段时，按"标签重复周期"切开。
 *
 * 真机形态：教育经历的两段渲染成
 *   <div class="edu-fields"> [开始时间 结束时间 学校 专业 学历 是否统招] × 2 </div>
 * 12 个字段全挂在**同一个父容器**下 → 按父容器切块只能切出 1 块 →
 * 第 2 段的字段和第一段撞槽 → 被"同块去重"整段跳过 → **新加的那段一条都填不上**。
 *
 * 判据：标签序列由同一个长度为 p 的子序列重复 k 次组成（允许少量噪声，
 * 因为第 2 段偶尔会少一两个字段或措辞不同）。p 至少 3 —— 两列布局的一行字段
 * 不会构成 3 个的重复周期，不会误切。
 */
function splitByRepeatedLabels(fields) {
  const labels = fields.map(f => normalize(f.label || ''));
  const n = labels.length;
  if (n < 6) return null;
  if (labels.some(l => !l)) return null; // 有字段没取到标签，判断不可信
  // 周期从大到小找：n=12 既可能被切成 [3,3,3,3] 也可能是 [6,6]，
  // 真实块大小通常是更大的那个（两段经历 = 6 个字段一段，不能切成 4 段）。
  // p 可以大于 n/2（4+3 这种"新加那段少一个字段"），但要保证每段 ≥3 个字段、
  // 且各段字段数相差不大（否则 "9+3" 这种切法也会算通过，明显不是两段经历）。
  //
  // v2.0.29：**尾余数**处理。自定义 radio 组（是否统招这类"每段一个"的字段）被
  // 探测流程排到字段列表**尾部**，形成 [周期字段×k] + [1~2 个尾巴] 的形状 ——
  // 真机：教育经历 = [开始,结束,学校,专业,学历]×2 + [是否统招]×2，旧逻辑按
  // "每段 ≥3 个字段"把 2 个的尾巴拒掉 → 整块拒切 → 第 2 段全部 duplicate-slot。
  // 现在要求**整周期区域**高分匹配即可，尾巴字段按序轮流分给各段
  // （第 j 个尾巴字段跟第 j%k 段走——它们本来就是按段顺序排的）。
  for (let p = n - 3; p >= 3; p--) {
    const k = Math.floor(n / p);
    const r = n - k * p;
    // 打分：k≥2 且有尾巴时，只给**整周期区域**打分（尾巴是单选组这类被排到
    // 尾部的附加字段，本来就不参与周期）；其余情况照旧全序列打分。
    let num = 0;
    for (let i = 0; i < n; i++) if (labels[i] === labels[i % p]) num++;
    let den = n;
    if (r > 0 && k >= 2) {
      num = 0;
      for (let i = 0; i < k * p; i++) if (labels[i] === labels[i % p]) num++;
      den = k * p;
    }
    if (num / den < 0.8) continue;
    const chunks = [];
    for (let s = 0; s < k * p; s += p) chunks.push(fields.slice(s, s + p));
    if (r > 0) {
      if (k === 1) {
        // p > n/2：两段长度不同（4+3 这种"新加那段少一两个字段"），第 2 段
        // 本身就是一个不完整周期，保持原样，不做尾巴分配
        chunks.push(fields.slice(k * p));
      } else if (r <= chunks.length * 2) {
        // 尾巴按序轮流分给各段（第 j 个尾巴字段跟第 j%k 段走——自定义 radio
        // 组这类字段本来就按段顺序排在列表尾部）
        for (let j = 0; j < r; j++) chunks[j % chunks.length].push(fields[k * p + j]);
      } else {
        continue;
      }
    }
    if (chunks.length < 2) continue;
    const sizes = chunks.map(c => c.length);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    if (min < 3 || min / max < 0.6) continue;
    return chunks;
  }
  return null;
}

function buildBlocks(sectionFields, sectionContainer, categoryId) {
  const byParent = new Map();
  for (const f of sectionFields) {
    const p = f.container.parentElement;
    if (!p) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(f);
  }
  const sig = arr =>
    [...new Set(arr.map(x => normalize(x.label)).filter(Boolean))].sort().join('|');
  const buckets = new Map();
  for (const [parent, arr] of byParent) {
    if (arr.length < 2) continue;
    const s = sig(arr);
    if (!s) continue;
    if (!buckets.has(s)) buckets.set(s, []);
    buckets.get(s).push({ parent, fields: arr });
  }
  let best = null;
  for (const [, members] of buckets) {
    if (members.length >= 2 && (!best || members.length > best.length)) best = members;
  }

  const sortByDom = list =>
    list.slice().sort((a, b) => {
      try {
        return a.parent.compareDocumentPosition(b.parent) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      } catch (_) {
        return 0;
      }
    });

  if (!best) {
    const multi = categoryId ? categoryById(categoryId).multiple : false;

    // ① **扁平列表按标签重复周期切分**（最重要的一条）
    //
    // 网格布局的站点（每一个字段都独占一个 .fields-col 列）：
    //   .form-part-body > .fields-col × 12 > .form-item
    // 每个父容器只有 1 个字段 → 按父容器永远切不出块 → 整段退化成 1 个 block
    // → 两段经历撞槽 → 同块去重把第 2 段整段丢掉（"两条经历只填了第一段"）。
    // 所以先不看父容器，直接拿区块内**按文档顺序**的扁平字段列表做周期切分。
    if (multi) {
      const flat = splitByRepeatedLabels(sectionFields);
      if (flat && flat.length >= 2) {
        return flat.map((fields, i) => ({
          index: i,
          container: (fields[0].container && fields[0].container.parentElement) || sectionContainer,
          fields: fields.slice(),
        }));
      }
    }

    // ② 多段共用一个父容器 → 按该容器的标签重复周期切开
    if (multi) {
      for (const [, arr] of byParent) {
        const parts = splitByRepeatedLabels(arr);
        if (parts && parts.length >= 2) {
          return parts.map((fields, i) => ({
            index: i,
            container: (fields[0].container && fields[0].container.parentElement) || sectionContainer,
            fields: fields.slice(),
          }));
        }
      }
    }

    // ③ 新加的那一段字段**并不完全一样**（少一两个字段、标签措辞变了）→ 按父容器切块。
    //    只在"多记录分类"上做，并且要求每块至少 3 个字段 ——
    //    两列布局的字段行每行只有 1~2 个字段，不会被误当成两段经历。
    const cands = [...byParent.values()].filter(arr => arr.length >= 3);
    if (multi && cands.length >= 2 && cands.length <= 8) {
      const ordered = sortByDom(cands.map(fields => ({ parent: fields[0].container.parentElement, fields })));
      return ordered.map((m, i) => ({ index: i, container: m.parent, fields: m.fields.slice() }));
    }
    return [{ index: 0, container: sectionContainer || document.body, fields: sectionFields }];
  }
  const ordered = sortByDom(best);
  const blocks = ordered.map((m, i) => ({ index: i, container: m.parent, fields: m.fields.slice() }));
  const included = new Set(blocks.flatMap(b => b.fields));
  const orphans = sectionFields.filter(f => !included.has(f));
  if (orphans.length && blocks.length) blocks[0].fields.push(...orphans);
  return blocks;
}

/**
 * 扫描当前页面，产出 FormModel
 * @returns {{ sections: Array, fieldCount: number }}
 */
/**
 * 一个"字段行"里塞了两个控件时的标签配对。
 *
 * 真机常见形态：一行两列 —— 「工作单位 | 职务」、「学历 | 学位」、「开始时间 | 结束时间」。
 * 这类行的容器里有两个控件、两个标签，`labelTextsOf` 对**两个**控件都会返回
 * ["工作单位","职务"] 这两个标签，`pickLabel` 永远取第一个 → 两个控件都被绑到同一个槽，
 * 后一个字段永远填不上（现象就是"前一个填好了，后一个空着，也不报错"）。
 *
 * 修法：容器里的独立标签数与控件数**刚好相等**时，按文档顺序一一配对。
 * 数量对不上（例如日期控件里还有个状态 input）时不动，交给原来的打分逻辑。
 */
function pairLabelsByPosition(groups) {
  const map = new Map();
  const byContainer = new Map();
  for (const g of groups) {
    if (g.inputs && g.inputs.length > 1) continue; // 年月日三下拉已经合并成一个逻辑字段
    if (!byContainer.has(g.container)) byContainer.set(g.container, []);
    byContainer.get(g.container).push(g);
  }
  for (const [container, list] of byContainer) {
    if (list.length < 2 || list.length > 6) continue;
    // 只认真实的 label 节点。不能直接用 labelTextsOf 的结果：
    // 它还会捡"直接子元素的短文本"，而 <select> 的 textContent 是它的**选项**
    // （"请选择硕士学位"），数量一对不上就白配了。
    const labels = labelNodesOf(container);

    const pickText = () =>
      list.filter(g => {
        const el = g.el;
        if (!el || el.tagName !== 'INPUT') return false;
        const t = (el.type || 'text').toLowerCase();
        return t !== 'radio' && t !== 'checkbox' && t !== 'file';
      });

    // 特例：1 个标签 + 多个控件 ——「证件号码：[身份证 ▼] [请输入]」这种复合控件。
    // 标签属于"装值"的那个文本框；前面的类型下拉是"前缀选择器"，不能抢标签，
    // 否则它会把 personal.idNo 抢走（写不进 select），文本框反而被同槽去重跳过 ——
    // 现象就是"证件号码整行填不上"。
    //
    // v2.0.25 真机修正：站点用的是**组件化下拉**（北森 phoenix-select），
    // 它内部自带一个 `<input class="phoenix-select_input">` 当搜索框。
    // 于是"[证件类型 ▼] [请输入]"在 DOM 里是 **2 个 input**，
    // 原来的 `texts.length === 1` 永远不成立 → 特殊规则整体失效 →
    // 下拉的搜索框抢走标签（还被当成 SELECT_CUSTOM），值输入框被同槽跳过。
    // 现在把"下拉组件内部的搜索 input"先剔掉，只剩真正的值输入框。
    if (labels.length === 1 && list.length >= 2) {
      const texts = pickText();
      const plain = texts.filter(g => !isSelectInnerInput(g.el));
      const pool = plain.length ? plain : texts;
      if (pool.length === 1) {
        const winner = pool[0].el;
        list.forEach(g => map.set(g.el, g.el === winner ? labels[0].text : ''));
        continue;
      }
    }

    if (labels.length !== list.length) continue;
    if (new Set(labels.map(x => x.text)).size !== labels.length) continue;
    // 位置也要对得上：第 i 个标签必须在该控件之前，且不能跨过下一个控件
    const okPos = labels.every((lb, i) => {
      try {
        const target = list[i].el;
        return !!(lb.node.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
      } catch (_) {
        return false;
      }
    });
    if (!okPos) continue;
    list.forEach((g, i) => map.set(g.el, labels[i].text));
  }
  return map;
}

/**
 * 这个 input 是不是"组件化下拉内部自带的搜索框"。
 *
 * 真机（北森 phoenix-select）：
 *   <span class="phoenix-select">
 *     <div class="phoenix-select_inputwrap">
 *       <input class="phoenix-select_input">   ← 就是它，不是值输入框
 *
 * 它和"真正的值输入框"在 DOM 里一模一样（都是 input[type=text]），
 * 只能靠祖先/自身类名带 select|cascader|dropdown 来区分。
 * 只看 4 层，避免把外层某个叫 xxx-select-row 的布局容器误判。
 */
const SELECT_INNER_RE = /(^|[\s_-])[a-z0-9-]*select([\s_-]|$)|select__|select--|select_input|cascader|dropdown/i;
function isSelectInnerInput(el) {
  let n = el;
  for (let depth = 0; n && depth < 4; depth++) {
    const c = String((n.className && n.className.baseVal) || n.className || '');
    if (c && SELECT_INNER_RE.test(c)) return true;
    n = n.parentElement;
  }
  return false;
}

/** 容器里"真正的标签节点"（按文档顺序），排除选项节点和含控件的节点 */
function labelNodesOf(container) {
  const out = [];
  try {
    for (const n of container.querySelectorAll(LABEL_SEL)) {
      if (isOptionish(n)) continue;
      if (countFields(n) > 0) continue;
      if (!isVisible(n)) continue;
      const text = cleanLabel(shortText(n, 24));
      if (!looksLikeLabel(text)) continue;
      if (out.some(x => x.node.contains(n) || n.contains(x.node))) continue;
      out.push({ node: n, text });
    }
  } catch (_) {}
  return out;
}

export function buildFormModel(root = document.body) {
  countCache = new Map();
  const raw = collectFields(root);

  // 合并"年/月/日 三个原生 select"为一个逻辑字段（仅当标签像日期，避免把"省/市"两级下拉吞掉）
  const DATE_LABEL_RE = /时间|日期|年月|出生|生日|入职|毕业/;
  const groups = [];
  const consumed = new Set();
  for (const r of raw) {
    if (consumed.has(r)) continue;
    const selects = raw.filter(
      x => x.container === r.container && x.el.tagName === 'SELECT' && !consumed.has(x)
    );
    const looksDate = DATE_LABEL_RE.test(labelTextsOf(r.container, r.el).join(' '));
    if (selects.length >= 2 && selects.length <= 3 && looksDate) {
      selects.forEach(x => consumed.add(x));
      groups.push({ el: r.el, inputs: selects.map(x => x.el), container: r.container, forceKind: r.forceKind });
      continue;
    }
    consumed.add(r);
    groups.push({ el: r.el, inputs: [r.el], container: r.container, forceKind: r.forceKind });
  }

  // 一行两列的字段行：「工作单位 | 职务」这种，必须按位置把标签分给各自的控件，
  // 否则两个控件都认为自己叫"工作单位"
  const ownLabel = pairLabelsByPosition(groups);

  const fields = groups.map(g => {
    // has() 为 true 表示"这个控件的标签已经由位置配对确定"（own 可能是空串：
    // 复合控件里的类型下拉，明确不给标签，避免它抢走"证件号码"这个槽）
    const hasOwn = ownLabel.has(g.el);
    const own = ownLabel.get(g.el);
    const ownParts = hasOwn ? [own].filter(Boolean) : labelTextsOf(g.container, g.el);
    const parts = [
      ...new Set([
        ...ownParts,
        ...[g.el.getAttribute('placeholder'), g.el.getAttribute('aria-label'), g.el.getAttribute('name')]
          .map(s => cleanLabel(s))
          .filter(Boolean),
      ]),
    ];
    const field = {
      el: g.el,
      inputs: g.inputs,
      container: g.container,
      labelParts: parts,
      label: pickLabel(parts),
      controlKind: g.forceKind || detectControlKind(g.el),
      section: null,
      blockIndex: 0,
    };
    if (g.inputs.length > 1 && field.controlKind === 'SELECT_NATIVE') field.controlKind = 'DATE_TRIPLE_SELECT';
    if (!g.forceKind) {
      field.controlKind = refinePickerKind(field);
      // 组件类名优先级最高：phoenix-select 的 input 在 DOM 里就是普通 input，
      // 不看祖先类名会被当成文本框，直接往里写值（网页不认，等于没填）
      field.controlKind = refineKindByComponent(field);
    }
    return field;
  });

  const sectionMap = new Map();
  for (const f of fields) {
    const meta = sectionOf(f.container);
    f.section = meta;
    const key = meta.container || '__none__';
    if (!sectionMap.has(key)) {
      sectionMap.set(key, {
        title: meta.title,
        categoryId: meta.categoryId,
        container: meta.container,
        fields: [],
      });
    }
    sectionMap.get(key).fields.push(f);
  }

  const sections = [];
  for (const s of sectionMap.values()) {
    const blocks = buildBlocks(s.fields, s.container, s.categoryId);
    blocks.forEach(b => b.fields.forEach(f => (f.blockIndex = b.index)));
    sections.push({ title: s.title, categoryId: s.categoryId, container: s.container, blocks });
  }

  return { sections, fieldCount: fields.length };
}
