// 卡片式录入（v2.0.33）：很多网申的多段经历不是"一直摊开的表单"，而是一张张卡片——
//   点「添加」→ 出现一张编辑卡（字段 + 「确认 / 取消」）→ 点确认才真正保存 →
//   卡片变成只读展示（「英语等级：托福  分数：111」+ 编辑/删除图标）。
// 真机：图谱 tupu360（辉瑞校招等），同类形态在大量自研网申里都有。
//
// 这里解决两件事：
//   ① 已保存的只读卡片也算"这段已经在页面上了"——否则资料库 1 条、页面 0 个编辑块，
//      插件会再点一次「添加」把同一段重复录一遍；
//   ② 编辑卡填完要点卡片里的「确认」，否则页面看着填了，站点那边根本没保存。
//
// 安全边界：只点"卡片内部、且同时有「取消」"的那个确认/保存按钮（卡片内的保存≠整页提交），
// 文案带 提交/投递/申请/报名 的一律不点。

import { CATEGORIES, ENUMS } from './schema.js';
import { normalize, isVisible, clickEl, sleep, waitFor } from './util.js';

const FIELD_SEL = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';
const BTN_SEL = 'button,[role="button"],a,[class*="btn"],[class*="Btn"],[class*="button"]';
const COMMIT_RE = /^(确认|确定|保存|完成|保存并关闭|确认保存|ok|save|confirm|done)$/i;
const CANCEL_RE = /^(取消|放弃|cancel)$/i;
const NEVER_RE = /(提交|投递|申请|报名|submit|apply)/i;
const ERROR_SEL =
  '.ant-form-explain,.ant-form-item-explain,.el-form-item__error,.ivu-form-item-error-tip,[class*="error-tip"],[class*="errorTip"],[class*="error-msg"],[class*="errorMsg"],[class*="form-error"]';

const btnText = el => String((el && el.textContent) || '').replace(/\s+/g, '').trim();

function editableFieldsIn(root) {
  if (!root || !root.querySelectorAll) return [];
  return [...root.querySelectorAll(FIELD_SEL)].filter(el => {
    if (el.disabled) return false;
    if (el.tagName === 'INPUT' && /^(hidden|submit|button|reset|image)$/i.test(el.type || '')) return false;
    return true;
  });
}

// ---------- ① 已保存的只读记录 ----------

/** 文本节点是否落在某个控件内部（下拉的已选值、日期框旁的文字都不算"只读展示"） */
function insideControl(node, stop) {
  let n = node.parentElement;
  for (let d = 0; n && n !== stop && d < 5; d++, n = n.parentElement) {
    if (n.matches && n.matches(FIELD_SEL)) return true;
    if (n.querySelector && n.querySelector(FIELD_SEL)) return true;
  }
  return false;
}

/** 区域里"只读展示"的文本：编辑卡里的标签和下拉已选值都排除掉 */
function readonlyTextOf(area) {
  if (!area) return '';
  const doc = area.ownerDocument || document;
  const walker = doc.createTreeWalker(area, 4 /* SHOW_TEXT */);
  let out = '';
  let n;
  let guard = 0;
  while ((n = walker.nextNode()) && guard++ < 5000) {
    const t = String(n.textContent || '').trim();
    if (!t) continue;
    if (insideControl(n, area)) continue;
    out += ' ' + t;
  }
  return out;
}

/** 某个分类在页面上的"区域"：从带分类名的添加按钮往上找到含该分类标题的那层 */
function areasOf(category, model) {
  const names = [category.name, ...(category.sectionKeys || [])].filter(Boolean);
  const out = new Set();
  for (const s of (model && model.sections) || []) {
    if (s.categoryId === category.id && s.container) out.add(s.container);
  }
  let btns = [];
  try {
    btns = [...document.querySelectorAll(BTN_SEL)].filter(b => {
      const t = btnText(b);
      return t.length <= 20 && /(添加|新增|增加)/.test(t) && names.some(n => t.includes(n));
    });
  } catch (_) {}
  for (const b of btns) {
    let n = b.parentElement;
    for (let d = 0; n && n !== document.body && d < 6; d++, n = n.parentElement) {
      const heads = n.querySelectorAll('[class*="title"],[class*="Title"],[class*="header"],h1,h2,h3,h4,h5,legend');
      const hit = [...heads].some(h => {
        if (h.contains(b)) return false;
        const t = normalize(h.textContent).slice(0, 20);
        return names.some(k => t.includes(normalize(k)));
      });
      if (hit) {
        out.add(n);
        break;
      }
    }
  }
  return [...out];
}

