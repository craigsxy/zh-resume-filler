// L5 编排：扫描 → 绑定 → 逐字段写入 → 汇总报告
import { buildFormModel } from './form-model.js';
import { bind, customFieldsOf } from './binder.js';
import { expandSections } from './repeat.js';
import { writeField } from './adapters/index.js';
import { resetPanelMemo } from './adapters/select.js';
import { resolveValue } from './resolver.js';
import { withoutSavedRecords, commitCards } from './cards.js';
import { STRONG_KEYS, categoryById } from './schema.js';
import * as bridgeApi from './bridge.js';
import { sleep, tagOf, pathOf, setNativeValue, fire, numericOf } from './util.js';

const blockIds = new WeakMap();
let blockSeq = 0;
function blockIdOf(plan) {
  const b = plan.block;
  if (!b || typeof b !== 'object') return `${plan.sectionTitle || ''}#${plan.blockIndex}`;
  if (!blockIds.has(b)) blockIds.set(b, ++blockSeq);
  return 'b' + blockIds.get(b);
}

function hasValue(v) {
  if (v == null) return false;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return String(v).trim() !== '';
}

export async function fillPage(profile, options = {}) {
  const bridge = options.bridge || bridgeApi;
  resetPanelMemo();

  let model;
  let plans;
  let expand = { added: 0, log: [] };
  let savedLog = [];
  try {
    model = buildFormModel();
    // v2.0.33 卡片式录入：已经以只读卡片保存在页面上的记录不再参与扩充和绑定，
    // 否则资料库 1 条 + 页面 0 个编辑块 → 再点一次「添加」→ 同一段录两遍
    try {
      const sv = withoutSavedRecords(profile, model, STRONG_KEYS);
      profile = sv.profile;
      savedLog = sv.log;
    } catch (_) {}
    // 多段经历：网页只渲染一段时先把"第 n 段"的位置点出来（点完必须重新扫描）
    if (options.expand !== false) {
      // 扩充是"锦上添花"：点按钮涉及第三方页面，出错只能降级成"只填第一段"，
      // 绝不能因此把整次填充变成一条 error 报告
      try {
        const ex = await expandSections(profile, model, options);
        if (ex && ex.model) {
          expand = ex;
          model = ex.model;
        }
      } catch (e) {
        expand = { added: 0, log: ['扩充经历区块时出错：' + String((e && e.message) || e)] };
        model = buildFormModel();
      }
    }
    if (savedLog.length) expand = { ...expand, log: [...savedLog, ...(expand.log || [])] };
    plans = bind(model, profile);
    // v2.0.27：同一个语义槽被页面上两处抢时，先写"区块分类对得上"的那处。
    // 真机案例：页面顶部一个无标题的杂项组件里也有「职务」输入框，它文档顺序靠前、
    // 先被写并占住了 family.title；真正的家庭情况反而撞重复被跳过。
    // 弱计划（跨分类兜底）排后面：强计划没占的槽它仍然能填，行为不回退。
    plans.sort((a, b) => (a.weak ? 1 : 0) - (b.weak ? 1 : 0));
  } catch (e) {
    // 扫描/绑定阶段的异常必须变成可读报告，不能让整次填充"中断"
    return {
      found: false,
      error: '扫描或绑定失败：' + String((e && e.message) || e),
      total: 0,
      filled: 0,
      lowConfidence: 0,
      skipped: 0,
      failed: 0,
      empty: 0,
      repeat: { added: 0, log: [] },
      sections: [],
      results: [],
    };
  }

  const results = [];
  const planResults = new Map();
  const seen = new Set();
  // 收尾复核用：记录"普通文本框写成功"的 plan 和它对应的报告行
  const filledTexts = [];

  for (const plan of plans) {
    const base = {
      section: plan.sectionTitle || '',
      categoryId: plan.categoryId || '',
      block: plan.blockIndex,
      label: plan.label || plan.field.label,
      slot: plan.slot || '',
      value: typeof plan.value === 'object' ? '[文件]' : String(plan.value ?? ''),
      kind: plan.kind || '',
      controlKind: plan.field.controlKind,
      container: tagOf(plan.field.container),
    };

    if (plan.dup) {
      // 块没切干净导致的"撞槽"：必须显式报出来，否则用户只看到"这段没填"
      results.push({
        ...base,
        status: 'skipped',
        reason: 'duplicate-slot',
        parts: ((plan.field && plan.field.labelParts) || []).slice(0, 4),
        path: pathOf(plan.field.el),
      });
      continue;
    }
    if (!plan.slot) {
      results.push({
        ...base,
        status: 'skipped',
        reason: 'label-uncertain',
        parts: ((plan.field && plan.field.labelParts) || []).slice(0, 4),
        el: tagOf(plan.field.el),
        path: pathOf(plan.field.el),
      });
      continue;
    }
    if (!plan.hasRecord) {
      results.push({ ...base, status: 'skipped', reason: 'no-record' });
      continue;
    }
    if (!hasValue(plan.value)) {
      results.push({ ...base, status: 'empty' });
      continue;
    }
    // 同分类可能出现在两个区块里（「教育背景-最高学历专业类别」+「教育背景」卡片），
    // 只按 分类:块序号:槽 去重会把第二个区块的同名槽悄悄吞掉 → 按块对象去重
    // 弱计划（跨分类兜底）仍按旧口径：强计划已经占了 分类:块序号:槽 就让位（v2.0.27 杂项「职务」）
    const key = `${blockIdOf(plan)}:${plan.categoryId}:${plan.slot}`;
    const slotKey = `${plan.categoryId}:${plan.blockIndex}:${plan.slot}`;
    if (seen.has(key) || (plan.weak && seen.has(slotKey))) continue;
    seen.add(key);
    seen.add(slotKey);

    let res;
    try {
      plan.resolved = plan.kind === 'upload' ? null : resolveValue(plan.value, plan.enumRef || null);
      res = await writeField(plan, { bridge });
    } catch (e) {
      res = { status: 'failed', reason: 'exception:' + String((e && e.message) || e).slice(0, 80) };
    }
    const pushed = { ...base, ...res, resolvedCode: (plan.resolved && plan.resolved.code) || '' };
    results.push(pushed);
    planResults.set(plan, pushed);
    // 跳过/失败的字段补上祖先链，方便按站点校准选择器
    if (res.status !== 'filled') results[results.length - 1].path = pathOf(plan.field.el);
    // 普通文本框写成功的记下来，收尾时复核（见下）
    if (res.status === 'filled' && res.via === 'native' && (plan.kind === 'text' || plan.kind === 'number')) {
      filledTexts.push({ plan, res: pushed });
    }
    await sleep(40);
  }

  // 收尾复核（v2.0.27 → v2.0.30）：个别站点会在**后续**某次重渲染里，把没走它自己状态的
  // 文本框清空。真机证据：证件号码写入成功、回读也成功，几秒后页面上是空的。
  // v2.0.28 的"最多重试 3 次"仍不够——恢复之后站点还会**再清一轮**（用户截图：
  // 报告里 recovered-after-clear，页面上却是空的）。v2.0.30 改三件事：
  //   ① 每次恢复后再**观察 450ms**，确认没被二次清掉，被清就当作没恢复继续重试；
  //   ② 整个填充收尾后**延迟 1.2s 再复核第二轮**，且第二轮**不复用 done 标记**——
  //      上一轮"恢复成功"的字段仍会被再查一遍，被二次清掉就再救一次（这是旧版漏的：
  //      第一轮明明救了、第二轮却因 done 直接跳过，页面才空的）；
  //   ③ 只有这一页真的出现过"被清空"的字段才延迟 1.2s 复核，否则无谓地 sleep 拖慢每次填充。
  const readVal = el => {
    try {
      return String(el.value ?? '').trim();
    } catch (_) {
      return null;
    }
  };
  let clearedAny = false; // 这一页是否出现过"被站点清空"的字段（决定要不要延迟第二轮）
  const recheckCleared = async maxAttempts => {
    for (const item of filledTexts) {
      if (item.dead) continue; // 元素已被站点移除 / 读不到值，永远不必再管
      const el = item.plan.field && item.plan.field.el;
      if (!el || !el.tagName) {
        item.dead = true;
        continue;
      }
      const cur = readVal(el);
      if (cur == null) {
        item.dead = true; // 读不到值（元素失效）→ 放弃，避免误报 cleared-by-site
        continue;
      }
      if (cur) continue; // 值还在 → 本轮无事
      // 值被清空：这是"清空型站点"，记下需要延迟第二轮的信号
      clearedAny = true;
      let v = String(item.plan.value ?? '');
      if (item.plan.kind === 'number') v = numericOf(v) || v;
      if (!v.trim()) {
        item.dead = true;
        continue;
      }

      const waits = [80, 300, 500, 800];
      let recovered = false;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          el.focus();
        } catch (_) {}
        setNativeValue(el, v);
        fire(el, 'input', { bubbles: true });
        fire(el, 'change', { bubbles: true });
        await sleep(waits[Math.min(attempt - 1, waits.length - 1)]);
        let now = readVal(el);
        if (now) {
          // 站点可能过一会儿才清：恢复后再观察一次，被二次清掉就继续重试
          await sleep(450);
          now = readVal(el);
        }
        if (now) {
          item.res.readback = now;
          item.res.note = 'recovered-after-clear';
          item.res.status = 'filled';
          delete item.res.reason;
          delete item.res.path;
          recovered = true;
          break;
        }
      }
      if (!recovered) {
        // 这一轮没救回来：如实报 cleared-by-site。第二轮也会走到这里，
        // 覆盖上一轮的状态——最终状态以**最后一次复核**为准。
        item.res.status = 'failed';
        item.res.reason = 'cleared-by-site';
        item.res.path = pathOf(item.plan.field.el);
      }
    }
  };
  await recheckCleared(4);
  // 站点可能在我们收尾、报告都出了之后才清（真机如此）——延迟一段再复核一轮
  if (clearedAny) {
    await sleep(1200);
    await recheckCleared(1);
  }

  // 卡片式录入：这次写进了值的多段经历块，点卡片内的「确认」保存（cards.js 里有安全边界）
  if (options.commitCards !== false) {
    try {
      const targets = [];
      const seenBlocks = new Set();
      plans.forEach((plan, i) => {
        const r = planResults.get(plan);
        if (!r || r.status !== 'filled' || !plan.block || !plan.section) return;
        const cat = categoryById(plan.section.categoryId || plan.categoryId);
        if (!cat || !cat.multiple) return;
        if (seenBlocks.has(plan.block)) return;
        seenBlocks.add(plan.block);
        targets.push({ section: plan.section, block: plan.block, order: i });
      });
      results.push(...(await commitCards(targets)));
    } catch (e) {
      results.push({ section: '', label: '卡片确认', status: 'failed', reason: 'exception:' + String((e && e.message) || e).slice(0, 80) });
    }
  }

  return summarize(withCustomDiagnostics(profile, model, results), model, expand);
}

