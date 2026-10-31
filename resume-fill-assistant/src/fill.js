// L5 编排：扫描 → 绑定 → 逐字段写入 → 汇总报告
import { buildFormModel } from './form-model.js';
import { bind, customFieldsOf } from './binder.js';
import { expandSections } from './repeat.js';
import { writeField } from './adapters/index.js';
import { resetPanelMemo } from './adapters/select.js';
import { resolveValue, primaryValue } from './resolver.js';
import { withoutSavedRecords, commitCards } from './cards.js';
import { deriveProfile } from './derive.js';
import { aiAssist } from './ai.js';
import { STRONG_KEYS, CATEGORIES, categoryById } from './schema.js';
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

/** 授权 / 同意 / 隐私条款这类勾选：插件永远不替你勾，报告里单独说清楚，而不是混在"标签认不出"里 */
const CONSENT_RE = /(同意|授权|隐私|协议|声明|承诺|知情|consent|agree|privacy)/i;
function isConsent(plan) {
  const f = plan.field || {};
  const el = f.el || {};
  const isCheck = f.controlKind === 'CHECKBOX_GROUP' || String(el.type || '').toLowerCase() === 'checkbox';
  if (!isCheck) return false;
  let ctx = String(plan.sectionTitle || '') + ' ' + (f.labelParts || []).join(' ');
  try {
    ctx += ' ' + String((f.container && f.container.textContent) || '').slice(0, 200);
  } catch (_) {}
  return CONSENT_RE.test(ctx);
}

/**
 * 网页上这一格现在有没有内容（用户手填的、上次填好的、站点预填的都算）。
 * 有内容就不再写——用户明确要求：已经填上的地方不应该再被覆盖一次。
 * 认不准结构的自绘控件按"空"处理（沿用原来的写入行为）。
 */
const PLACEHOLDER_RE = /^(请选择.*|请输入.*|请填写.*|选填|必填|--+|—+|-|select.*|please.*|年\/月\/日|yyyy.*)$/i;
function pageValue(field) {
  try {
    const ck = field.controlKind;
    if (ck === 'UPLOAD' || ck === 'CHECKBOX_GROUP') return '';
    const box = field.container || (field.el && field.el.parentElement);
    if (ck === 'RADIO_GROUP') {
      const on = box.querySelector('[class*="radio-wrapper-checked"],[class*="radio--checked"],.is-checked,[role="radio"][aria-checked="true"]');
      if (on) return String(on.textContent || '').trim() || 'checked';
      // 组件库单选：外层没有"已选中"样式就算没选（原生 checked 可能是假的）
      if (box.querySelector('[class*="radio-wrapper"],[class*="el-radio"]')) return '';
      return box.querySelector('input[type="radio"]:checked') ? 'checked' : '';
    }
    const el = field.el;
    if (el.tagName === 'SELECT') {
      const o = el.selectedOptions && el.selectedOptions[0];
      const t = o && o.value !== '' ? String(o.textContent || '').trim() : '';
      return PLACEHOLDER_RE.test(t) ? '' : t;
    }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const t = String(el.value || '').trim();
      if (t && !PLACEHOLDER_RE.test(t)) return t;
    }
    // 自绘下拉：已选值节点（antd / Element / 通用命名）
    const sel = box && box.querySelector('[class*="selected-value"],[class*="selection-item"],[class*="select__selected"],[class*="single-value"],[class*="selection__choice"]');
    if (sel) {
      const t = String(sel.textContent || '').trim();
      return PLACEHOLDER_RE.test(t) ? '' : t;
    }
    return '';
  } catch (_) {
    return '';
  }
}

function hasValue(v) {
  if (v == null) return false;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return String(v).trim() !== '';
}

