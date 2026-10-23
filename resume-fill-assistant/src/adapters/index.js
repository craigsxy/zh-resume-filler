// 适配器分派：先看"资料库这个字段是什么"（kind），再看"网页这个控件是什么"（controlKind）
// 两者交叉决定走哪条写入路径，这就是"先判断填写/选择，再适配"的落点
import { writeText } from './text.js';
import { writeRadio } from './radio.js';
import { writeSelectNative, writeSelectCustom } from './select.js';
import { writeDate } from './date.js';
import { writeUpload } from './upload.js';

export async function writeField(plan, deps) {
  const field = plan.field;
  if (!field || !field.el) return { status: 'failed', reason: 'no-el' };
  const ck = field.controlKind || 'TEXT';
  const kind = plan.kind;

  if (kind === 'upload' || ck === 'UPLOAD') return writeUpload(plan);
  if (ck === 'CHECKBOX_GROUP') return { status: 'skipped', reason: 'checkbox-unsupported' };
  // 省市区级联（cascader）需要逐级选择，当前未实现 → 明确跳过，不硬填
  if (ck === 'CASCADER') return { status: 'skipped', reason: 'cascader-unsupported' };

  // 资料库认定是日期字段才走日期链路
  if (kind === 'date') return writeDate(plan, deps);

  // 反过来：非日期字段落到了日期控件上（如"籍贯"是两级下拉被误判），
  // 一律不当日期写，按选择类处理或直接跳过，避免把年份写进无关控件
  if (ck === 'DATE_TRIPLE_SELECT') return { status: 'skipped', reason: 'control-kind-mismatch' };
  if (ck === 'DATE_CUSTOM' || ck === 'DATE_NATIVE_DAY' || ck === 'DATE_NATIVE_MONTH') {
    return writeSelectCustom(plan);
  }

  if (ck === 'RADIO_GROUP') return writeRadio(plan);
  if (ck === 'SELECT_NATIVE') return writeSelectNative(plan);
  if (ck === 'SELECT_CUSTOM' || ck === 'PICKER') return writeSelectCustom(plan);

  return writeText(plan);
}
