// L2 绑定器：区块→分类、块↔记录（强键对齐）、标签→语义槽
// 三层消歧是解决"开始时间 / 姓名"这类同名异义的核心

import { normalize, charDice, conflicts, lengthPenalty } from './util.js';
import { ALL_FIELDS, CATEGORIES, STRONG_KEYS, categoryById } from './schema.js';
import { resolveValue } from './resolver.js';

const SLOT_MIN_SCORE = 0.78;
const SLOT_MIN_MARGIN = 0.06;

function scorePartAgainstField(part, field) {
  const p = normalize(part);
  if (!p) return 0;
  // 反别名：这个标签明确不属于本字段（"学历" ≠ "最高学历"）
  if (field.deny && field.deny.some(d => normalize(d) === p)) return 0;
  if (field.denyRe && field.denyRe.test(p)) return 0;
  let best = 0;
  for (const alias of field.alias) {
    const an = normalize(alias);
    if (!an) continue;
    if (conflicts(p, an)) continue;
    const pLen = [...p].length;
    const aLen = [...an].length;
    let s = 0;
    if (p === an) {
      s = 1;
    } else if (p.includes(an) || an.includes(p)) {
      const min = Math.min(pLen, aLen);
      if (min >= 2) s = 0.9 + 0.08 * (min / Math.max(pLen, aLen));
    } else {
      const d = charDice(p, an);
      if (d >= 0.72) s = d * 0.85;
    }
    if (s) s *= lengthPenalty(part);
    if (s > best) best = s;
  }
  return best;
}