export async function fillPage(profile, options = {}) {
  const bridge = options.bridge || bridgeApi;
  // 进度回调：侧边栏 / 悬浮按钮实时显示"正在填第几个"。回调出错不能影响填写
  const progress = info => {
    try {
      if (typeof options.onProgress === 'function') options.onProgress(info);
    } catch (_) {}
  };
  progress({ stage: 'scan', text: '正在识别网页表单…' });
  resetPanelMemo();
  const inputProfile = profile;
  // 派生字段只补空：年龄、毕业院校、起止时间、工作经历←实习经历……（derive.js）
  try {
    profile = deriveProfile(profile || {});
  } catch (_) {}

  let model;
  let plans;
  let fullProfile = profile;
  let expand = { added: 0, log: [] };
  let savedLog = [];
  try {
    // 选区填写：只扫用户点选的那块区域，不做多段扩充
    const root = options.root && options.root.isConnected ? options.root : undefined;
    if (root) options = { ...options, expand: false };
    model = buildFormModel(root);
    // v2.0.33 卡片式录入：已经以只读卡片保存在页面上的记录不再参与扩充和绑定，
    // 否则资料库 1 条 + 页面 0 个编辑块 → 再点一次「添加」→ 同一段录两遍
    fullProfile = profile;
    try {
      const sv = withoutSavedRecords(profile, model, STRONG_KEYS);
      profile = sv.profile;
      savedLog = Array.isArray(options.onlyCategories)
        ? sv.log.filter((_, i) => options.onlyCategories.includes(sv.saved[i].categoryId))
        : sv.log;
    } catch (_) {}
    // 多段经历：网页只渲染一段时先把"第 n 段"的位置点出来（点完必须重新扫描）
    if (options.expand !== false) {
      progress({ stage: 'expand', text: '正在补齐多段经历的卡片…' });
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
        model = buildFormModel(root);
      }
    }
    if (savedLog.length) expand = { ...expand, log: [...savedLog, ...(expand.log || [])] };
    plans = bind(model, profile, { fullProfile });
    // 第 2 轮起只处理"上一轮没能加出卡片"的分类，别的字段不再重写一遍
    if (Array.isArray(options.onlyCategories)) plans = plans.filter(p => options.onlyCategories.includes(p.categoryId));
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

  const writable = plans.filter(p => p.slot && !p.dup && p.hasRecord && hasValue(p.value)).length;
  let step = 0;
  for (const plan of plans) {
    // 上一轮已经填好的控件不再重写（条件展开后的第 2 轮）
    if (options.doneEls && plan.field && options.doneEls.has(plan.field.el)) continue;
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

    if (plan.dup && plan.kind === 'upload') continue; // 上传按钮旁的文件名框：同一个上传，不必报
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
    if (!plan.slot && isConsent(plan)) {
      results.push({ ...base, label: (plan.field.labelParts || [])[0] || '授权勾选', status: 'skipped', reason: 'consent-manual' });
      continue;
    }
    if (!plan.slot) {
      const row = {
        ...base,
        status: 'skipped',
        reason: 'label-uncertain',
        parts: ((plan.field && plan.field.labelParts) || []).slice(0, 4),
        el: tagOf(plan.field.el),
        path: pathOf(plan.field.el),
      };
      results.push(row);
      planResults.set(plan, row); // AI 善后要能找回这一行原地替换
      continue;
    }
    if (!plan.hasRecord) {
      const row = { ...base, status: 'skipped', reason: 'no-record' };
      results.push(row);
      planResults.set(plan, row);
      continue;
    }
    if (!hasValue(plan.value)) {
      const row = { ...base, status: 'empty' };
      results.push(row);
      planResults.set(plan, row);
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

    // 网页上已经有内容：不覆盖（报告里标「网页上已有内容」）
    if (!options.overwrite) {
      const cur = pageValue(plan.field);
      if (cur) {
        const row = { ...base, status: 'filled', via: 'already', readback: cur, note: 'already-has-value' };
        results.push(row);
        planResults.set(plan, row);
        continue;
      }
    }
    step++;
    progress({ stage: 'fill', done: step, total: writable, text: `正在填写 ${step}/${writable}：${plan.sectionTitle ? plan.sectionTitle + ' · ' : ''}${plan.label || plan.field.label || ''}` });
    let res;
    try {
      plan.resolved = plan.kind === 'upload' ? null : resolveValue(plan.value, plan.enumRef || null);
      res = await writeField(plan, { bridge });
    } catch (e) {
      res = { status: 'failed', reason: 'exception:' + String((e && e.message) || e).slice(0, 80) };
    }
    const pushed = { ...base, ...res, resolvedCode: (plan.resolved && plan.resolved.code) || '' };
    if (plan.derived === 'has-records') pushed.note = pushed.note || 'derived-yesno';
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

  // AI 善后（v2.2.0）：规则认不出的标签、对不上的选项交给模型（见 ai.js；Key 只在 background）
  let aiStat = null;
  if (typeof options.aiClient === 'function') {
    progress({ stage: 'ai', text: 'AI 正在善后规则没认出的字段…' });
    try {
      aiStat = await aiAssist({ plans, results, rowOf: planResults, profile, writeField, deps: { bridge }, aiClient: options.aiClient, force: !!options.aiForce });
    } catch (e) {
      aiStat = { mapped: 0, options: 0, calls: 0, error: String((e && e.message) || e).slice(0, 120) };
    }
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
      let v = primaryValue(item.plan.value ?? '');
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

  let commitRows = [];
  // 卡片式录入：这次写进了值的多段经历块，点卡片内的「确认」保存（cards.js 里有安全边界）
  if (options.commitCards !== false) {
    progress({ stage: 'commit', text: '正在点各张卡片的「确认」…' });
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
      commitRows = await commitCards(targets);
      results.push(...commitRows);
    } catch (e) {
      results.push({ section: '', label: '卡片确认', status: 'failed', reason: 'exception:' + String((e && e.message) || e).slice(0, 80) });
    }
  }

  // 条件展开（v2.2.2）：很多网申要先答「是否有实习经验 = 是」才显示实习卡片区、追问题。
  // 只扫一次就永远看不到它们 → 填完一轮后重扫，有新出现的字段就再来一轮（已填的不重写）。
  const round0 = options.round || 0;
  let appeared = 0;
  if (round0 < 2) {
    try {
      const known = new Set(plans.map(p => p.field && p.field.el).filter(Boolean));
      await sleep(250);
      const again = buildFormModel(options.root && options.root.isConnected ? options.root : undefined);
      for (const sct of again.sections || []) for (const b of sct.blocks || []) for (const f of b.fields || []) if (!known.has(f.el)) appeared++;
    } catch (_) {}
  }
  if (appeared > 0) {
    progress({ stage: 'scan', text: `页面新展开了 ${appeared} 个字段，接着填…` });
    const done = new Set(options.doneEls || []);
    for (const [plan, row] of planResults) if (row && row.status === 'filled' && plan.field) done.add(plan.field.el);
    try {
      const next = await fillPage(inputProfile, { ...options, round: round0 + 1, doneEls: done, onlyCategories: undefined });
      if (next && !next.error) {
        results.push(...(next.results || []).filter(r => r.reason !== 'custom-no-match'));
        expand = {
          ...expand,
          added: (expand.added || 0) + ((next.repeat && next.repeat.added) || 0),
          log: [...(expand.log || []), `页面新展开了 ${appeared} 个字段，又填了一轮`, ...((next.repeat && next.repeat.log) || []).map(l => `第 ${round0 + 2} 轮 · ${l}`)],
        };
        if (next.ai && aiStat) aiStat = { ...aiStat, calls: aiStat.calls + next.ai.calls, mapped: aiStat.mapped + next.ai.mapped, options: aiStat.options + next.ai.options };
        commitRows = [];
      }
    } catch (_) {}
  }

  // 卡片站点常见"先保存当前卡才能再加一张"：这一轮点「添加」没反应、但同分类已经有卡确认成功了
  // → 重新扫描再来一轮（已保存的卡会被 withoutSavedRecords 认出来，不会重复录）。最多 3 轮。
  const round = options.round || 0;
  const okCats = new Set(commitRows.filter(r => r.status === 'filled').map(r => r.categoryId));
  // 这一轮确实保存成功了卡片的分类：继续下一轮（下一轮会把已保存的认出来，只处理剩下的；
  // 没有剩下的就什么也不做、自然停止）。不能只看"点添加没反应"——上一张保存后添加是有反应的，旧逻辑会就此停手
  const retry = [...okCats].filter(c => {
    const cat = categoryById(c);
    return cat && cat.multiple && !cat.custom;
  });
  // 一轮只能保存一张卡的站点（先保存才能再添加）：资料有几段就做几轮。
  // 停止条件 = 资料里的段数都处理完（下一轮没有剩下的就什么也不做），或者某一轮一张都没保存成功。
  // 上限按资料总段数 + 2 算（只防站点异常时死循环），不是写死的轮数——18 段实习就能跑 18 轮。
  const depth = options.retryDepth || 0;
  const totalRecords = CATEGORIES.filter(c => c.multiple && !c.custom).reduce(
    (n, c) => n + ((inputProfile && inputProfile[c.id]) || []).filter(r => r && typeof r === 'object' && Object.entries(r).some(([k, v]) => !k.startsWith('__') && v != null && typeof v !== 'object' && String(v).trim())).length,
    0
  );
  if (retry.length && depth < totalRecords + 2 && !appeared) {
    try {
      await sleep(300);
      const next = await fillPage(inputProfile, { ...options, round: round + 1, retryDepth: depth + 1, onlyCategories: retry });
      if (next && !next.error) {
        results.push(...(next.results || []).filter(r => r.reason !== 'custom-no-match'));
        expand = {
          ...expand,
          added: (expand.added || 0) + ((next.repeat && next.repeat.added) || 0),
          log: [...(expand.log || []), ...((next.repeat && next.repeat.log) || []).map(l => `第 ${round + 2} 轮 · ${l}`)],
        };
      }
    } catch (_) {}
  }
  // 收尾核对（只在最外层做一次）：资料里的段数是否都已保存在网页上，没填完就在报告顶部写清楚还差几段
  if (!round) {
    try {
      const finalModel = buildFormModel(options.root && options.root.isConnected ? options.root : undefined);
      const sv = withoutSavedRecords(deriveProfile(inputProfile || {}), finalModel, STRONG_KEYS);
      const savedBy = {};
      for (const x of sv.saved) savedBy[x.categoryId] = (savedBy[x.categoryId] || 0) + 1;
      for (const c of CATEGORIES) {
        if (!c.multiple || c.custom || !savedBy[c.id]) continue; // 只核对"这页确实是卡片式、存过卡"的分类
        const want = ((inputProfile && inputProfile[c.id]) || []).filter(r => r && typeof r === 'object' && Object.entries(r).some(([k, v]) => !k.startsWith('__') && v != null && typeof v !== 'object' && String(v).trim())).length;
        if (savedBy[c.id] < want) {
          const blocked = results.filter(r => r.reason === 'card-commit-blocked' && r.categoryId === c.id).map(r => r.note).filter(Boolean);
          results.unshift({
            section: c.name,
            categoryId: c.id,
            label: `${c.name}：资料 ${want} 段，网页上已保存 ${savedBy[c.id]} 段，还差 ${want - savedBy[c.id]} 段`,
            value: '',
            status: 'failed',
            reason: 'cards-incomplete',
            note: blocked[0] || '某一轮一张卡都没保存成功，插件停下了',
          });
        }
      }
    } catch (_) {}
  }
  progress({ stage: 'done', text: '填写完成' });
  // AI 没开时也告诉调用方"有几处本可以交给 AI"——侧边栏据此提示去开启
  const aiHint = typeof options.aiClient === 'function' ? null : results.filter(r => r.reason === 'label-uncertain' || r.reason === 'option-no-match').length;
  if (round > 0) return { ...summarize(results, model, expand), ai: aiStat, aiOff: aiHint };
  return { ...summarize(withCustomDiagnostics(profile, model, results), model, expand), ai: aiStat, aiOff: aiHint };
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
