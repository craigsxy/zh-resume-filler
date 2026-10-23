// 纯逻辑自测（不依赖浏览器）：字段槽、枚举解析、选项匹配、日期解析
// 运行：node scripts/selftest.mjs

import { CATEGORIES, FIELD_BY_SLOT, ENUMS, categoryById } from '../src/schema.js';
import { matchSlot } from '../src/binder.js';
import { resolveValue, matchOption } from '../src/resolver.js';
import { parseTarget, parseReadback, toISO, rawPrecision, coarserPrecision } from '../src/adapters/date.js';

let pass = 0;
let fail = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

function candidatesOf(categoryId) {
  const c = categoryById(categoryId);
  return c.fields.map(f => ({ field: f, category: c }));
}

function slotOf(categoryId, parts) {
  const m = matchSlot(parts, candidatesOf(categoryId));
  return m ? m.field.slot : null;
}

console.log('\n[1] schema 完整性');
{
  const slots = new Set();
  let dup = null;
  for (const c of CATEGORIES) for (const f of c.fields) {
    if (slots.has(f.slot)) dup = f.slot;
    slots.add(f.slot);
  }
  ok('槽名全局唯一', !dup, dup || '');
  ok('字段都带 alias', CATEGORIES.every(c => c.fields.every(f => f.alias && f.alias.length)));
  const noEnum = CATEGORIES.flatMap(c => c.fields).filter(f => f.kind === 'enum' && !ENUMS[f.enumRef]);
  ok('枚举字段都有字典', noEnum.length === 0, noEnum.map(f => f.label).join(','));
  ok('FIELD_BY_SLOT 已建立', FIELD_BY_SLOT.get('edu.start') !== undefined);
}

console.log('\n[2] 同名异义：开始/结束时间');
{
  ok('教育：开始时间 → edu.start', slotOf('education', ['开始时间']) === 'edu.start', String(slotOf('education', ['开始时间'])));
  ok('教育：结束时间 → edu.end', slotOf('education', ['结束时间']) === 'edu.end', String(slotOf('education', ['结束时间'])));
  ok('实习：开始时间 → exp.start', slotOf('internships', ['开始时间']) === 'exp.start', String(slotOf('internships', ['开始时间'])));
  ok('实习：结束时间 → exp.end', slotOf('internships', ['结束时间']) === 'exp.end', String(slotOf('internships', ['结束时间'])));
  ok('教育：毕业时间 → edu.end', slotOf('education', ['毕业时间']) === 'edu.end', String(slotOf('education', ['毕业时间'])));
  ok('教育：入学时间 → edu.start', slotOf('education', ['入学时间']) === 'edu.start', String(slotOf('education', ['入学时间'])));
  ok('在校职务：结束时间 → pos.end', slotOf('positions', ['结束时间']) === 'pos.end', String(slotOf('positions', ['结束时间'])));
}

console.log('\n[3] 形近字段区分');
{
  ok('学历 → degreeLevel', slotOf('education', ['学历']) === 'edu.degreeLevel', String(slotOf('education', ['学历'])));
  ok('学位 → degreeName', slotOf('education', ['学位']) === 'edu.degreeName', String(slotOf('education', ['学位'])));
  ok('专业 → edu.major', slotOf('education', ['专业']) === 'edu.major', String(slotOf('education', ['专业'])));
  ok('专业人数 → classSize', slotOf('education', ['专业人数']) === 'edu.classSize', String(slotOf('education', ['专业人数'])));
  ok('姓名（个人信息内）→ personal.name', slotOf('personal', ['姓名']) === 'personal.name', String(slotOf('personal', ['姓名'])));
  ok('姓名（家庭内）→ family.name', slotOf('family', ['姓名']) === 'family.name', String(slotOf('family', ['姓名'])));
  ok('紧急联系人姓名 → emergencyContact', slotOf('personal', ['紧急联系人姓名']) === 'personal.emergencyContact', String(slotOf('personal', ['紧急联系人姓名'])));
  ok('带占位噪音的标签可归一', slotOf('education', ['请输入学校名称']) === 'edu.school', String(slotOf('education', ['请输入学校名称'])));
}

console.log('\n[4] 枚举值解析');
{
  const cases = [
    ['本科', 'degreeLevel', 'BACHELOR'],
    ['大学本科', 'degreeLevel', 'BACHELOR'],
    ['全日制本科', 'degreeLevel', 'BACHELOR'],
    ['硕士', 'degreeLevel', 'MASTER'],
    ['大专', 'degreeLevel', 'ASSOCIATE'],
    ['学士', 'degreeName', 'BACHELOR'],
    ['女', 'gender', 'F'],
    ['男', 'gender', 'M'],
    ['群众', 'politics', 'MASS'],
    ['共青团员', 'politics', 'LEAGUE'],
    ['中共党员', 'politics', 'PARTY'],
    ['预备党员', 'politics', 'PREP'],
    ['满族', 'ethnicity', '满'],
    ['汉族', 'ethnicity', '汉'],
    ['身份证', 'idType', 'ID_CARD'],
    ['全职', 'jobType', 'FULL'],
    ['国家级', 'awardLevel', 'NATIONAL'],
    ['雅思', 'certType', 'IELTS'],
    ['大学英语六级', 'certType', 'CET6'],
  ];
  let bad = [];
  for (const [text, ref, code] of cases) {
    const r = resolveValue(text, ref);
    if (!r || r.code !== code) bad.push(`${text}→${r && r.code}(期望${code})`);
  }
  ok(`${cases.length} 个枚举值全部解析正确`, bad.length === 0, bad.join(' | '));
  const unknown = resolveValue('某某奇怪的东西', 'degreeLevel');
  ok('未知值不硬猜（code 为空，保留原文）', unknown && unknown.code === null && unknown.labels.includes('某某奇怪的东西'));
}

