// 值解析：自由文本 → canonical 代号 + 同义词组，以及"选项匹配"的统一打分
// 约束：任何一步不确定都不许猜 —— 交给调用方跳过（用户明确要求：无法匹配自动跳过）

import { ENUMS } from './schema.js';
import { normalize, charDice } from './util.js';

/** 匹配阈值：低于它一律视为"无法匹配"，不写入 */
export const OPTION_MIN_SCORE = 0.82;
/** 第一名与第二名的最小差距，不够就判歧义 */
export const OPTION_MIN_MARGIN = 0.05;

const PLACEHOLDER_RE = /^(请选择|请选择一项|全部|不限|--+|—+|-+|无数据|暂无)$/;

/**
 * 把资料库里的自由文本解析成 {code, labels, confidence}
 * labels 是"候选写法集合"：canonical 的全部同义词 + 用户原文
 */
export function resolveValue(raw, enumRef) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const n = normalize(text);
  const dict = enumRef ? ENUMS[enumRef] : null;
  const labels = [text];
  let code = null;
  let confidence = 0.6;

  if (dict) {
    // ① 精确命中某个同义词
    for (const [c, syns] of Object.entries(dict)) {
      if (syns.some(s => normalize(s) === n)) {
        code = c;
        labels.push(...syns);
        confidence = 1;
        break;
      }
    }
    // ② 双向包含 / 字符相似（1 字同义词不参与模糊，避免 m/f 之类误命中）
    if (!code) {
      let best = null;
      for (const [c, syns] of Object.entries(dict)) {
        for (const s of syns) {
          const sn = normalize(s);
          if (!sn || [...sn].length < 2) continue;
          let sc = 0;
          if (n.includes(sn) || sn.includes(n)) {
            const ratio = Math.min(sn.length, n.length) / Math.max(sn.length, n.length);
            sc = 0.88 + 0.1 * ratio;
          } else {
            const d = charDice(n, sn);
            if (d >= 0.6) sc = d * 0.85;
          }
          if (sc > 0 && (!best || sc > best.sc)) best = { c, syns, sc };
        }
      }
      if (best && best.sc >= 0.8) {
        code = best.c;
        labels.push(...best.syns);
        confidence = best.sc;
      }
    }
  }

  return { code, labels: [...new Set(labels)], raw: text, confidence };
}

/**
 * 在网页真实选项里匹配目标值。
 * 返回 { ok, option, score, reason, ranked }
 * ok=false 时调用方必须跳过，不允许"退而求其次"
 */
export function matchOption(plan, options) {
  if (!plan) return { ok: false, reason: 'no-value', ranked: [] };
  const labels = (plan.labels || []).map(normalize).filter(Boolean);
  const rawN = normalize(plan.raw || '');
  const pool = (options || []).filter(o => {
    const t = normalize(o.label);
    return t && !PLACEHOLDER_RE.test(t);
  });
  if (!pool.length) return { ok: false, reason: 'no-options', ranked: [] };

  const scored = pool.map(o => {
    const ot = normalize(o.label);
    const ov = normalize(o.value == null ? '' : String(o.value));
    let score = 0;
    for (const lb of labels) {
      if (!lb) continue;
      let s = 0;
      if (ot === lb) s = 1;
      else if (ot.includes(lb) && lb.length >= 2) {
        s = 0.9 + 0.08 * (lb.length / Math.max(ot.length, lb.length));
      } else if (lb.includes(ot) && ot.length >= 2) {
        s = 0.88 + 0.08 * (ot.length / Math.max(ot.length, lb.length));
      } else {
        const d = charDice(ot, lb);
        if (d >= 0.62) s = d * 0.85;
      }
      if (s > score) score = s;
    }
    // 有些站点的 option 文本是编号，真实值才是可读文本
    if (ov && ov === rawN) score = Math.max(score, 0.95);
    return { ...o, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // 精确命中优先：选项文本**完全等于**某个别名时，它就是这个值，不需要再比"分差"。
  //
  // 真机（用户截图）「学位」下拉的选项是：无 / 学士 / 双学士 / 硕士 / 博士 / 双硕士 / MBA / EMBA。
  // "硕士"精确命中得 1.0，"双硕士"因为**包含**"硕士"得 0.9533，差值 0.0467 < 0.05 的
  // 歧义阈值 → 被判成"多个选项都可能，未敢选" → 学位永远填不上。
  // 而「学历」的选项是 大专/本科/硕士研究生/博士，没有别的选项包含"硕士研究生"，
  // 所以学历能填、学位不能填 —— 用户看到的正是这个反差。
  const exacts = scored.filter(o => {
    const ot = normalize(o.label);
    return labels.includes(ot) || (rawN && ot === rawN);
  });
  if (exacts.length === 1) {
    return { ok: true, option: exacts[0], score: 1, ranked: scored.slice(0, 5) };
  }

  const top = scored[0];
  const second = scored[1];

  if (!top || top.score < OPTION_MIN_SCORE) {
    return { ok: false, reason: 'option-no-match', ranked: scored.slice(0, 5) };
  }
  if (
    second &&
    top.score - second.score < OPTION_MIN_MARGIN - 1e-6 &&
    normalize(second.label) !== normalize(top.label)
  ) {
    return { ok: false, reason: 'option-ambiguous', ranked: scored.slice(0, 5) };
  }
  return { ok: true, option: top, score: top.score, ranked: scored.slice(0, 5) };
}

/** 写入后的反向校验：读回的文本是否就是刚才选的那一项 */
export function sameOption(readback, optionLabel) {
  const a = normalize(readback);
  const b = normalize(optionLabel);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
