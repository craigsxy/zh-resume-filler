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

  clickEl(m.option.el);
  await sleep(90);

  const root = field.container || field.el.parentElement;
  let checked = root.querySelector('input[type="radio"]:checked');
  // 合成事件未被激活时，用原生 click() 再试一次（对单选是幂等操作）
  if (!checked && m.option.native && typeof m.option.el.click === 'function') {
    m.option.el.click();
    await sleep(70);
    checked = root.querySelector('input[type="radio"]:checked');
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
  if (!readback) return { status: 'filled', via: 'click', readback: '', lowConfidence: true };
  return sameOption(readback, m.option.label)
    ? { status: 'filled', via: 'click', readback }
    : { status: 'failed', reason: 'readback-mismatch', readback, expected: m.option.label };
}