/** 一个值在只读文本里的所有可能写法（枚举值连同义词一起认：资料写 TOEFL，页面显示 托福） */
function variantsOf(field, raw) {
  const v = String(raw ?? '').trim();
  if (!v) return [];
  const out = new Set([normalize(v)]);
  if (field && field.enumRef && ENUMS[field.enumRef]) {
    const nv = normalize(v);
    for (const syns of Object.values(ENUMS[field.enumRef])) {
      if (syns.some(s => normalize(s) === nv)) syns.forEach(s => out.add(normalize(s)));
    }
  }
  return [...out].filter(x => [...x].length >= 2 || /^\d+$/.test(x));
}

/** 这条记录是否已经以只读卡片的形式保存在页面上 */
function recordShownIn(text, record, category, strongSlots) {
  const fields = category.fields.filter(f => f.kind !== 'upload' && f.kind !== 'date');
  const filled = fields.filter(f => String(record[f.label] ?? '').trim());
  if (!filled.length) return false;
  const hit = f => variantsOf(f, record[f.label]).some(v => text.includes(v));
  const strong = filled.filter(f => strongSlots.includes(f.slot));
  if (strong.length) return strong.every(hit);
  // 没有强键：大多数短值都出现才算（语言能力：托福 + 111）
  const short = filled.filter(f => String(record[f.label]).length <= 30);
  if (!short.length) return false;
  const n = short.filter(hit).length;
  return short.length === 1 ? n === 1 : n >= Math.ceil(short.length * 0.6) && n >= 2;
}

/**
 * 找出资料库里"已经保存在页面上"的记录，返回去掉这些记录后的资料 + 说明日志。
 * 只看多记录分类；单记录（个人信息）没有"保存成卡片"这回事。
 */
export function withoutSavedRecords(profile, model, strongKeys = {}) {
  const log = [];
  const saved = [];
  const next = { ...profile };
  for (const category of CATEGORIES) {
    if (!category.multiple || category.custom) continue;
    const records = profile[category.id];
    if (!Array.isArray(records) || !records.length) continue;
    let text = '';
    try {
      text = normalize(areasOf(category, model).map(readonlyTextOf).join(' '));
    } catch (_) {
      text = '';
    }
    if (!text) continue;
    const keep = [];
    records.forEach((r, i) => {
      if (r && typeof r === 'object' && recordShownIn(text, r, category, strongKeys[category.id] || [])) {
        saved.push({ categoryId: category.id, recordIndex: i });
        log.push(`${category.name} 第 ${i + 1} 段已保存在页面上，不再重复添加`);
      } else {
        keep.push(r);
      }
    });
    if (keep.length !== records.length) next[category.id] = keep;
  }
  return { profile: next, saved, log };
}

// ---------- ② 编辑卡的「确认」 ----------

/** 块的真实卡片根：块内全部字段的最近公共祖先，且不能包住别的块的字段 */
export function cardRootOf(block, section) {
  const els = ((block && block.fields) || []).map(f => f.el).filter(Boolean);
  if (!els.length) return null;
  let root = els[0].parentElement;
  while (root && !els.every(e => root.contains(e))) root = root.parentElement;
  if (!root || root === document.body) return null;
  const others = ((section && section.blocks) || [])
    .filter(b => b !== block)
    .flatMap(b => (b.fields || []).map(f => f.el));
  // 卡片里的按钮常在字段的下一层兄弟里：往上最多再走 2 层，只要不吞掉别的块
  let best = others.some(e => root.contains(e)) ? null : root;
  let n = best;
  for (let d = 0; n && d < 2; d++) {
    if (findCommitIn(n)) return n;
    const up = n.parentElement;
    if (!up || up === document.body || others.some(e => up.contains(e))) break;
    n = up;
  }
  return best;
}