console.log('\n[5] 选项匹配 + 自动跳过规则');
{
  const genderOpts = [
    { label: '男', value: 'M' },
    { label: '女', value: 'F' },
  ];
  ok('性别：女 命中', matchOption(resolveValue('女', 'gender'), genderOpts).option?.label === '女');

  const degreeOpts = [
    { label: '请选择', value: '' },
    { label: '博士', value: '4' },
    { label: '硕士', value: '3' },
    { label: '本科', value: '2' },
    { label: '大专', value: '1' },
  ];
  ok('学历：本科 命中选项', matchOption(resolveValue('大学本科', 'degreeLevel'), degreeOpts).option?.label === '本科');

  const noMatch = matchOption(resolveValue('高中', 'degreeLevel'), [
    { label: '博士', value: '4' },
    { label: '硕士', value: '3' },
  ]);
  ok('无匹配 → ok=false（触发自动跳过）', noMatch.ok === false, JSON.stringify(noMatch.reason));
  ok('无匹配原因 = option-no-match', noMatch.reason === 'option-no-match');

  const ambiguous = matchOption({ labels: ['本科'], raw: '本科' }, [
    { label: '本科（全日制）', value: 'a' },
    { label: '本科（非全日制）', value: 'b' },
  ]);
  ok('两项同分 → 判歧义不填', ambiguous.ok === false && ambiguous.reason === 'option-ambiguous', JSON.stringify(ambiguous));

  const exactWin = matchOption({ labels: ['本科', '大学本科'], raw: '本科' }, [
    { label: '本科', value: 'a' },
    { label: '硕士', value: 'b' },
  ]);
  ok('精确命中 → 直接选', exactWin.ok === true && exactWin.option.label === '本科');

  const placeholder = matchOption({ labels: ['请选择'], raw: '请选择' }, [{ label: '请选择', value: '' }]);
  ok('占位项不算有效选项', placeholder.ok === false);
}

console.log('\n[6] 日期解析与精度');
{
  const a = parseTarget('2021-08-15', 'month');
  ok('YYYY-MM-DD → 解析', a && a.y === 2021 && a.m === 8 && a.d === 15);
  ok('month 精度输出 YYYY-MM', toISO(a, 'month') === '2021-08');
  ok('day 精度输出完整日期', toISO(a, 'day') === '2021-08-15');
  const b = parseTarget('2021-08', 'month');
  ok('YYYY-MM 也能解析（v1 数据兼容）', b && b.y === 2021 && b.m === 8 && b.d === 1);
  const c = parseTarget('2026年10月', 'month');
  ok('中文年月可解析', c && c.y === 2026 && c.m === 10);
  ok('非法值返回 null', parseTarget('abc') === null);
  const rb1 = parseReadback('2021-08');
  ok('回读 YYYY-MM → 月精度可比', rb1 && rb1.y === 2021 && rb1.m === 8 && rb1.d === null);
  const rb2 = parseReadback('2021年9月');
  ok('回读中文年月可比', rb2 && rb2.y === 2021 && rb2.m === 9);
  const rb3 = parseReadback('2021-08-01');
  ok('回读完整日期可比', rb3 && rb3.d === 1);
}

console.log('\n[7] 精度降级 + 最高学历');
{
  ok('教育开始时间声明为日粒度', FIELD_BY_SLOT.get('edu.start').field.precision === 'day', FIELD_BY_SLOT.get('edu.start').field.precision);
  ok('实习开始时间声明为日粒度', FIELD_BY_SLOT.get('exp.start').field.precision === 'day');
  const dateFields = CATEGORIES.flatMap(c => c.fields).filter(f => f.kind === 'date');
  ok(
    '所有日期字段都是日粒度（与"出生日期"完全同一种处理，不再有月粒度字段）',
    dateFields.length >= 10 && dateFields.every(f => f.precision === 'day'),
    dateFields.filter(f => f.precision !== 'day').map(f => f.slot).join(',')
  );

  ok('资料值 YYYY-MM-DD 的精度是 day', rawPrecision('2021-08-15') === 'day');
  ok('资料值 YYYY-MM 的精度是 month（v1 老数据）', rawPrecision('2021-08') === 'month');
  ok('资料值 YYYY 的精度是 year', rawPrecision('2021') === 'year');
  ok('中文年月也是 month', rawPrecision('2021年8月') === 'month');

  ok('min(day, month) = month（日资料 → 月控件降级）', coarserPrecision('day', 'month') === 'month');
  ok('min(day, day) = day', coarserPrecision('day', 'day') === 'day');
  ok('min(month, day) = month（老资料塞不进日控件就按月校验）', coarserPrecision('month', 'day') === 'month');
  ok('min(year, day) = year', coarserPrecision('year', 'day') === 'year');

  ok('最高学历 → personal.highestDegree', slotOf('personal', ['最高学历']) === 'personal.highestDegree', String(slotOf('personal', ['最高学历'])));
  ok('反别名生效：个人信息区的"学历"不会被"最高学历"抢走', slotOf('personal', ['学历']) === null, String(slotOf('personal', ['学历'])));
  ok(
    '教育经历区写"最高学历"仍然落到 edu.degreeLevel',
    slotOf('education', ['最高学历']) === 'edu.degreeLevel',
    String(slotOf('education', ['最高学历']))
  );
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
