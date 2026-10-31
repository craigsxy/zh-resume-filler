// AI 善后（v2.2.0）：规则匹配做不到的两件事交给大模型——
//   ① 网页标签认不出（label-uncertain）：把"网页标签"和"资料里有值的字段名"发给模型，
//      让它判断哪个标签对应哪个字段（「您目前的居住城市」→ 当前所在城市）；
//   ② 下拉选项对不上（option-no-match）：把资料值和网页选项发给模型，让它从选项里挑一个
//      （「学术型硕士 / 工学 / 机械工程」→「信息科学与技术类」），挑不出就返回 null。
//
// 隐私边界：
//   · ① 只发标签文本和字段**名称**，不发任何资料值；
//   · ② 只对枚举/下拉类字段发"值 + 选项"，姓名、证件号、手机、邮箱、地址、紧急联系人等敏感字段永远不发；
//   · API Key 只在 background 里读取和使用（见 background.js），内容脚本和网页都拿不到。
//
// 网络调用通过 options.aiClient(messages) 注入：扩展里走 background，测试里用桩。

import { CATEGORIES, FIELD_BY_SLOT } from './schema.js';
import { customFieldsOf, recordValue, promoteToDate } from './binder.js';
import { resolveValue, primaryValue } from './resolver.js';
import { normalize } from './util.js';

const MAX_FIELDS = 40;
const MAX_SLOTS = 160;
const MIN_CONFIDENCE = 0.7;

/** 永远不发给 AI 的字段（值） */
export const SENSITIVE_SLOTS = new Set([
  'personal.name',
  'personal.pinyin',
  'personal.englishName',
  'personal.idNo',
  'personal.mobile',
  'personal.email',
  'personal.wechat',
  'personal.qq',
  'personal.address',
  'personal.mailingAddress',
  'personal.emergencyContact',
  'personal.emergencyPhone',
  'personal.birth',
  'edu.studentNo',
  'edu.certNo',
  'edu.degreeCertNo',
  'family.name',
  'family.phone',
]);

const has = v => v != null && typeof v !== 'object' && String(v).trim() !== '';

/** 从模型回复里抠出 JSON（容忍 ```json 代码块、前后废话） */
export function parseJsonReply(text) {
  const s = String(text || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : s;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(body.slice(a, b + 1));
  } catch (_) {
    return null;
  }
}

/** 资料里"有值"的字段 → 可供 AI 选择的槽（只给名字，不给值） */
export function slotCatalog(profile) {
  const out = [];
  for (const c of CATEGORIES) {
    if (c.custom) continue;
    const recs = (profile && profile[c.id]) || [];
    for (const f of c.fields) {
      if (f.kind === 'upload') continue;
      if (!recs.some(r => r && has(recordValue(r, f)))) continue;
      out.push({ id: f.slot, name: `${c.name}·${f.label}` });
    }
  }
  for (const cf of customFieldsOf(profile || {})) {
    if (!has(cf.value)) continue;
    out.push({ id: cf.slot, name: `自定义·${cf.name}`, custom: cf });
  }
  return out.slice(0, MAX_SLOTS);
}

const LABEL_SYSTEM =
  '你是中文网申表单字段匹配助手。给你网页上一组"没认出来的表单字段"（标签、所在区块、控件类型）' +
  '和求职者资料库里"已填写的字段名称"清单。请判断每个网页字段对应资料库里的哪一个字段。' +
  '只有含义确实相同才匹配（同义、措辞不同、带说明文字都算），不确定、或资料库里没有对应字段就给 null。' +
  '「是否…」类问题只能匹配到同样的「是否…」字段。授权、同意、隐私条款类勾选一律 null。' +
  '只输出 JSON：{"matches":[{"field":"字段编号","slot":"资料字段编号或null","confidence":0到1}]}';

const OPTION_SYSTEM =
  '你是中文网申表单的下拉选项匹配助手。每一项给你：字段名、求职者资料里的值、网页下拉的全部选项。' +
  '请从选项里挑出与资料值含义最接近、填上去不会误导招聘方的那一个；资料值里可能用「|」写了多个备选、' +
  '用「/」写了层级路径，都可以参考。如果没有任何选项合适，给 null，宁缺毋滥。选项必须原样照抄。' +
  '只输出 JSON：{"choices":[{"id":"编号","option":"选项原文或null"}]}';