export function matchSlot(parts, candidates) {
  const clean = [...new Set((parts || []).map(p => String(p || '').trim()).filter(Boolean))];
  if (!clean.length || !candidates || !candidates.length) return null;

  // ① 归一后完全等于某个别名 → 决定性证据
  //    按"标签采集顺序"取最早命中的那个（字段自身的标签通常在最前），
  //    避免容器里混进的邻居标签把匹配抢走
  const exactHits = [];
  for (let i = 0; i < clean.length; i++) {
    const p = normalize(clean[i]);
    if (!p) continue;
    for (const c of candidates) {
      const denied =
        (c.field.deny && c.field.deny.some(d => normalize(d) === p)) || (c.field.denyRe && c.field.denyRe.test(p));
      if (!denied && c.field.alias.some(a => normalize(a) === p)) exactHits.push({ c, i });
    }
  }
  if (exactHits.length) {
    const firstIdx = exactHits[0].i;
    const same = exactHits.filter(h => h.i === firstIdx);
    const slots = [...new Set(same.map(h => h.c.field.slot))];
    if (slots.length === 1) return { ...same[0].c, score: 1 };
    return null; // 同一个标签精确命中多个字段 → 真歧义
  }

  // ② 包含 / 字符相似
  const scored = [];
  for (const c of candidates) {
    let score = 0;
    for (const part of clean) {
      const s = scorePartAgainstField(part, c.field);
      if (s > score) score = s;
    }
    if (score > 0) scored.push({ ...c, score });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  if (top.score < SLOT_MIN_SCORE) return null;
  if (
    second &&
    top.score - second.score < SLOT_MIN_MARGIN - 1e-6 &&
    second.field.slot !== top.field.slot
  ) {
    return null;
  }
  return top;
}

/** FormModel 的区块结构是 blocks[].fields[]，这里统一取平面字段列表（旧的 section.fields 写法已不存在） */
function fieldsOf(section) {
  if (!section) return [];
  if (Array.isArray(section.fields)) return section.fields;
  if (!Array.isArray(section.blocks)) return [];
  return section.blocks.flatMap(b => (b && Array.isArray(b.fields) ? b.fields : []));
}

function inferCategory(section) {
  const tally = new Map();
  for (const f of fieldsOf(section)) {
    if (!f || !Array.isArray(f.labelParts)) continue;
    for (const c of ALL_FIELDS) {
      const s = Math.max(...f.labelParts.map(p => scorePartAgainstField(p, c.field)), 0);
      if (s >= 0.85) tally.set(c.category.id, (tally.get(c.category.id) || 0) + 1);
    }
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  // 同一区块里两个分类得分并列，说明无法判断，宁可不动
  if (ranked[1] && ranked[1][1] >= ranked[0][1]) return null;
  return ranked[0][0];
}

// ---------- 自定义字段 ----------
// 两处来源：
//   A. 每条记录上的 __custom: [{ name, value }]（分类级，v2.0.18 起）
//   B. 老的「自定义字段」分类的记录（字段名称 / 字段内容）
// 两者都**全局参与匹配**，不按区块分类收窄。原因很实在：网页上的字段经常不在
// 你以为的那个区块里（"微信号"被塞进"其他信息"、整块没被识别出分类…），
// 只在同分类里找，用户看到的就是"加了字段，填充毫无反应"。
// 三条规则：
//   ① 与任何内置字段的标签/别名撞名的 → 丢掉（留着会让同一标签精确命中两个槽 →
//      判成歧义 → 连内置字段都填不上）
//   ② 同名的多条 → 只留第一条
//   ③ 空名字的跳过

function customEntries(record) {
  return record && Array.isArray(record.__custom) ? record.__custom : [];
}

/**
 * 资料库里全部自定义字段（去重后）。fill.js 也用它做"定义了却没匹配上"的诊断。
 * @returns {Array<{categoryId:string,name:string,key:string,value:string,slot:string}>}
 */
export function customFieldsOf(profile) {
  const out = [];
  const seen = new Set();
  const push = (categoryId, name, value, slot) => {
    const key = normalize(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ categoryId, name, key, value: value == null ? '' : String(value), slot });
  };
  for (const c of CATEGORIES) {
    for (const rec of profile[c.id] || []) {
      for (const item of customEntries(rec)) {
        push(c.id, String((item && item.name) || '').trim(), item && item.value, '');
      }
    }
  }
  for (const rec of profile.custom || []) {
    push('custom', String((rec && rec['字段名称']) || '').trim(), rec && rec['字段内容'], '');
  }
  // 槽名在知道来源分类之后才能定（分类级 / 全局）
  return out.map(f => ({
    ...f,
    slot: f.categoryId === 'custom' ? `custom:global:${f.key}` : `custom:${f.categoryId}:${f.key}`,
  }));
}

/** 把自定义字段包装成"虚拟字段"塞进候选池，走完全相同的 标签 → 语义槽 匹配逻辑 */
function customCandidates(profile, builtinNames) {
  const out = [];
  for (const f of customFieldsOf(profile)) {
    if (builtinNames.has(f.key)) continue; // ① 与内置撞名
    out.push({
      field: { label: f.name, slot: f.slot, kind: 'text', alias: [f.name] },
      category: categoryById(f.categoryId) || { id: f.categoryId },
      custom: true,
      customName: f.name,
      customValue: f.value,
    });
  }
  return out;
}

/** 读取控件当前显示值（用于强键比对） */
function readCurrent(field) {
  try {
    if (field.controlKind === 'RADIO_GROUP') {
      const on = field.container.querySelector('input[type=radio]:checked');
      if (on) {
        const lab = on.closest('label') || on.parentElement;
        return String((lab && lab.innerText) || on.value || '').trim();
      }
      return '';
    }
    const el = field.el;
    if (el.value != null && String(el.value).trim()) return String(el.value).trim();
    return String(el.innerText || el.textContent || '').trim();
  } catch (_) {
    return '';
  }
}

/**
 * 块 ↔ 记录对齐：先用强键（学校/公司/奖项名）配对，配不上的按顺序补
 * @returns Map<blockIndex, recordIndex>
 */
function alignBlocks(blocks, records, category, candidates) {
  const assign = new Map();
  if (!records.length) return assign;
  if (blocks.length <= 1 || records.length <= 1) {
    blocks.forEach(b => {
      if (b.index < records.length) assign.set(b.index, b.index);
    });
    return assign;
  }

  const strongSlots = STRONG_KEYS[category.id] || [];
  // 每个块的 槽 → 当前值
  const blockValues = blocks.map(b => {
    const map = new Map();
    for (const f of b.fields) {
      const m = matchSlot(f.labelParts, candidates);
      if (!m) continue;
      if (map.has(m.field.slot)) continue;
      map.set(m.field.slot, readCurrent(f));
    }
    return map;
  });

  const pairs = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    for (let ri = 0; ri < records.length; ri++) {
      const record = records[ri] || {};
      let total = 0;
      let count = 0;
      for (const slot of strongSlots) {
        const meta = candidates.find(c => c.field.slot === slot);
        if (!meta) continue;
        const pv = normalize(blockValues[bi].get(slot) || '');
        const rv = normalize(record[meta.field.label] || '');
        if (!pv || !rv) continue;
        let s;
        if (pv === rv) s = 1;
        else if (pv.includes(rv) || rv.includes(pv)) s = 0.85;
        else s = charDice(pv, rv);
        total += s;
        count++;
      }
      pairs.push({ bi, ri, score: count ? total / count : 0 });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedB = new Set();
  const usedR = new Set();
  for (const p of pairs) {
    if (p.score < 0.5) continue;
    if (usedB.has(p.bi) || usedR.has(p.ri)) continue;
    assign.set(p.bi, p.ri);
    usedB.add(p.bi);
    usedR.add(p.ri);
  }
  // 剩余块按顺序补未被占用的记录
  for (const b of blocks) {
    if (assign.has(b.index)) continue;
    const ri = records.findIndex((_, i) => !usedR.has(i));
    if (ri < 0) break;
    assign.set(b.index, ri);
    usedR.add(ri);
  }
  return assign;
}

/**
 * 生成填充计划
 * @param {{sections:Array}} model
 * @param {object} profile
 * @returns {Array} plans
 */
/**
 * 字段名里带这些词，就当"日期字段"处理 —— 不管 schema 里有没有为它声明 date。
 * 用户的要求很明确：只要名字里含"时间/日期"，就必须和出生日期走同一条链路
 * （日历面板 + 多格式键入 + 按网页粒度自动降级到年月），不能当普通文本框写。
 */
const DATE_WORD_RE = /(时间|日期|年月|生日|出生|入学|毕业|入职|离职|到岗|起止)/;

/** 值看起来像日期（2025-10-01 / 2025/10 / 2025年10月 / 2025.10.01） */
function looksLikeDateValue(v) {
  const s = String(v ?? '').trim();
  return /^\d{4}\s*[-/.年]/.test(s) || /^\d{4}$/.test(s);
}

/**
 * 把一个 plan 提升成"日期 plan"。
 * 触发条件：名字像日期 + 值确实是个日期。
 * 已经声明为 date 的（meta.kind === 'date'）不动。
 */
function promoteToDate(plan) {
  if (!plan || plan.kind === 'date') return plan;
  const name = String(plan.label || '') + ' ' + String((plan.field && plan.field.label) || '');
  if (!DATE_WORD_RE.test(name)) return plan;
  // 「起止时间」是一段区间（2021.09-2025.06），不是一个日期：按文本原样写
  if (plan.slot && /\.period$/.test(plan.slot)) return plan;
  if ((String(plan.value || '').match(/(19|20)\d{2}/g) || []).length >= 2) return plan;
  if (!looksLikeDateValue(plan.value)) return plan;
  return { ...plan, kind: 'date', precision: 'day', enumRef: null };
}

/**
 * 从记录里取某个字段的值。依次找三处：
 *   ① 顶层键 = 标准 label
 *   ② 顶层键 = 某个别名
 *   ③ __custom 里名字撞了内置字段的自定义条目
 *
 * 为什么需要 ②：资料库里可能存的是别名（旧版本的字段名不同，或用户自己改过键名）。
 * 真机案例：家庭情况的「职务」曾经叫「职位」，老记录里存的是 `{职位:'财务经理'}`，
 * 按 label「职务」去取就是空 → 报告里显示"无值"→ 看起来像"职务填不上"。
 *
 * 为什么需要 ③：用户会把某个内置字段**当成自定义字段**再填一遍（面板上叫"职务"、
 * 值在 __custom 里）。撞名规则会把这条自定义候选丢掉（不丢会让同一标签命中两个槽），
 * 但**值本身是用户认真填的**，不该跟着一起丢。
 * 只认非空值，避免空串挡住后面的查找。
 */
function recordValue(record, meta) {
  if (!record || !meta) return '';
  const direct = record[meta.label];
  if (String(direct ?? '').trim()) return direct;
  for (const a of meta.alias || []) {
    const v = record[a];
    if (String(v ?? '').trim()) return v;
  }
  const names = new Set([meta.label, ...(meta.alias || [])].map(normalize).filter(Boolean));
  for (const it of Array.isArray(record.__custom) ? record.__custom : []) {
    if (!it) continue;
    if (!names.has(normalize(String(it.name || '').trim()))) continue;
    if (String(it.value ?? '').trim()) return it.value;
  }
  return direct == null ? '' : direct;
}

/** 这条记录自己有没有填某个自定义字段（没定义返回 undefined，定义了但没填返回 ''） */
function ownCustomValue(record, name) {
  const key = normalize(String(name || '').trim());
  if (!key) return undefined;
  for (const it of Array.isArray(record.__custom) ? record.__custom : []) {
    if (it && normalize(String(it.name || '').trim()) === key) {
      return String(it.value == null ? '' : it.value);
    }
  }
  return undefined;
}

const DEGREE_RANK = { HIGH_SCHOOL: 1, VOCATIONAL: 1, ASSOCIATE: 2, BACHELOR: 3, MASTER: 4, DOCTOR: 5 };
function highestDegreeIndex(records) {
  let best = -1;
  let bestRank = 0;
  records.forEach((r, i) => {
    const res = r ? resolveValue(r['学历'], 'degreeLevel') : null;
    const rank = (res && DEGREE_RANK[res.code]) || 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = i;
    }
  });
  return best;
}

export function bind(model, profile) {
  const plans = [];
  const sections = (model && Array.isArray(model.sections) ? model.sections : []).filter(
    s => s && Array.isArray(s.blocks)
  );

  // 自定义字段全局只算一次：它们不随区块变化，且必须与"全部内置别名"去重
  const builtinNames = new Set(ALL_FIELDS.flatMap(c => c.field.alias.map(a => normalize(a))));
  const customs = customCandidates(profile, builtinNames);

  for (const section of sections) {
    const categoryId = section.categoryId || inferCategory(section);
    const category = categoryId ? categoryById(categoryId) : null;
    const records = category ? profile[category.id] || [] : [];
    // 区块分类不明时退到全局词表；此时 matchSlot 内部会做"全局唯一"校验，歧义一律返回 null
    const builtinCandidates = category ? category.fields.map(f => ({ field: f, category })) : ALL_FIELDS;
    // 分类内的候选排前面（同分时先命中），自定义字段垫在后面兜底
    const candidates = [...builtinCandidates, ...customs];
    const assign = alignBlocks(section.blocks, records, category || { id: '' }, candidates);

    for (const block of section.blocks) {
      let ri = assign.has(block.index) ? assign.get(block.index) : null;
      // 「最高学历专业类别」「最高学历毕业院校」这类单问区块：问的是最高学历那一段，
      // 不是第 1 段 —— 按学历层次挑记录（资料库里教育经历顺序不一定从高到低）
      if (category && category.id === 'education' && records.length > 1 && section.blocks.length === 1) {
        const asksHighest = (block.fields || []).some(f => /最高学历/.test((f.labelParts || []).join(' ')));
        if (asksHighest) {
          const hi = highestDegreeIndex(records);
          if (hi >= 0) ri = hi;
        }
      }
      const record = ri != null ? records[ri] || {} : null;
      const seen = new Set();
      for (const field of block.fields || []) {
        // 先在本区块分类内匹配（消歧主力）
        let m = matchSlot(field.labelParts, candidates);
        // 本分类内匹配不到时，才允许跨分类回退，且要求该标签全局唯一
        // （"学历/学位"常被放在"基本信息"里，但"姓名"全局不唯一，仍然不会被误配）
        if (!m && category) m = matchSlot(field.labelParts, ALL_FIELDS);

        const meta = m ? m.field : null;
        // 命中字段真正属于哪个分类（区块分类不明时以此为准）
        const owner = meta ? m.category : category;
        const dedupeKey = meta && owner ? `${owner.id}:${meta.slot}` : null;
        if (dedupeKey) {
          if (seen.has(dedupeKey)) {
            // 同一块里同一个槽出现第二次 = 块没切干净（两段经历被当成一段）。
            // 原来这里是直接 continue，**报告里一条都不留** —— 用户只能看到"这段没填"，
            // 看不到"为什么没填"。这里留一条 dup 记录，让报告能说清楚。
            plans.push({
              field,
              sectionTitle: section.title || '',
              categoryId: owner.id,
              blockIndex: block.index,
              recordIndex: ri,
              slot: meta.slot,
              label: meta.label,
              kind: meta.kind,
              precision: meta.precision || null,
              enumRef: meta.enumRef || null,
              value: '',
              matchScore: m ? m.score : 0,
              hasRecord: !!record,
              dup: true,
              dupOfSlot: meta.slot,
            });
            continue;
          }
          seen.add(dedupeKey);
        }

        let rawValue = '';
        let hasRecord = false;
        if (meta && owner) {
          if (m.custom) {
            // v2.0.26：自定义字段的值按"当前块对应的记录"取——
            // 每条记录的同名自定义字段内容**独立**（用户明确要求）。
            //   这条记录定义了 → 用它自己的值（没填就是空，报告里是"无值"）
            //   这条记录没定义 → 退回"第一条定义了它的记录"的值（老行为，
            //   覆盖"只在其中一条上加了自定义字段"的用法，避免单块页面丢值）
            if (owner === category && record) {
              const own = ownCustomValue(record, m.customName);
              rawValue = own === undefined ? m.customValue : own;
            } else {
              // 跨分类取值：值跟着定义走（customFieldsOf 已经按名字去重过）
              rawValue = m.customValue;
            }
            hasRecord = true;
          } else if (owner === category && record) {
            rawValue = recordValue(record, meta);
            hasRecord = true;
          } else {
            // 跨分类取值：优先取该分类里第一条填了这个字段的记录
            const recs = profile[owner.id] || [];
            const hit = recs.find(r => r && String(recordValue(r, meta) ?? '').trim()) || recs[0] || null;
            rawValue = hit ? recordValue(hit, meta) : '';
            hasRecord = !!hit;
          }
        }

        // v2.0.27：强弱标记。区块分类和字段归属分类**对不上**的计划是"跨分类兜底"，
        // 让位给对得上的。真机案例：页面顶部一个无标题的杂项组件里也有「职务」输入框，
        // 它在文档顺序里靠前、先被写；真正的家庭情况反而撞重复被跳过 ——
        // 表现就是"家庭情况 1 的职务没填"，诊断里那条计划压根不出现。
        const weak = !(category && owner && category.id === owner.id);

        plans.push(
          promoteToDate({
            field,
            sectionTitle: section.title || '',
            categoryId: owner ? owner.id : categoryId || '',
            blockIndex: block.index,
            recordIndex: ri,
            slot: meta ? meta.slot : null,
            label: meta ? meta.label : field.label,
            kind: meta ? meta.kind : null,
            precision: meta ? meta.precision : null,
            enumRef: meta ? meta.enumRef : null,
            value: rawValue == null ? '' : rawValue,
            matchScore: m ? m.score : 0,
            hasRecord,
            ...(weak ? { weak: true } : {}),
            // 卡片式录入要回到"这张卡"点确认（见 cards.js），留引用，不进报告
            section,
            block,
          })
        );
      }
    }
  }
  return plans;
}
