// 多段经历：网页只渲染一段时，先把第 n 段的位置"点"出来
//
// 顺序很关键：点「添加」→ **重新扫描表单** → 再绑定 → 再填。
// 因为点完 DOM 就被框架重建了，手里那批 field.el 全是旧节点，继续用只会填到空气上。
// 这条链路只处理"资料库里的段数 > 网页上的块数"，且必须找到明确的添加按钮才会动手；
// 找不到就老实只填第一段，绝不去点来路不明的按钮。

import { clickEl, fire, isVisible, sleep } from './util.js';
import { categoryById } from './schema.js';
import { buildFormModel } from './form-model.js';

const MAX_ADD = 20;
const ADD_RE = /(添加|新增|增加|再加|继续添加|\badd\b)/i;
// 同一个区块里常有"添加附件/上传照片"这种按钮，绝不能当成"再加一段经历"
const NOISE_RE = /(附件|照片|上传|文件|证件|简历|图片|证书)/;
const GENERIC_ADD_RE = /^[＋+⊕]?\s*(添加|新增|增加)(一条|一项|一个|记录|经历|条目)?$/;
// 纯图标按钮：没有文字，只能看 title / aria-label / class
const ICON_ADD_RE = /^[＋+⊕]$|^\+$/;
const ICON_NAME_RE = /add|plus|new/i;