/**
 * 自定义字段专项诊断（v2.0.19）
 * 用户自己加的字段如果没匹配上，原来是**悄悄消失**的——报告里一条都没有，
 * 看起来就像"根本没检测到"。这里补一条明确的记录：资料库里有这个字段，
 * 但这一页没有能对上的标签。只对"这次真的出现了的分类"报，避免刷屏。
 */
function withCustomDiagnostics(profile, model, results) {
  let defined;
  try {
    defined = customFieldsOf(profile);
  } catch (_) {
    return results;
  }
  if (!defined.length) return results;

  const matched = new Set(results.map(r => r.slot).filter(Boolean));
  const categoriesInPlay = new Set(results.map(r => r.categoryId).filter(Boolean));
  for (const s of (model && model.sections) || []) {
    if (s && s.categoryId) categoriesInPlay.add(s.categoryId);
  }

  const extra = [];
  for (const f of defined) {
    if (matched.has(f.slot)) continue;
    // 该分类这次压根没出现在页面上 → 不用说
    if (f.categoryId !== 'custom' && !categoriesInPlay.has(f.categoryId)) continue;
    extra.push({
      section: '',
      categoryId: f.categoryId,
      block: 0,
      label: f.name,
      slot: f.slot,
      value: f.value,
      kind: 'text',
      controlKind: '',
      status: 'skipped',
      reason: 'custom-no-match',
    });
  }
  return extra.length ? [...results, ...extra] : results;
}

function summarize(results, model, expand) {
  const filled = results.filter(r => r.status === 'filled');
  const lowConfidence = filled.filter(r => r.lowConfidence);
  const skipped = results.filter(r => r.status === 'skipped');
  const failed = results.filter(r => r.status === 'failed');
  const empty = results.filter(r => r.status === 'empty');
  const reasonCounts = {};
  for (const r of results) {
    if (!r.reason) continue;
    reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
  }
  return {
    found: results.length > 0,
    total: results.length,
    filled: filled.length,
    lowConfidence: lowConfidence.length,
    skipped: skipped.length,
    failed: failed.length,
    empty: empty.length,
    repeat: { added: (expand && expand.added) || 0, log: (expand && expand.log) || [] },
    sections: (model.sections || []).map(s => ({
      title: s.title,
      blocks: (s.blocks || []).length,
      fields: (s.blocks || []).reduce((n, b) => n + (b.fields || []).length, 0),
    })),
    reasonCounts,
    results,
  };
}
