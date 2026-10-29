// 文本类适配器：text / textarea / number / 富文本
import { fire, setNativeValue, normalize, numericOf, sleep } from '../util.js';
import { primaryValue } from '../resolver.js';

const isNumeric = s => /^-?\d+(\.\d+)?$/.test(String(s ?? '').trim());
const trimZeros = s =>
  String(s ?? '')
    .trim()
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');

/**
 * 站点把 "6.5" 改写成 "6.50000"（按固定小数位格式化）。
 * 用户要求严格按输入内容，所以这种情况要识别出来并尝试盖回去。
 */
function paddedZeros(got, want) {
  const a = String(got ?? '').trim();
  const b = String(want ?? '').trim();
  if (!a || !b || a === b) return false;
  if (!isNumeric(a) || !isNumeric(b)) return false;
  return trimZeros(a) === trimZeros(b) && Number(a) === Number(b);
}

export async function writeText(plan) {
  const { field } = plan;
  const el = field.el;
  if (!el) return { status: 'failed', reason: 'no-el' };

  let value = primaryValue(plan.value ?? '');
  if (plan.kind === 'number') value = numericOf(value) || value;
  if (!value.trim()) return { status: 'skipped', reason: 'empty-value' };

  if (field.controlKind === 'RICH_TEXT') {
    el.focus();
    el.textContent = value;
    fire(el, 'input', { bubbles: true });
    fire(el, 'change', { bubbles: true });
    await sleep(60);
    const rb = String(el.textContent || '').trim();
    return rb === value
      ? { status: 'filled', via: 'richtext', readback: rb }
      : { status: 'failed', reason: 'readback-mismatch', readback: rb };
  }

  try {
    el.focus();
  } catch (_) {}
  setNativeValue(el, value);
  fire(el, 'input', { bubbles: true });
  await sleep(40);
  let rb = String(el.value ?? '').trim();

  // 只在"值没进去"时才补发 change/blur。
  // 原来无条件 fire blur，而站点的"补零/格式化"往往就挂在 blur/change 上 ——
  // 是我们自己把 6.5 触成了 6.50000。
  if (normalize(rb) !== normalize(value)) {
    fire(el, 'change', { bubbles: true });
    await sleep(30);
    rb = String(el.value ?? '').trim();
  }

  // 还是被补零了（站点在 input 阶段就格式化）：把原值盖回去，且不再触发 blur
  let note;
  if (paddedZeros(rb, value)) {
    setNativeValue(el, value);
    fire(el, 'input', { bubbles: true });
    await sleep(40);
    rb = String(el.value ?? '').trim();
    if (paddedZeros(rb, value)) note = 'site-padded'; // 站点坚持格式化，值本身一致
  }

  let ok = normalize(rb) === normalize(value) || (rb && normalize(rb).includes(normalize(value)));
  if (!ok) {
    // 兜底：有的站点必须 blur 才提交
    fire(el, 'blur', { bubbles: false });
    await sleep(120);
    rb = String(el.value ?? '').trim();
    if (paddedZeros(rb, value)) note = 'site-padded';
    ok = normalize(rb) === normalize(value) || (rb && normalize(rb).includes(normalize(value)));
  }
  return ok
    ? { status: 'filled', via: 'native', readback: rb, ...(note ? { note } : {}) }
    : { status: 'failed', reason: 'readback-mismatch', readback: rb, expected: value };
}