const textOf = el => String((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
const attrOf = el =>
  [
    el.getAttribute('title'),
    el.getAttribute('aria-label'),
    el.getAttribute('data-title'),
    el.getAttribute('placeholder'),
  ]
    .filter(Boolean)
    .join(' ');

/** 只算"真填了内容"的记录：用户加了空卡片不算一段经历 */
function usableRecords(profile, category) {
  const records = profile[category.id] || [];
  return records.filter(r => {
    if (!r || typeof r !== 'object') return false;
    return Object.entries(r).some(([k, v]) => k !== '__custom' && v != null && String(v).trim());
  });
}

function candidatesIn(area) {
  const out = [];
  if (!area || !area.querySelectorAll) return out;
  for (const el of area.querySelectorAll('button,[role="button"],a,span,div,i,svg')) {
    if (!isVisible(el)) continue;
    if (el.disabled) continue;
    // 只认"按钮"这种浅节点：容器会把整块文案（含分类名和"添加"）当按钮，
    // 点它等于点了个空 div，日志里就会出现「在校职务 在校职务名称 备注 添加」这种鬼东西
    if (el.children.length > 2) continue;
    if (el.querySelector && el.querySelector('button,[role="button"]')) continue;
    const t = textOf(el);
    const attr = attrOf(el);
    const cls = String((el.className && el.className.baseVal != null ? el.className.baseVal : el.className) || '');

    // ① 文案里带"添加/新增"
    if (t && t.length <= 20 && ADD_RE.test(t) && !NOISE_RE.test(t)) {
      out.push({ el, text: t, kind: 'text' });
      continue;
    }
    // ② 纯图标按钮（只有 ＋／加号，或 add/plus 类名，靠 title / aria-label 说明用途）
    if (ICON_ADD_RE.test(t) || (ICON_NAME_RE.test(cls) && (ADD_RE.test(attr) || !t))) {
      if (t.length <= 20 && !NOISE_RE.test(t + attr)) {
        out.push({ el, text: (t || attr || '＋').slice(0, 20), kind: 'icon' });
      }
    }
  }
  return out;
}

/**
 * 找"再加一段"的按钮。**所有多记录分类通用**（教育 / 实习 / 在校职务 / 在校实践 /
 * 获奖 / 论文 / 语言能力 / 家庭情况 / 求职意向），不是只给教育经历用的。
 *
 * ① 局部（区块容器 + 它的父级）：文案带分类名 —— "添加教育经历" / "添加实习经历" /
 *    "新增家庭成员"，最可信
 * ② 局部：裸"添加 / ＋"，必须位于最后一块**之后**、且不在任何块内部
 * ③ 全文档兜底：只认文案带分类名的（条件很强，不会点到别的分类去）
 * 全都找不到就返回 null —— 宁可只填一段，也不乱点。
 */
export function findAddButton(section, category) {
  const names = [category.name, ...(category.sectionKeys || [])].filter(Boolean);
  // 文本最短的那个最像按钮（容器文本长，且已被上面的浅节点规则过滤）
  const named = list =>
    list
      .filter(x => names.some(n => x.text.includes(n)))
      .sort((a, b) => a.text.length - b.text.length)[0];
  const areas = [section.container, section.container && section.container.parentElement].filter(Boolean);

  // ① 局部：文案带分类名
  for (const area of areas) {
    const hit = named(candidatesIn(area));
    if (hit) return hit;
  }

  // ② 局部：裸"添加 / ＋"，必须在最后一块之后
  const blocks = section.blocks || [];
  const lastBlock = blocks.length ? blocks[blocks.length - 1] : null;
  // 单块区块的 container 就是 section 容器本身（buildBlocks 的兜底），
  // 拿它当"最后一块"会让"按钮必须在块之后、且不在块内"永远不成立 ——
  // 这时退到"最后一块里最后一个字段行"当锚点
  let last = lastBlock && lastBlock.container && lastBlock.container !== section.container ? lastBlock.container : null;
  if (!last && lastBlock && lastBlock.fields && lastBlock.fields.length) {
    last = lastBlock.fields[lastBlock.fields.length - 1].container || null;
  }
  for (const area of areas) {
    const generic = candidatesIn(area).find(x => {
      if (!GENERIC_ADD_RE.test(x.text) && x.kind !== 'icon') return false;
      if (last && last.contains && last.contains(x.el)) return false;
      // DOCUMENT_POSITION_FOLLOWING = 4：添加按钮在列表末尾/下方
      if (last && !(last.compareDocumentPosition(x.el) & 4)) return false;
      return true;
    });
    if (generic) return generic;
  }

  // ③ 全文档兜底：只认带分类名的，避免点到别的分类的添加按钮
  try {
    const hit = named(candidatesIn(document.body));
    if (hit) return hit;
  } catch (_) {}

  return null;
}

/** 点"添加"如果弹出的是对话框（而不是就地加一块），收干净，别把页面留在弹窗里 */
async function dismissDialogIfAny() {
  const dialogs = [...document.querySelectorAll('[role="dialog"],[class*="modal"],[class*="Modal"],[class*="dialog"]')].filter(
    isVisible
  );
  if (!dialogs.length) return false;
  for (const d of dialogs) {
    const close = [...d.querySelectorAll('button,[role="button"],[class*="close"]')].find(
      b => isVisible(b) && /^(取消|关闭|cancel|close|×|✕)$/i.test(textOf(b).slice(0, 4))
    );
    if (close) {
      clickEl(close);
      await sleep(150);
      return true;
    }
  }
  try {
    fire(document.body, 'keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
  } catch (_) {}
  await sleep(150);
  return true;
}

function pickTarget(model, profile, skip) {
  for (const section of model.sections || []) {
    const category = section.categoryId ? categoryById(section.categoryId) : null;
    if (!category || !category.multiple || category.custom) continue;
    if (skip && skip.has(category.id)) continue;
    const records = usableRecords(profile, category);
    const have = (section.blocks || []).length;
    if (records.length <= have) continue;
    const btn = findAddButton(section, category);
    if (!btn) continue;
    return { section, category, btn, need: records.length - have, have };
  }
  return null;
}

/** 重新扫描后找回同一个区块：同分类里块数最多的那个（多出来的就是刚加的） */
function relookup(next, section, category) {
  const list = (next.sections || []).filter(
    s => s.categoryId === category.id || (section.title && s.title === section.title)
  );
  let best = null;
  for (const s of list) if (!best || (s.blocks || []).length > (best.blocks || []).length) best = s;
  return best;
}

/** 区块里的字段总数：用来判断"点了一下到底有没有多出东西" */
function fieldCountOf(section) {
  return ((section && section.blocks) || []).reduce((n, b) => n + ((b.fields && b.fields.length) || 0), 0);
}

/**
 * 把网页上的重复块补到"资料库段数"那么多。
 * @returns {{model:object, added:number, log:string[]}}
 */
export async function expandSections(profile, model, options = {}) {
  const limit = Math.max(0, Math.min(options.maxAdd == null ? MAX_ADD : options.maxAdd, MAX_ADD));
  const log = [];
  let cur = model;
  let added = 0;
  // 每个分类点过几次。块数一直不涨（站点把新记录塞进同一块）时，
  // `need` 不会变小，没有这个计数就会一直点下去，凭空多点出一段来。
  const clicked = new Map();
  // 某个分类点不动（按钮无效 / 结构不支持）时只跳过**这一个分类**，
  // 不能直接 break —— 否则"教育经历加不上"会连带把实习经历、在校职务全部掐掉
  const stuck = new Set();

  for (let round = 0; round < limit; round++) {
    const target = pickTarget(cur, profile, stuck);
    if (!target) break;
    const { section, category, btn, need, have } = target;
    const done = clicked.get(category.id) || 0;
    if (done >= need) {
      stuck.add(category.id);
      continue;
    }
    const fieldsBefore = fieldCountOf(section);

    clickEl(btn.el);
    await sleep(480); // 等框架把新区块渲染出来
    clicked.set(category.id, done + 1);

    let next = null;
    try {
      next = buildFormModel();
    } catch (_) {
      next = null;
    }
    const after = next ? relookup(next, section, category) : null;
    const blocksAfter = after ? (after.blocks || []).length : 0;
    const fieldsAfter = fieldCountOf(after);

    // 判定"确实多出了东西"，两个信号任一成立即可：
    //  ① 块数变多（正常情况）
    //  ② 块数没变但字段变多 —— 站点把新的那段塞进了同一个块容器里（或块识别没跟上），
    //     这时**不能**当成失败退出，否则新块就在页面上却一条都填不上（用户反馈的正是这个）
    const grew = blocksAfter > have || fieldsAfter > fieldsBefore;
    if (!after || !grew) {
      const cleaned = await dismissDialogIfAny();
      log.push(`${category.name}：「${btn.text}」点了没多出区块${cleaned ? '（已关掉弹出的对话框）' : ''}`);
      // 只跳过这个分类，其它分类（实习/在校职务/获奖…）继续
      stuck.add(category.id);
      continue;
    }
    log.push(
      blocksAfter > have
        ? `${category.name}：${have} → ${blocksAfter} 块（还差 ${need} 段）`
        : `${category.name}：块数没变，但字段 ${fieldsBefore} → ${fieldsAfter} 个（站点把新记录塞进了同一块）`
    );
    cur = next;
    added++;
  }
  return { model: cur, added, log };
}