/** ① 标签映射请求 */
export function buildLabelRequest(plans, catalog) {
  const fields = plans.slice(0, MAX_FIELDS).map((p, i) => ({
    field: `f${i}`,
    label: [...new Set((p.field.labelParts || []).concat(p.field.label || []))].filter(Boolean).slice(0, 4),
    section: p.sectionTitle || '',
    control: p.field.controlKind || '',
  }));
  const user = JSON.stringify({ fields, slots: catalog.map(s => ({ slot: s.id, name: s.name })) });
  return [
    { role: 'system', content: LABEL_SYSTEM },
    { role: 'user', content: user },
  ];
}

/** ② 选项匹配请求 */
export function buildOptionRequest(items) {
  const user = JSON.stringify({
    items: items.map((it, i) => ({ id: `o${i}`, field: it.label, value: it.value, options: it.options })),
  });
  return [
    { role: 'system', content: OPTION_SYSTEM },
    { role: 'user', content: user },
  ];
}

/**
 * 送去让 AI 认标签的字段：
 *   · 规则完全没认出来的（无槽）；
 *   · 规则只是**模糊**匹配上（没有精确命中别名）、结果选项又对不上的——多半是认错了
 *     （「本科及以上学历所学门类」因为含"学历"被配到学历层次）。
 * 授权勾选、上传、页面头像这类不送。
 */
function eligibleForLabel(plan, rowOf, force) {
  if (!plan || plan.dup) return false;
  if (plan.slot) {
    const row = rowOf && rowOf.get(plan);
    if (!row) return false;
    // 强制复核：规则认出了字段、但资料里这个字段没值（empty / no-record）→ 让 AI 看看资料里有没有同义字段可用
    const emptyHere = row.status === 'empty' || row.reason === 'no-record';
    if (!(force && emptyHere) && (row.reason !== 'option-no-match' || !(plan.matchScore < 1))) return false;
    if (String(plan.slot).startsWith('derived:')) return false;
  }
  const ck = plan.field && plan.field.controlKind;
  if (ck === 'CHECKBOX_GROUP' || ck === 'UPLOAD') return false;
  const parts = (plan.field.labelParts || []).filter(Boolean);
  if (!parts.length) return false;
  if (parts.every(p => /(同意|授权|隐私|协议|条款)/.test(p))) return false;
  return true;
}

/** 由 AI 给的槽，按 binder 的取值规则造一个可执行的计划 */
function planForSlot(plan, slotId, catalog, profile, siblings) {
  const hit = catalog.find(s => s.id === slotId);
  if (!hit) return null;
  if (hit.custom) {
    return {
      ...plan,
      slot: hit.custom.slot,
      label: hit.custom.name,
      kind: 'text',
      enumRef: null,
      value: hit.custom.value,
      hasRecord: true,
      viaAi: true,
    };
  }
  const meta = FIELD_BY_SLOT.get(slotId);
  if (!meta) return null;
  const { field, category } = meta;
  const recs = profile[category.id] || [];
  // 同一块里其他字段对上了哪条记录，就用哪条；否则用第一条有这个值的
  const sib = siblings.find(p => p.block === plan.block && p.categoryId === category.id && p.recordIndex != null);
  let record = sib ? recs[sib.recordIndex] : null;
  if (!record || !has(recordValue(record, field))) record = recs.find(r => r && has(recordValue(r, field))) || null;
  if (!record) return null;
  return promoteToDate({
    ...plan,
    slot: field.slot,
    label: field.label,
    kind: field.kind,
    precision: field.precision || null,
    enumRef: field.enumRef || null,
    categoryId: category.id,
    value: recordValue(record, field),
    hasRecord: true,
    viaAi: true,
  });
}

/**
 * 执行 AI 善后。只改动"规则没处理好"的行，把它们原地替换成新结果。
 * @param ctx {plans, results, rowOf: Map(plan→row), profile, writeField, deps, aiClient, log}
 * @returns {Promise<{mapped:number, options:number, calls:number, error?:string}>}
 */