function findCommitIn(root) {
  if (!root || !root.querySelectorAll) return null;
  let btns = [];
  try {
    btns = [...root.querySelectorAll(BTN_SEL)].filter(b => isVisible(b) && !b.disabled);
  } catch (_) {
    return null;
  }
  // 按钮自己不能是字段容器（下拉里的"确定"不算）
  btns = btns.filter(b => !b.querySelector(FIELD_SEL));
  const commit = btns.find(b => {
    const t = btnText(b);
    return t && COMMIT_RE.test(t) && !NEVER_RE.test(t);
  });
  if (!commit) return null;
  const hasCancel = btns.some(b => CANCEL_RE.test(btnText(b)));
  return hasCancel ? commit : null;
}

/** 校验提示 → 它属于哪个字段（往上找到含 label 的那层，取标签文字） */
function labelOfError(errEl, root) {
  let n = errEl.parentElement;
  for (let d = 0; n && n !== root && d < 7; d++, n = n.parentElement) {
    const lab = n.querySelector && n.querySelector('label,[class*="label"],[class*="Label"]');
    if (lab && !lab.contains(errEl)) {
      const t = String(lab.textContent || '').replace(/[*＊:：\s]/g, '').trim();
      if (t && t.length <= 30) return t;
    }
  }
  return '';
}

function errorsIn(root) {
  if (!root || !root.querySelectorAll) return [];
  const out = [];
  for (const e of root.querySelectorAll(ERROR_SEL)) {
    if (!isVisible(e)) continue;
    const msg = String(e.textContent || '').replace(/\s+/g, ' ').trim();
    if (!msg) continue;
    const lab = labelOfError(e, root);
    // 站点提示常是千篇一律的「必填字段不能为空」：有字段名就只报字段名
    out.push(lab ? (/(必填|不能为空|请填写|请选择|请输入)/.test(msg) ? lab : `${lab}：${msg}`) : msg);
  }
  return [...new Set(out)].slice(0, 8);
}

/** 卡片是否已经"收起成只读"：根被移除、或里面不再有可编辑控件、或确认按钮消失 */
function committed(root, btn) {
  if (!root.isConnected) return true;
  if (!editableFieldsIn(root).some(isVisible)) return true;
  if (!btn.isConnected || !isVisible(btn)) return true;
  return false;
}

/**
 * 依次点各编辑卡的「确认」。只处理这次真的写进了值的块。
 * @param {Array<{section, block, label:string}>} targets
 * @returns {Promise<Array>} 报告行
 */
export async function commitCards(targets) {
  const rows = [];
  for (const t of targets) {
    const root = cardRootOf(t.block, t.section);
    const btn = root && findCommitIn(root);
    if (!btn) continue;
    clickEl(btn);
    let ok = false;
    try {
      ok = await waitFor(() => committed(root, btn), 1200, 80);
    } catch (_) {
      ok = committed(root, btn);
    }
    await sleep(120);
    const base = {
      section: t.section.title || '',
      categoryId: t.section.categoryId || '',
      block: t.block.index,
      label: `「${btnText(btn)}」本段`,
      slot: '',
      value: '',
      kind: 'card',
      controlKind: 'CARD_COMMIT',
    };
    if (ok) {
      rows.push({ ...base, status: 'filled', via: 'card-commit', note: 'card-committed' });
    } else {
      const errs = errorsIn(root);
      rows.push({
        ...base,
        status: 'failed',
        reason: 'card-commit-blocked',
        missing: errs,
        note: errs.length ? '网站要求必填、你的资料里没有：' + errs.join('、') : '点了确认但卡片没收起（可能有必填项没填）',
      });
    }
  }
  return rows;
}
