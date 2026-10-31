// 单选组适配器：性别走的就是这条路径（原生 click + 显式回读），抽成标准契约
import { clickEl, shortText, cssEsc, sleep, isVisible } from '../util.js';
import { matchOption, sameOption } from '../resolver.js';

function optionLabelOf(input, root) {
  const lab =
    input.closest('label') ||
    (input.id && root.querySelector(`label[for="${cssEsc(input.id)}"]`)) ||
    input.parentElement;
  return shortText(lab, 40);
}

export function collectRadioOptions(field) {
  const root = field.container || field.el.parentElement;
  if (!root) return [];
  const natives = [...root.querySelectorAll('input[type="radio"]')];
  if (natives.length) {
    return natives
      .map(input => ({ label: optionLabelOf(input, root), value: input.value, el: input, native: true }))
      .filter(o => o.label);
  }

  // 自绘单选：role=radio，或 class 带 radio 的最内层节点（北森 bx-radio 这类没有 role 的情况）
  const SEL = '[role="radio"],[class*="radio"],[class*="Radio"]';
  let fakes = [...root.querySelectorAll(SEL)]
    .filter(isVisible)
    .filter(el => !el.querySelector(SEL));
  if (!fakes.length) fakes = [...root.querySelectorAll('[role="radio"]')].filter(isVisible);

  const out = [];
  const seen = new Set();
  for (const el of fakes) {
    const label = shortText(el, 20).replace(/\s+/g, '');
    if (!label || label.length > 10) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, value: null, el, native: false });
  }
  return out;
}

export async function writeRadio(plan) {
  const field = plan.field;
  const options = collectRadioOptions(field);
  if (!options.length) return { status: 'skipped', reason: 'no-radio-options' };

  const m = matchOption(plan.resolved, options);
  if (!m.ok) {
    return {
      status: 'skipped',
      reason: m.reason,
      available: options.map(o => o.label).slice(0, 20),
    };
  }

  const root = field.container || field.el.parentElement;
  const target = m.option.el;
  // 组件库（antd / Element / iView）的单选：界面上的选中样式由框架状态决定，挂在外层 wrapper 的 class 上。
  // 只看原生 input.checked 会被骗：原生勾上了、框架没收到 → 下一次重绘就被清掉（真机 tupu360「性别」）。
  const wrapperOf = el => (el && el.closest && el.closest('[class*="radio-wrapper"],[class*="radio__"],label[class*="radio"],[class*="el-radio"],[class*="ivu-radio-wrapper"]')) || null;
  const committed = () => {
    const c = m.option.native ? target : null;
    const w = wrapperOf(target);
    if (w && /radio/i.test(String(w.className || ''))) return /checked|is-checked|active/i.test(String(w.className || ''));
    if (c) return !!c.checked;
    return target.getAttribute && target.getAttribute('aria-checked') === 'true';
  };
  const attempts = [];
  const tryClick = async (el, tag) => {
    if (!el) return false;
    clickEl(el);
    await sleep(120);
    if (!committed() && typeof el.click === 'function') {
      el.click();
      await sleep(120);
    }
    const ok = committed();
    attempts.push(tag + ':' + (ok ? 'ok' : 'fail'));
    return ok;
  };
  const wrap = wrapperOf(target);
  let ok =
    (await tryClick(target, 'input')) ||
    (await tryClick(wrap, 'wrapper')) ||
    (await tryClick(target.parentElement !== wrap ? target.parentElement : null, 'inner'));
  // 站点可能稍后重绘：隔一会儿再确认一次，被清掉就再点一次外层
  if (ok) {
    await sleep(400);
    if (!committed()) {
      attempts.push('cleared');
      ok = await tryClick(wrap || target, 'retry');
    }
  }
  let checked = root.querySelector('input[type="radio"]:checked');
  if (!ok) {
    return { status: 'failed', reason: 'radio-not-committed', expected: m.option.label, attempts };
  }

  let readback = '';
  if (checked) readback = optionLabelOf(checked, root);
  if (!readback) {
    const fake = [...root.querySelectorAll('[role="radio"][aria-checked="true"], [class*="is-checked"], [class*="checked"]')].find(
      el => shortText(el, 40)
    );
    if (fake) readback = shortText(fake, 40);
  }

  // 回读为空但点击确实发生了，按"低置信"处理，不谎报成功
  if (!readback) return { status: 'filled', via: 'click', readback: '', lowConfidence: true, attempts };
  return sameOption(readback, m.option.label)
    ? { status: 'filled', via: 'click', readback, attempts }
    : { status: 'failed', reason: 'readback-mismatch', readback, expected: m.option.label, attempts };
}