export async function aiAssist(ctx) {
  const { plans, results, rowOf, profile, writeField, deps, aiClient } = ctx;
  const stat = { mapped: 0, options: 0, calls: 0 };
  const replace = (plan, row) => {
    const old = rowOf.get(plan);
    const i = old ? results.indexOf(old) : -1;
    if (i >= 0) results[i] = row;
    else results.push(row);
    rowOf.set(plan, row);
  };
  const baseRow = (plan, res, note) => ({
    section: plan.sectionTitle || '',
    categoryId: plan.categoryId || '',
    block: plan.blockIndex,
    label: plan.label || plan.field.label,
    slot: plan.slot || '',
    value: String(primaryValue(plan.value ?? '')),
    kind: plan.kind || '',
    controlKind: plan.field.controlKind,
    ...res,
    ai: note,
  });

  // ① 标签映射
  try {
    const todo = plans.filter(p => eligibleForLabel(p, rowOf, ctx.force));
    const catalog = slotCatalog(profile);
    if (todo.length && catalog.length) {
      stat.calls++;
      const reply = await aiClient(buildLabelRequest(todo, catalog));
      const json = parseJsonReply(reply);
      const matches = (json && Array.isArray(json.matches) && json.matches) || [];
      // 同一块里已经被规则填上的槽，AI 不再抢
      const taken = new Map();
      const takenHas = (b, slot) => !!(taken.get(b) && taken.get(b).has(slot));
      const takenAdd = (b, slot) => {
        if (!taken.has(b)) taken.set(b, new Set());
        taken.get(b).add(slot);
      };
      for (const p of plans) if (p.slot && rowOf.get(p) && rowOf.get(p).status === 'filled') takenAdd(p.block, p.slot);
      for (const m of matches) {
        const idx = Number(String(m && m.field).replace(/^f/, ''));
        const plan = todo[idx];
        if (!plan || !m.slot || Number(m.confidence || 0) < MIN_CONFIDENCE) continue;
        if (plan.slot && String(m.slot) === plan.slot) continue; // AI 也认为是这个字段：留给下面的选项匹配
        const next = planForSlot(plan, String(m.slot), catalog, profile, plans);
        if (!next || !has(primaryValue(next.value))) continue;
        if (takenHas(plan.block, next.slot)) continue;
        takenAdd(plan.block, next.slot);
        let res;
        try {
          next.resolved = resolveValue(next.value, next.enumRef || null);
          res = await writeField(next, deps);
        } catch (e) {
          res = { status: 'failed', reason: 'exception:' + String((e && e.message) || e).slice(0, 80) };
        }
        Object.assign(plan, { slot: next.slot, label: next.label, kind: next.kind, value: next.value, categoryId: next.categoryId, enumRef: next.enumRef, viaAi: true });
        replace(plan, baseRow(next, res, 'ai-mapped'));
        if (res.status === 'filled') stat.mapped++;
      }
    }
  } catch (e) {
    stat.error = String((e && e.message) || e).slice(0, 120);
  }

  // ② 选项匹配
  try {
    const items = [];
    for (const plan of plans) {
      const row = rowOf.get(plan);
      if (!row || row.reason !== 'option-no-match') continue;
      if (SENSITIVE_SLOTS.has(plan.slot)) continue;
      const opts = (row.allOptions || row.available || []).filter(Boolean).slice(0, 80);
      if (opts.length < 2) continue;
      items.push({ plan, label: plan.label || plan.field.label, value: String(plan.value ?? ''), options: opts });
    }
    if (items.length) {
      stat.calls++;
      const reply = await aiClient(buildOptionRequest(items));
      const json = parseJsonReply(reply);
      const choices = (json && Array.isArray(json.choices) && json.choices) || [];
      for (const c of choices) {
        const it = items[Number(String(c && c.id).replace(/^o/, ''))];
        if (!it || !c.option) continue;
        // 必须是网页上真实存在的选项（模型编造的一律不用）
        const exact = it.options.find(o => normalize(o) === normalize(c.option));
        if (!exact) continue;
        const next = { ...it.plan, value: exact, enumRef: null, viaAi: true };
        let res;
        try {
          next.resolved = resolveValue(exact, null);
          res = await writeField(next, deps);
        } catch (e) {
          res = { status: 'failed', reason: 'exception:' + String((e && e.message) || e).slice(0, 80) };
        }
        const row = baseRow(it.plan, res, 'ai-option');
        row.value = `${String(it.plan.value)} → ${exact}`;
        replace(it.plan, row);
        if (res.status === 'filled') stat.options++;
      }
    }
  } catch (e) {
    stat.error = stat.error || String((e && e.message) || e).slice(0, 120);
  }
  return stat;
}
