// DOM 仿真集成测试：扫描 → 建块 → 绑定（含强键对齐）
// 运行：node scripts/dom-test.mjs

import { JSDOM } from 'jsdom';
import { buildFormModel } from '../src/form-model.js';
import { bind } from '../src/binder.js';
import { fillPage } from '../src/fill.js';
import { defaultProfile } from '../src/schema.js';

const HTML = `<!doctype html><html><body><form>
  <div class="card">
    <div class="section-title">个人信息</div>
    <div class="form-item"><label class="form-label">姓名</label><input name="name"></div>
    <div class="form-item"><label class="form-label">性别</label>
      <label class="radio"><input type="radio" name="gender" value="1">男</label>
      <label class="radio"><input type="radio" name="gender" value="2">女</label>
    </div>
    <div class="form-item"><label class="form-label">学历</label>
      <select name="degree"><option value="">请选择</option><option value="1">大专</option><option value="2">本科</option><option value="3">硕士</option></select>
    </div>
  </div>

  <div class="card">
    <div class="section-title">教育经历</div>
    <div class="repeater">
      <div class="form-item"><label class="form-label">开始时间</label><input class="date" readonly placeholder="请选择"></div>
      <div class="form-item"><label class="form-label">结束时间</label><input class="date" readonly placeholder="请选择"></div>
      <div class="form-item"><label class="form-label">学校名称</label><input name="school"></div>
    </div>
    <div class="repeater">
      <div class="form-item"><label class="form-label">开始时间</label><input class="date" readonly placeholder="请选择"></div>
      <div class="form-item"><label class="form-label">结束时间</label><input class="date" readonly placeholder="请选择"></div>
      <div class="form-item"><label class="form-label">学校名称</label><input name="school"></div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">实习经历</div>
    <div class="repeater">
      <div class="form-item"><label class="form-label">开始时间</label><input name="expStart" placeholder="请选择"></div>
      <div class="form-item"><label class="form-label">结束时间</label><input class="date" readonly placeholder="请选择"></div>
      <div class="form-item"><label class="form-label">单位名称</label><input name="company"></div>
    </div>
  </div>
</form></body></html>`;

const dom = new JSDOM(HTML, { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.Node = dom.window.Node;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.CSS = dom.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.MouseEvent = dom.window.MouseEvent;

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra || ''}`);
  }
};

const model = buildFormModel(document.body);

console.log('\n[1] 表单地图');
{
  const titles = model.sections.map(s => s.title);
  ok('识别出 3 个区块', model.sections.length === 3, JSON.stringify(titles));
  ok('区块标题正确', titles.join(',') === '个人信息,教育经历,实习经历', titles.join(','));
  const edu = model.sections.find(s => s.title === '教育经历');
  ok('教育经历识别出 2 个重复块', edu.blocks.length === 2, String(edu.blocks.length));
  ok('每块 3 个字段', edu.blocks[0].fields.length === 3, String(edu.blocks[0].fields.length));
  const personal = model.sections.find(s => s.title === '个人信息');
  ok('个人信息只有 1 块', personal.blocks.length === 1);
  const kinds = personal.blocks[0].fields.map(f => f.controlKind);
  ok('性别识别为 RADIO_GROUP', kinds.includes('RADIO_GROUP'), kinds.join(','));
  ok('学历识别为 SELECT_NATIVE', kinds.includes('SELECT_NATIVE'), kinds.join(','));
  const dateField = edu.blocks[0].fields.find(f => f.label === '开始时间');
  ok('只读日期框识别为 DATE_CUSTOM', dateField.controlKind === 'DATE_CUSTOM', dateField.controlKind);
}

const profile = defaultProfile();
profile.personal = [{ 姓名: '倪睿', 性别: '女', 学历: '大学本科' }];
profile.education = [
  { 开始时间: '2021-08-15', 结束时间: '2025-06-30', 学校名称: '天津大学', 学历: '本科' },
  { 开始时间: '2025-09-01', 结束时间: '2026-10-01', 学校名称: '香港城市大学', 学历: '硕士' },
];
profile.internships = [{ 开始时间: '2025-11-10', 结束时间: '2026-06-30', 单位名称: '腾讯' }];

console.log('\n[2] 绑定：同名异义消歧');
{
  const plans = bind(model, profile);
  const eduPlans = plans.filter(p => p.categoryId === 'education');
  const eduStart0 = eduPlans.find(p => p.label === '开始时间' && p.blockIndex === 0);
  const eduStart1 = eduPlans.find(p => p.label === '开始时间' && p.blockIndex === 1);
  ok('教育块1 开始时间 → edu.start', eduStart0.slot === 'edu.start');
  ok('教育块1 开始时间取记录1的值', eduStart0.value === '2021-08-15', eduStart0.value);
  ok('教育块2 开始时间取记录2的值', eduStart1.value === '2025-09-01', eduStart1.value);

  const expStart = plans.find(p => p.slot === 'exp.start');
  ok('实习块 开始时间 → exp.start', expStart.slot === 'exp.start');
  ok('实习块 取实习记录的值', expStart.value === '2025-11-10', expStart.value);

  const names = plans.filter(p => p.slot === 'personal.name');
  ok('个人信息姓名只对应 personal.name', names.length === 1 && names[0].value === '倪睿', JSON.stringify(names.map(n => n.value)));
}

console.log('\n[3] 强键对齐：网页区块顺序与资料库相反');
{
  // 把网页两个教育块的学校名称预先填成反序
  const edu = model.sections.find(s => s.title === '教育经历');
  const schoolInputs = edu.blocks.map(b => b.fields.find(f => f.label === '学校名称').el);
  schoolInputs[0].value = '香港城市大学';
  schoolInputs[1].value = '天津大学';

  const plans = bind(model, profile);
  const start0 = plans.find(p => p.slot === 'edu.start' && p.blockIndex === 0);
  const start1 = plans.find(p => p.slot === 'edu.start' && p.blockIndex === 1);
  ok('块1 按学校名匹配到香港城市大学那条', start0.value === '2025-09-01', start0.value);
  ok('块2 按学校名匹配到天津大学那条', start1.value === '2021-08-15', start1.value);
}

console.log('\n[4] 实际写入（无桥、无面板时的降级行为）');
{
  const fakeBridge = {
    setModelValue: async () => ({ ok: false, reason: 'no-bridge' }),
    readModel: async () => ({ ok: false }),
  };
  const report = await fillPage(profile, { bridge: fakeBridge });
  const bySlot = slot => report.results.filter(r => r.slot === slot);

  const name = bySlot('personal.name')[0];
  ok('姓名写入成功', name && name.status === 'filled', JSON.stringify(name));
  ok('姓名真的写进 DOM', document.querySelector('input[name="name"]').value === '倪睿');

  const gender = bySlot('personal.gender')[0];
  ok('性别点选成功', gender && gender.status === 'filled', JSON.stringify(gender));
  ok('性别真的选中「女」', document.querySelector('input[name="gender"][value="2"]').checked === true);

  const degree = bySlot('edu.degreeLevel')[0];
  ok('学历下拉命中「本科」', degree && degree.status === 'filled' && degree.readback === '本科', JSON.stringify(degree));
  ok('学历真的写进 select', document.querySelector('select[name="degree"]').value === '2');

  const expStart = bySlot('exp.start')[0];
  ok('可输入的日期框走"键入"路径成功', expStart && expStart.status === 'filled', JSON.stringify(expStart));
  ok(
    '实习开始时间是日粒度 → 写入完整 YYYY-MM-DD',
    document.querySelector('input[name="expStart"]').value === '2025-11-10',
    document.querySelector('input[name="expStart"]').value
  );

  const eduStarts = bySlot('edu.start');
  ok('只读日期框无面板 → 全部跳过', eduStarts.length === 2 && eduStarts.every(r => r.status === 'skipped'), JSON.stringify(eduStarts.map(r => r.reason)));
  ok('跳过的字段没有被写脏值', eduStarts.every(r => r.readback === '' || r.readback == null));
  ok('只读日期框 DOM 值仍为空', document.querySelector('.repeater input.date').value === '');
}

console.log('\n[5] 回归：无标题区块（如"上传简历"）不得让整次填充崩溃');
{
  const html2 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">上传简历</div>
      <div class="form-item">
        <label class="form-label">上传简历</label>
        <input type="file" name="resumeFile">
        <span>支持 doc docx pdf，不超过 10M</span>
      </div>
    </div>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">姓名</label><input name="name2"></div>
      <div class="form-item"><label class="form-label">出生日期</label><input name="birth" type="date"></div>
    </div>
  </form></body></html>`;
  const dom2 = new JSDOM(html2, { pretendToBeVisual: true });
  global.window = dom2.window;
  global.document = dom2.window.document;
  global.getComputedStyle = dom2.window.getComputedStyle.bind(dom2.window);
  global.HTMLInputElement = dom2.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom2.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom2.window.HTMLSelectElement;

  const model2 = buildFormModel(document.body);
  ok('扫描不抛异常', Array.isArray(model2.sections) && model2.sections.length === 2, String(model2.sections.length));

  let threw = null;
  let plans2 = [];
  try {
    plans2 = bind(model2, profile);
  } catch (e) {
    threw = String((e && e.message) || e);
  }
  ok('绑定不抛异常（原 section.fields is not iterable）', threw === null, threw || '');

  const uploadPlan = plans2.find(p => p.field && p.field.controlKind === 'UPLOAD');
  ok('上传区块的字段被识别但槽为空 → 跳过', uploadPlan && uploadPlan.slot === null);

  const name2 = plans2.find(p => p.slot === 'personal.name');
  ok('同一页里的个人信息仍能正常绑定', name2 && name2.value === '倪睿', JSON.stringify(name2 && name2.value));

  const fakeBridge2 = {
    setModelValue: async () => ({ ok: false, reason: 'no-bridge' }),
    readModel: async () => ({ ok: false }),
  };
  const report2 = await fillPage(profile, { bridge: fakeBridge2 });
  ok('填充流程不中断（无 error 字段）', !report2.error, report2.error || '');
  ok('姓名被填上', document.querySelector('input[name="name2"]').value === '倪睿');
}

console.log('\n[6] 回归：直接挂在 body 下的隐藏控件不算表单字段');
{
  // 真机诊断里出现过一个 container=<body>、label 为空的 textarea，
  // 每轮都产生一条无意义的 label-uncertain，把注意力从真问题上带走
  const html3 = `<!doctype html><html><body>
    <form><div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">姓名</label><input name="name3"></div>
      <div class="form-item"><label class="form-label">手机</label><input name="mobile3"></div>
    </div></form>
    <textarea></textarea>
  </body></html>`;
  const dom3 = new JSDOM(html3, { pretendToBeVisual: true });
  global.window = dom3.window;
  global.document = dom3.window.document;
  global.getComputedStyle = dom3.window.getComputedStyle.bind(dom3.window);
  global.HTMLInputElement = dom3.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom3.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom3.window.HTMLSelectElement;

  const model3 = buildFormModel(document.body);
  const all3 = model3.sections.flatMap(s => s.blocks.flatMap(b => b.fields));
  ok('body 下的游离 textarea 没有被当成字段', all3.every(f => f.el.tagName !== 'TEXTAREA'), JSON.stringify(all3.map(f => f.label)));
  ok('字段数是 2（姓名 / 手机）', all3.length === 2, String(all3.length));
}

console.log('\n[7] 日粒度资料 → 月粒度网页自动降级（有的网申只看年月）');
{
  // 需求原文：教育经历/实习经历在插件里是日粒度，但要能适配网页的月粒度控件
  const html4 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-item"><label class="form-label">开始时间</label><input name="eduStartMonth" type="month"></div>
      <div class="form-item"><label class="form-label">结束时间</label><input name="eduEndText"></div>
      <div class="form-item"><label class="form-label">学校名称</label><input name="school4"></div>
    </div>
  </form></body></html>`;
  const dom4 = new JSDOM(html4, { pretendToBeVisual: true });
  global.window = dom4.window;
  global.document = dom4.window.document;
  global.getComputedStyle = dom4.window.getComputedStyle.bind(dom4.window);
  global.HTMLInputElement = dom4.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom4.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom4.window.HTMLSelectElement;

  const p4 = defaultProfile();
  // 开始时间：日粒度（新数据）／结束时间：只有年月（v1 老数据）
  p4.education = [{ 开始时间: '2021-08-15', 结束时间: '2025-06', 学校名称: '天津大学' }];

  const report4 = await fillPage(p4, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });

  const s4 = report4.results.find(r => r.slot === 'edu.start');
  ok('日粒度资料写进 type=month 控件判成功（不再 date-verify-failed）', s4 && s4.status === 'filled', JSON.stringify(s4 && { s: s4.status, r: s4.reason, a: s4.attempts }));
  ok(
    '按年月写入（2021-08，不是 2021-08-15）',
    document.querySelector('input[name="eduStartMonth"]').value === '2021-08',
    document.querySelector('input[name="eduStartMonth"]').value || '(空)'
  );
  ok('报告里标出"已降级到年月"', s4 && s4.downgraded === 'month', JSON.stringify(s4 && s4.downgraded));

  const e4 = report4.results.find(r => r.slot === 'edu.end');
  ok('只有年月的老数据照样填成功', e4 && e4.status === 'filled', JSON.stringify(e4 && { s: e4.status, r: e4.reason }));
  ok(
    '老数据不擅自补成 2025-06-01',
    document.querySelector('input[name="eduEndText"]').value === '2025-06',
    document.querySelector('input[name="eduEndText"]').value || '(空)'
  );
}

console.log('\n[8] 分类下的自定义字段：按用户填的字段名去对网页标签');
{
  const html5 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">姓名</label><input name="name5"></div>
      <div class="form-item"><label class="form-label">微信号</label><input name="wechat5"></div>
      <div class="form-item"><label class="form-label">个人主页</label><input name="gh5"></div>
      <div class="form-item"><label class="form-label">最高学历</label>
        <select name="degree5"><option value="">请选择</option><option value="1">本科</option><option value="2">硕士</option></select>
      </div>
    </div>
  </form></body></html>`;
  const dom5 = new JSDOM(html5, { pretendToBeVisual: true });
  global.window = dom5.window;
  global.document = dom5.window.document;
  global.getComputedStyle = dom5.window.getComputedStyle.bind(dom5.window);
  global.HTMLInputElement = dom5.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom5.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom5.window.HTMLSelectElement;

  const p5 = defaultProfile();
  p5.personal = [
    { 姓名: '倪睿', 最高学历: '硕士', __custom: [{ name: '微信号', value: 'nirui_pm' }] },
  ];
  // 老的「自定义字段」分类（字段名称/字段内容）不属于任何具体分类 → 全局生效
  p5.custom = [{ 字段名称: '个人主页', 字段内容: 'github.com/nirui' }];

  const report5 = await fillPage(p5, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });

  const w = report5.results.find(r => r.slot && r.slot.startsWith('custom:'));
  ok('自定义字段进了匹配池（槽 = custom:分类:字段名）', w && w.slot === 'custom:personal:微信号', JSON.stringify(report5.results.map(r => r.slot)));
  ok('按自定义字段名对上了网页标签', w && w.status === 'filled', JSON.stringify(w && { s: w.status, r: w.reason }));
  ok('自定义字段的值真的填进 DOM', document.querySelector('input[name="wechat5"]').value === 'nirui_pm', document.querySelector('input[name="wechat5"]').value);

  const degree5 = report5.results.find(r => r.slot === 'personal.highestDegree');
  ok(
    '最高学历绑到 personal.highestDegree 并选中「硕士」',
    degree5 && degree5.status === 'filled' && degree5.readback === '硕士',
    JSON.stringify(degree5 && { s: degree5.status, r: degree5.reason, rb: degree5.readback })
  );
  ok('姓名照常填（自定义字段没有抢走内置字段）', document.querySelector('input[name="name5"]').value === '倪睿');

  const g = report5.results.find(r => r.slot === 'custom:global:个人主页');
  ok('老的「自定义字段」分类也进了匹配池（全局）', !!g, JSON.stringify(report5.results.map(r => r.slot)));
  ok(
    '全局自定义字段的值填进 DOM',
    document.querySelector('input[name="gh5"]').value === 'github.com/nirui',
    document.querySelector('input[name="gh5"]').value
  );
}

console.log('\n[9] 网页日历只有年月格子（没有日格子）→ 日粒度资料降级写入');
{
  // 有些网申只收年月，日历面板里压根没有日格子。原来会一路走到 no-day-grid 判失败，
  // 等于"资料越细越填不上"，和需求正好相反。
  const html6 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-item">
        <label class="form-label">开始时间</label>
        <div class="phoenix-date-picker"><input class="phoenix-input__input" id="eduStart9" readonly placeholder="请选择"></div>
      </div>
      <div class="form-item"><label class="form-label">学校名称</label><input id="school9"></div>
    </div>
  </form></body></html>`;
  const dom6 = new JSDOM(html6, { pretendToBeVisual: true });
  global.window = dom6.window;
  global.document = dom6.window.document;
  global.getComputedStyle = dom6.window.getComputedStyle.bind(dom6.window);
  global.HTMLInputElement = dom6.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom6.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom6.window.HTMLSelectElement;

  const input = document.querySelector('#eduStart9');
  const view = { y: 2026, m: 3 }; // 面板打开在 2026 年 3 月，目标是 2026-08-15

  input.parentElement.addEventListener('click', () => {
    if (document.querySelector('.phoenix-calendar')) return;
    const host = document.createElement('div');
    host.className = 'phoenix-calendar';
    host.innerHTML =
      `<div class="cal-head"><span class="cal-title">${view.y}年${view.m}月</span></div>` +
      `<div class="cal-months">${Array.from({ length: 12 }, (_, i) => `<div class="cal-month">${i + 1}</div>`).join('')}</div>`;
    document.body.append(host);
    host.querySelectorAll('.cal-month').forEach(d => {
      d.addEventListener('click', () => {
        input.value = `${view.y}-${String(d.textContent).padStart(2, '0')}`;
        host.remove();
      });
    });
  });

  const p6 = defaultProfile();
  p6.education = [{ 开始时间: '2026-08-15', 学校名称: '天津大学' }];

  const report6 = await fillPage(p6, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const s6 = report6.results.find(r => r.slot === 'edu.start');

  ok('只有年月格子的面板也能填成功', s6 && s6.status === 'filled', JSON.stringify(s6 && { s: s6.status, r: s6.reason, a: s6.attempts }));
  ok('走的是面板的月粒度降级路径', s6 && s6.via === 'panel-month', s6 && s6.via);
  ok('写进去的是年月（2026-08）', input.value === '2026-08', input.value || '(空)');
  ok('报告标注降级到年月', s6 && s6.downgraded === 'month', JSON.stringify(s6 && s6.downgraded));
}

console.log('\n[10] 自定义字段：跨区块 + 纯英文标签 + 没匹配上要报出来');
{
  // 用户反馈"自定义字段无法适配、也无法被检测到"。三个成因一起覆盖：
  //   ① 网页把这个字段放在"没被识别成任何分类"的区块里 → 只按分类作用域找会漏
  //   ② 标签是纯英文（GitHub）→ 原来"必须含中文"的规则把它整条丢掉
  //   ③ 名字对不上 → 报告里原来一条记录都没有，看起来像"没检测到"
  const html7 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">补充材料</div>
      <div class="form-item"><label class="form-label">GitHub</label><input name="gh7"></div>
      <div class="form-item"><label class="form-label">导师姓名</label><input name="tutor7"></div>
      <div class="form-item"><label class="form-label">个人博客</label><input name="blog7"></div>
    </div>
  </form></body></html>`;
  const dom7 = new JSDOM(html7, { pretendToBeVisual: true });
  global.window = dom7.window;
  global.document = dom7.window.document;
  global.getComputedStyle = dom7.window.getComputedStyle.bind(dom7.window);
  global.HTMLInputElement = dom7.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom7.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom7.window.HTMLSelectElement;

  const p7 = defaultProfile();
  // GitHub 挂在"个人信息"下、导师姓名挂在"教育经历"下，但网页把它们放在同一个不明区块里
  p7.personal = [{ 姓名: '倪睿', __custom: [{ name: 'GitHub', value: 'github.com/nirui' }] }];
  p7.education = [{ 学校名称: '天津大学', __custom: [{ name: '导师姓名', value: '张老师' }] }];

  const report7 = await fillPage(p7, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const summary7 = report7.results.map(r => ({ slot: r.slot, s: r.status }));

  ok('英文标签 GitHub 被识别成字段', summary7.some(r => r.slot === 'custom:personal:github'), JSON.stringify(summary7));
  ok(
    '英文标签的字段被填上',
    document.querySelector('input[name="gh7"]').value === 'github.com/nirui',
    document.querySelector('input[name="gh7"]').value || '(空)'
  );
  ok(
    '教育经历的自定义字段在"分类不明"的区块里也填上了',
    document.querySelector('input[name="tutor7"]').value === '张老师',
    document.querySelector('input[name="tutor7"]').value || '(空)'
  );

  // 网页上没有"个人博客"这个标签，但资料库里加过 → 必须有一条明确的诊断
  p7.personal[0].__custom.push({ name: '研究方向', value: '大模型应用' });
  const report7b = await fillPage(p7, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const miss = report7b.results.find(r => r.reason === 'custom-no-match');
  ok('名字对不上时报告里有 custom-no-match（不再悄悄消失）', !!miss, JSON.stringify(report7b.results.map(r => r.reason || r.slot)));
  ok('诊断行带上了自定义字段名', miss && miss.label === '研究方向', miss && miss.label);
}

console.log('\n[11] 多段经历：网页只渲染一段时，先点「添加」再填第 2 段');
{
  // 用户反馈：资料库里有 2 段教育经历，网页默认只渲染 1 段，第 2 段根本没机会填。
  // 必须先点网页自己的「添加」把容器点出来，再重新扫描、重新绑定、再填。
  const boot = (html, setup) => {
    const d = new JSDOM(html, { pretendToBeVisual: true });
    global.window = d.window;
    global.document = d.window.document;
    global.getComputedStyle = d.window.getComputedStyle.bind(d.window);
    global.HTMLInputElement = d.window.HTMLInputElement;
    global.HTMLTextAreaElement = d.window.HTMLTextAreaElement;
    global.HTMLSelectElement = d.window.HTMLSelectElement;
    if (setup) setup(d.window.document);
    return d;
  };
  const noBridge = { bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) } };
  const eduPage = extra => `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="edu-list">
        <div class="repeater">
          <div class="form-item"><label class="form-label">学校名称</label><input class="school" placeholder="学校名称"></div>
          <div class="form-item"><label class="form-label">专业名称</label><input class="major" placeholder="专业名称"></div>
        </div>
      </div>
      ${extra}
    </div>
  </form></body></html>`;

  // ① 有明确的「添加教育经历」按钮
  boot(eduPage('<button type="button" class="add-edu">添加教育经历</button>'), doc => {
    doc.querySelector('.add-edu').addEventListener('click', () => {
      const list = doc.querySelector('.edu-list');
      const clone = list.querySelector('.repeater').cloneNode(true);
      clone.querySelectorAll('input').forEach(i => (i.value = ''));
      list.append(clone);
    });
  });

  const p8 = defaultProfile();
  p8.education = [
    { 学校名称: '天津大学', 专业名称: '金融数学' },
    { 学校名称: '香港城市大学', 专业名称: '商业数据分析' },
  ];
  const report8 = await fillPage(p8, noBridge);
  const schools = [...document.querySelectorAll('.school')].map(i => i.value);

  ok('点了一次「添加教育经历」', report8.repeat && report8.repeat.added === 1, JSON.stringify(report8.repeat));
  ok('网页上多出了第 2 块', schools.length === 2, JSON.stringify(schools));
  ok('第 2 段填进了新出现的块', schools[1] === '香港城市大学', JSON.stringify(schools));
  ok('第 1 段没有被覆盖', schools[0] === '天津大学', JSON.stringify(schools));
  const majors = [...document.querySelectorAll('.major')].map(i => i.value);
  ok('第 2 块的专业也填上了', majors[1] === '商业数据分析', JSON.stringify(majors));

  // ② 只有「添加附件」这种噪声按钮 → 绝不能当成"再加一段"
  boot(eduPage('<button type="button" class="add-file">添加附件</button>'));
  const p9 = defaultProfile();
  p9.education = [
    { 学校名称: '天津大学', 专业名称: '金融数学' },
    { 学校名称: '香港城市大学', 专业名称: '商业数据分析' },
  ];
  const report9 = await fillPage(p9, noBridge);
  ok('没有真正的添加按钮时不乱点', report9.repeat && report9.repeat.added === 0, JSON.stringify(report9.repeat));
  ok('「添加附件」没被当成添加经历', document.querySelectorAll('.school').length === 1);

  // ③ 点「添加」弹出的是对话框（不是就地加一块）→ 要收干净，不能把页面留在弹窗里
  boot(eduPage(''), doc => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'add-edu';
    btn.textContent = '添加教育经历';
    btn.addEventListener('click', () => {
      const dlg = doc.createElement('div');
      dlg.setAttribute('role', 'dialog');
      dlg.className = 'modal';
      dlg.innerHTML = '<div class="modal-body">请填写教育经历</div><button type="button" class="dlg-cancel">取消</button>';
      doc.body.append(dlg);
      dlg.querySelector('.dlg-cancel').addEventListener('click', () => dlg.remove());
    });
    doc.querySelector('.card').append(btn);
  });
  const p10 = defaultProfile();
  p10.education = [
    { 学校名称: '天津大学', 专业名称: '金融数学' },
    { 学校名称: '香港城市大学', 专业名称: '商业数据分析' },
  ];
  const report10 = await fillPage(p10, noBridge);
  ok('点出对话框时不会硬塞第 2 段', report10.repeat.added === 0, JSON.stringify(report10.repeat));
  ok(
    '弹出来的对话框被关掉了',
    ![...document.querySelectorAll('[role="dialog"]')].some(d => d.isConnected),
    (report10.repeat.log || []).join(' | ')
  );
  ok('日志说明了"点了没多出区块"', /没多出区块/.test((report10.repeat.log || []).join('')), JSON.stringify(report10.repeat.log));
  ok('第 1 段照常填上', document.querySelector('.school').value === '天津大学', document.querySelector('.school').value);
}

console.log('\n[12] 日历弹窗拉起了但值没提交 → 补点确定 + 明确报出来');
{
  // 用户的真机现象："可以看到拉起弹窗了，但开始/结束时间没有填充上"。
  // 面板开了不等于值提交了：必须回读控件真实值，不能因为 drivePanel 自称成功就报 filled。
  const bootCal = commitOnConfirm => {
    const html9 = `<!doctype html><html><body><form>
      <div class="card">
        <div class="section-title">教育经历</div>
        <div class="form-item">
          <label class="form-label">开始时间</label>
          <div class="phoenix-date-picker"><input class="phoenix-input__input" id="eduStart12" readonly placeholder="请选择"></div>
        </div>
        <div class="form-item"><label class="form-label">学校名称</label><input id="school12"></div>
      </div>
    </form></body></html>`;
    const d = new JSDOM(html9, { pretendToBeVisual: true });
    global.window = d.window;
    global.document = d.window.document;
    global.getComputedStyle = d.window.getComputedStyle.bind(d.window);
    global.HTMLInputElement = d.window.HTMLInputElement;
    global.HTMLTextAreaElement = d.window.HTMLTextAreaElement;
    global.HTMLSelectElement = d.window.HTMLSelectElement;

    const doc = d.window.document;
    const input = doc.querySelector('#eduStart12');
    let pending = null;
    input.parentElement.addEventListener('click', () => {
      if (doc.querySelector('.phoenix-calendar')) return;
      const host = doc.createElement('div');
      host.className = 'phoenix-calendar';
      host.innerHTML =
        '<div class="cal-head"><span class="cal-title">2026年8月</span></div>' +
        '<div class="cal-days">' +
        Array.from({ length: 31 }, (_, i) => '<div class="cal-day">' + (i + 1) + '</div>').join('') +
        '</div>' +
        '<div class="cal-foot"><button type="button" class="cal-ok">确定</button>' +
        '<button type="button" class="cal-cancel">取消</button></div>';
      doc.body.append(host);
      host.querySelectorAll('.cal-day').forEach(cell => {
        cell.addEventListener('click', () => {
          // 只记下"选中了哪一天"、不提交：这就是"弹窗拉起了值却没填上"的真实形态
          pending = '2026-08-' + String(cell.textContent).padStart(2, '0');
        });
      });
      host.querySelector('.cal-ok').addEventListener('click', () => {
        if (!commitOnConfirm || !pending) return;
        input.value = pending;
        host.remove();
      });
      host.querySelector('.cal-cancel').addEventListener('click', () => host.remove());
    });
    return input;
  };

  // ① 点「确定」才真正提交（很多日期组件的默认行为）
  const input12 = bootCal(true);
  const p11 = defaultProfile();
  p11.education = [{ 开始时间: '2026-08-15', 学校名称: '天津大学' }];
  const report11 = await fillPage(p11, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const s11 = report11.results.find(r => r.slot === 'edu.start');
  ok('需要点确定的面板也能填成功', s11 && s11.status === 'filled', JSON.stringify(s11 && { s: s11.status, a: s11.attempts }));
  ok('值真的落到了控件上', input12.value === '2026-08-15', input12.value || '(空)');
  ok('补点了确定', (s11.attempts || []).includes('panel-confirm'), JSON.stringify(s11 && s11.attempts));

  // ② 面板怎么点都不提交 → 必须判失败（而不是"弹窗开了就算成功"），并把面板特征带进报告
  const input13 = bootCal(false);
  const p12 = defaultProfile();
  p12.education = [{ 开始时间: '2026-08-15', 学校名称: '天津大学' }];
  const report12 = await fillPage(p12, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const s12 = report12.results.find(r => r.slot === 'edu.start');
  ok('值没提交时判失败，不虚报成功', s12 && s12.status === 'skipped', JSON.stringify(s12 && { s: s12.status, r: s12.reason }));
  ok('失败原因是 date-failed', s12 && s12.reason === 'date-failed', s12 && s12.reason);
  ok('控件上没有被写入脏值', !String(input13.value || '').trim(), input13.value || '(空)');
  ok('报告里带上了面板文本，能定位是哪个日历', !!(s12 && s12.panelText), JSON.stringify(s12 && s12.panelText));
  ok(
    '尝试链路里留下了 panel-sel',
    (s12.attempts || []).some(a => String(a).startsWith('panel-sel:')),
    JSON.stringify(s12 && s12.attempts)
  );
}

console.log('\n[13] 日期控件是可编辑的普通文本框（北森真实结构）→ 先键入，多种格式依次试');
{
  // 真机 DOM：<label>开始时间</label><div class="listLInner" value="false" required="false">
  //            <div class="generic"><div><input type="text" value=""></div></div></div>
  // 值就是 "2026-10-01" 这样的字符串，能直接键入。
  // 但组件只认 "YYYY/MM/DD"；点一下会弹出面板，面板开着时键入会被当场清空。
  // 旧逻辑先开面板（弹窗拉起了）→ 面板失败 → 面板还开着 → 键入被清空 → 判失败。
  const html10 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-item">
        <label class="form-label">开始时间</label>
        <div class="listLInner" value="false" required="false">
          <div class="generic"><div class="notNull"><div><input type="text" id="d13a" value=""></div></div></div>
        </div>
      </div>
      <div class="form-item">
        <label class="form-label">结束时间</label>
        <div class="listLInner" value="false" required="false">
          <div class="generic"><div class="notNull"><div><input type="text" id="d13b" value=""></div></div></div>
        </div>
      </div>
      <div class="form-item"><label class="form-label">学校名称</label><input id="s13"></div>
    </div>
  </form></body></html>`;
  const dom10 = new JSDOM(html10, { pretendToBeVisual: true });
  global.window = dom10.window;
  global.document = dom10.window.document;
  global.getComputedStyle = dom10.window.getComputedStyle.bind(dom10.window);
  global.HTMLInputElement = dom10.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom10.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom10.window.HTMLSelectElement;

  const doc = dom10.window.document;
  const PANEL = () => doc.querySelector('.date-pop');
  const wire = el => {
    // 点一下弹面板（面板里没有年月日网格，只能靠键入）
    const open = () => {
      if (PANEL()) return;
      const p = doc.createElement('div');
      p.className = 'date-pop';
      p.textContent = '请选择日期';
      doc.body.append(p);
    };
    el.parentElement.addEventListener('click', open);
    el.addEventListener('input', () => {
      // 面板开着 → 组件抢焦点，键入被丢弃
      if (PANEL()) {
        el.value = '';
        return;
      }
      // 只认 YYYY/MM/DD
      if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(el.value)) el.value = '';
    });
  };
  wire(doc.querySelector('#d13a'));
  wire(doc.querySelector('#d13b'));

  const p13 = defaultProfile();
  p13.education = [{ 开始时间: '2026-10-01', 结束时间: '2026-10-30', 学校名称: '香港城市大学' }];
  const report13 = await fillPage(p13, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const s13 = report13.results.find(r => r.slot === 'edu.start');
  const e13 = report13.results.find(r => r.slot === 'edu.end');

  ok('开始时间填上了', s13 && s13.status === 'filled', JSON.stringify(s13 && { s: s13.status, a: s13.attempts }));
  ok('结束时间填上了', e13 && e13.status === 'filled', JSON.stringify(e13 && { s: e13.status, a: e13.attempts }));
  ok('开始时间值正确', doc.querySelector('#d13a').value === '2026/10/01', doc.querySelector('#d13a').value || '(空)');
  ok('结束时间值正确', doc.querySelector('#d13b').value === '2026/10/30', doc.querySelector('#d13b').value || '(空)');
  ok(
    '报告里能看到是靠哪种格式填上的',
    (s13.attempts || []).some(a => String(a).startsWith('typing:ok(')),
    JSON.stringify(s13 && s13.attempts)
  );
  ok('压根没去点面板（能键入就不碰面板）', !(s13.attempts || []).some(a => String(a).startsWith('panel')));
}

console.log('\n[14] 一行两列的字段行（工作单位 | 职务、学历 | 学位）→ 按位置配对标签');
{
  // 两个控件共用一个"字段行"容器时，两个控件都会拿到 ["工作单位","职务"] 两个标签，
  // pickLabel 永远取第一个 → 两个控件都绑到 family.company → 职务永远填不上（且不报错）。
  const html11 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">家庭情况</div>
      <div class="form-item">
        <label class="form-label">工作单位</label><input id="c14a">
        <label class="form-label">职务</label><input id="c14b">
      </div>
    </div>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-item">
        <label class="form-label">学历</label>
        <select id="c14c"><option value="">请选择</option><option value="1">硕士研究生</option></select>
        <label class="form-label">学位</label>
        <select id="c14d"><option value="">请选择</option><option value="1">硕士学位</option></select>
      </div>
    </div>
  </form></body></html>`;
  const dom11 = new JSDOM(html11, { pretendToBeVisual: true });
  global.window = dom11.window;
  global.document = dom11.window.document;
  global.getComputedStyle = dom11.window.getComputedStyle.bind(dom11.window);
  global.HTMLInputElement = dom11.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom11.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom11.window.HTMLSelectElement;

  const p14 = defaultProfile();
  p14.family = [{ 工作单位: '天津市宏鹏实业有限公司', 职务: '总经理' }];
  p14.education = [{ 学历: '硕士', 学位: '硕士' }];
  const report14 = await fillPage(p14, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const doc14 = dom11.window.document;
  ok('工作单位填上', doc14.querySelector('#c14a').value === '天津市宏鹏实业有限公司', doc14.querySelector('#c14a').value);
  ok('同一行的「职务」也填上', doc14.querySelector('#c14b').value === '总经理', doc14.querySelector('#c14b').value || '(空)');
  ok('同一行的「学历」选中硕士研究生', doc14.querySelector('#c14c').value === '1', doc14.querySelector('#c14c').value);
  ok('同一行的「学位」选中硕士学位', doc14.querySelector('#c14d').value === '1', doc14.querySelector('#c14d').value || '(空)');
  const t14 = report14.results.find(r => r.slot === 'family.title');
  ok('职务绑定到 family.title', t14 && t14.status === 'filled', JSON.stringify(t14 && { s: t14.status, r: t14.reason }));
}

console.log('\n[15] 语言成绩 6.5 不能变成 6.50000');
{
  // 站点的格式化挂在 blur 上：失焦时按固定小数位重写。
  // 旧代码写完后无条件 fire blur → 我们自己把 6.5 触成了 6.50000。
  const html12 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">语言能力</div>
      <div class="form-item"><label class="form-label">语言成绩</label><input id="score15"></div>
    </div>
  </form></body></html>`;
  const dom12 = new JSDOM(html12, { pretendToBeVisual: true });
  global.window = dom12.window;
  global.document = dom12.window.document;
  global.getComputedStyle = dom12.window.getComputedStyle.bind(dom12.window);
  global.HTMLInputElement = dom12.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom12.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom12.window.HTMLSelectElement;

  const score = dom12.window.document.querySelector('#score15');
  score.addEventListener('blur', () => {
    const n = Number(score.value);
    if (Number.isFinite(n) && String(score.value).includes('.')) score.value = n.toFixed(5);
  });

  const p15 = defaultProfile();
  p15.languages = [{ 语言能力: '英语', 证书类型: '雅思', 语言成绩: '6.5' }];
  await fillPage(p15, { bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) } });

  ok('语言成绩严格保持 6.5（没被补成 6.50000）', score.value === '6.5', score.value || '(空)');
}

console.log('\n[16] 新加的那段经历字段不完全一样（签名不同）→ 仍然要切成 2 块并填第 2 段');
{
  // 用户点了「添加教育经历」后，站点渲染出来的第 2 段字段措辞变了
  // （"专业名称" → "所学专业"）。原来 buildBlocks 只认"标签签名完全一致"的那组，
  // 两份签名不一致 → 整段退化成 1 个 block → 第 2 段一条都填不上。
  const html13 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="edu-list">
        <div class="repeater">
          <div class="form-item"><label class="form-label">学校名称</label><input class="school" placeholder="学校名称"></div>
          <div class="form-item"><label class="form-label">专业名称</label><input class="major" placeholder="专业名称"></div>
          <div class="form-item"><label class="form-label">学历</label><input class="degree" placeholder="学历"></div>
        </div>
      </div>
      <button type="button" class="add-edu">添加教育经历</button>
    </div>
  </form></body></html>`;
  const dom13 = new JSDOM(html13, { pretendToBeVisual: true });
  global.window = dom13.window;
  global.document = dom13.window.document;
  global.getComputedStyle = dom13.window.getComputedStyle.bind(dom13.window);
  global.HTMLInputElement = dom13.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom13.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom13.window.HTMLSelectElement;

  const doc13 = dom13.window.document;
  doc13.querySelector('.add-edu').addEventListener('click', () => {
    // 第 2 段的"专业"标签写成了「所学专业」——签名与第 1 段不同
    const div = doc13.createElement('div');
    div.className = 'repeater';
    div.innerHTML =
      '<div class="form-item"><label class="form-label">学校名称</label><input class="school2" placeholder="学校名称"></div>' +
      '<div class="form-item"><label class="form-label">所学专业</label><input class="major2" placeholder="所学专业"></div>' +
      '<div class="form-item"><label class="form-label">学历</label><input class="degree2" placeholder="学历"></div>';
    doc13.querySelector('.edu-list').append(div);
  });

  const p16 = defaultProfile();
  p16.education = [
    { 学校名称: '天津大学', 专业名称: '金融数学', 学历: '本科' },
    { 学校名称: '香港城市大学', 专业名称: '商业数据分析', 学历: '硕士' },
  ];
  const report16 = await fillPage(p16, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const schools16 = [...doc13.querySelectorAll('.school,.school2')].map(i => i.value);
  ok('识别出 2 块并新增了第 2 块', report16.repeat.added === 1, JSON.stringify(report16.repeat));
  ok('第 1 段填对', schools16[0] === '天津大学', JSON.stringify(schools16));
  ok('第 2 段学校填对', schools16[1] === '香港城市大学', JSON.stringify(schools16));
  ok(
    '第 2 段专业填对（标签措辞不同也要能对上）',
    doc13.querySelector('.major2').value === '商业数据分析',
    doc13.querySelector('.major2').value || '(空)'
  );
}

console.log('\n[17] 网页只收年月（界面就是 2026-10）→ 日粒度资料自动降级写入');
{
  // 用户截图里的形态：开始时间显示 `2026-10`，右侧挂日历图标，根本没有"日"。
  // 资料里是 2025-10-01，这种控件会拒收完整日期，只认 YYYY-MM。
  const html14 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-item">
        <label class="form-label">开始时间</label>
        <div class="input-wrap"><input type="text" id="m17" value=""></div>
      </div>
      <div class="form-item">
        <label class="form-label">结束时间</label>
        <div class="input-wrap"><input type="text" id="m17b" value=""></div>
      </div>
      <div class="form-item"><label class="form-label">学校名称</label><input id="s17"></div>
    </div>
  </form></body></html>`;
  const dom14 = new JSDOM(html14, { pretendToBeVisual: true });
  global.window = dom14.window;
  global.document = dom14.window.document;
  global.getComputedStyle = dom14.window.getComputedStyle.bind(dom14.window);
  global.HTMLInputElement = dom14.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom14.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom14.window.HTMLSelectElement;

  const doc17 = dom14.window.document;
  // 只收年月：任何带"日"的写法当场清空
  const monthOnly = el =>
    el.addEventListener('input', () => {
      const v = el.value;
      if (!v) return;
      if (/^\d{4}-\d{2}$/.test(v)) return; // 收
      el.value = ''; // 拒
    });
  monthOnly(doc17.querySelector('#m17'));
  monthOnly(doc17.querySelector('#m17b'));

  const p17 = defaultProfile();
  p17.education = [{ 开始时间: '2025-10-01', 结束时间: '2029-06-30', 学校名称: '香港城市大学' }];
  const report17 = await fillPage(p17, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const s17 = report17.results.find(r => r.slot === 'edu.start');

  ok('月粒度网页也能填成功（不再判失败）', s17 && s17.status === 'filled', JSON.stringify(s17 && { s: s17.status, a: s17.attempts }));
  ok('写进去的是 2025-10', doc17.querySelector('#m17').value === '2025-10', doc17.querySelector('#m17').value || '(空)');
  ok('结束时间同样降级成 2029-06', doc17.querySelector('#m17b').value === '2029-06', doc17.querySelector('#m17b').value || '(空)');
  ok('报告标注"网页只到年月"', s17 && s17.downgraded === 'month', s17 && s17.downgraded);
  ok(
    '报告写明是靠哪种写法填上的',
    (s17.attempts || []).some(a => String(a) === 'typing:ok(2025-10)'),
    JSON.stringify(s17 && s17.attempts)
  );
}

console.log('\n[18] 所有支持多条的分类都能自动「添加」：教育 / 实习 / 在校职务');
{
  const mk = (title, cls, btnText, btnCls) => `
    <div class="card">
      <div class="section-title">${title}</div>
      <div class="${cls}-list">
        <div class="repeater ${cls}-block">
          <div class="form-item"><label class="form-label">${cls === 'edu' ? '学校名称' : cls === 'exp' ? '单位名称' : '在校职务名称'}</label>
            <input class="${cls}-main" placeholder=""></div>
          <div class="form-item"><label class="form-label">备注</label><input class="${cls}-note" placeholder=""></div>
        </div>
      </div>
      <button type="button" class="${btnCls}">${btnText}</button>
    </div>`;

  const html15 = `<!doctype html><html><body><form>
    ${mk('教育经历', 'edu', '添加教育经历', 'add-edu')}
    ${mk('实习经历', 'exp', '添加实习经历', 'add-exp')}
    ${mk('在校职务', 'pos', '添加', 'add-pos')}
  </form></body></html>`;
  const dom15 = new JSDOM(html15, { pretendToBeVisual: true });
  global.window = dom15.window;
  global.document = dom15.window.document;
  global.getComputedStyle = dom15.window.getComputedStyle.bind(dom15.window);
  global.HTMLInputElement = dom15.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom15.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom15.window.HTMLSelectElement;

  const doc18 = dom15.window.document;
  const addBlock = (btnSel, listSel, blockSel) => {
    doc18.querySelector(btnSel).addEventListener('click', () => {
      const list = doc18.querySelector(listSel);
      const clone = list.querySelector(blockSel).cloneNode(true);
      clone.querySelectorAll('input').forEach(i => (i.value = ''));
      list.append(clone);
    });
  };
  addBlock('.add-edu', '.edu-list', '.edu-block');
  addBlock('.add-exp', '.exp-list', '.exp-block');
  addBlock('.add-pos', '.pos-list', '.pos-block');

  const p18 = defaultProfile();
  p18.education = [
    { 学校名称: '天津大学', 备注: '本科' },
    { 学校名称: '香港城市大学', 备注: '硕士' },
  ];
  p18.internships = [
    { 单位名称: '腾讯', 备注: '应用宝' },
    { 单位名称: '字节跳动', 备注: '抖音' },
  ];
  p18.positions = [
    { 在校职务名称: '学生会主席', 备注: '大三' },
    { 在校职务名称: '班长', 备注: '大二' },
  ];
  const report18 = await fillPage(p18, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });

  const vals = sel => [...doc18.querySelectorAll(sel)].map(i => i.value);
  ok('三个分类各点了一次添加', report18.repeat.added === 3, JSON.stringify(report18.repeat));
  ok('教育经历第 2 段填上', vals('.edu-main')[1] === '香港城市大学', JSON.stringify(vals('.edu-main')));
  ok('实习经历第 2 段填上', vals('.exp-main')[1] === '字节跳动', JSON.stringify(vals('.exp-main')));
  ok('在校职务第 2 段填上', vals('.pos-main')[1] === '班长', JSON.stringify(vals('.pos-main')));
  ok('第 1 段都没被覆盖', vals('.edu-main')[0] === '天津大学' && vals('.exp-main')[0] === '腾讯', JSON.stringify(vals('.edu-main')));

  // ① 某个分类的按钮点了没反应：只跳过它，不能连累其它分类
  const dom16 = new JSDOM(html15, { pretendToBeVisual: true });
  global.window = dom16.window;
  global.document = dom16.window.document;
  global.getComputedStyle = dom16.window.getComputedStyle.bind(dom16.window);
  global.HTMLInputElement = dom16.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom16.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom16.window.HTMLSelectElement;
  const doc19 = dom16.window.document;
  // 教育经历的按钮坏掉（点了什么都不发生），实习/在校职务正常
  doc19.querySelector('.add-exp').addEventListener('click', () => {
    const list = doc19.querySelector('.exp-list');
    const clone = list.querySelector('.exp-block').cloneNode(true);
    clone.querySelectorAll('input').forEach(i => (i.value = ''));
    list.append(clone);
  });
  doc19.querySelector('.add-pos').addEventListener('click', () => {
    const list = doc19.querySelector('.pos-list');
    const clone = list.querySelector('.pos-block').cloneNode(true);
    clone.querySelectorAll('input').forEach(i => (i.value = ''));
    list.append(clone);
  });
  const report19 = await fillPage(p18, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const vals19 = sel => [...doc19.querySelectorAll(sel)].map(i => i.value);
  ok('教育经历加不上时，实习经历照样扩充', vals19('.exp-main')[1] === '字节跳动', JSON.stringify(vals19('.exp-main')));
  ok('在校职务照样扩充', vals19('.pos-main')[1] === '班长', JSON.stringify(vals19('.pos-main')));
  ok(
    '日志点名了失败的是教育经历',
    (report19.repeat.log || []).some(l => l.includes('教育经历') && l.includes('没多出区块')),
    JSON.stringify(report19.repeat.log)
  );

  // ② 纯图标按钮（只有 ＋，靠 title 说明用途）
  const html17 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">实习经历</div>
      <div class="exp-list">
        <div class="repeater exp-block">
          <div class="form-item"><label class="form-label">单位名称</label><input class="exp-main" placeholder=""></div>
          <div class="form-item"><label class="form-label">备注</label><input class="exp-note" placeholder=""></div>
        </div>
      </div>
      <span class="plus-icon" title="添加实习经历">＋</span>
    </div>
  </form></body></html>`;
  const dom17 = new JSDOM(html17, { pretendToBeVisual: true });
  global.window = dom17.window;
  global.document = dom17.window.document;
  global.getComputedStyle = dom17.window.getComputedStyle.bind(dom17.window);
  global.HTMLInputElement = dom17.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom17.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom17.window.HTMLSelectElement;
  const doc20 = dom17.window.document;
  doc20.querySelector('.plus-icon').addEventListener('click', () => {
    const list = doc20.querySelector('.exp-list');
    const clone = list.querySelector('.exp-block').cloneNode(true);
    clone.querySelectorAll('input').forEach(i => (i.value = ''));
    list.append(clone);
  });
  const p20 = defaultProfile();
  p20.internships = [
    { 单位名称: '腾讯', 备注: '应用宝' },
    { 单位名称: '字节跳动', 备注: '抖音' },
  ];
  const report20 = await fillPage(p20, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const vals20 = [...doc20.querySelectorAll('.exp-main')].map(i => i.value);
  ok('纯图标「＋」按钮也能认出来', report20.repeat.added === 1, JSON.stringify(report20.repeat));
  ok('图标按钮点出来的第 2 段填上了', vals20[1] === '字节跳动', JSON.stringify(vals20));
}

console.log('\n[19] 两段字段共用一个父容器 → 必须切成 2 块，新加那段要填上');
{
  // 真机形态：教育经历的两段渲染在**同一个父容器**里，
  //   <div class="edu-fields"> [4 个字段] × 2 </div>
  // 按父容器切块只能切出 1 块 → 第 2 段的字段和第一段撞槽 → 被同块去重整段跳过，
  // 现象就是"点了添加、界面上多了一段，但一条都没填"。
  const seg = (cls, ph) => `
    <div class="form-item"><label class="form-label">学校名称</label><input class="${cls}-school" placeholder="${ph}"></div>
    <div class="form-item"><label class="form-label">学院名称</label><input class="${cls}-college" placeholder="${ph}"></div>
    <div class="form-item"><label class="form-label">专业名称</label><input class="${cls}-major" placeholder="${ph}"></div>
    <div class="form-item"><label class="form-label">专业课程</label><input class="${cls}-courses" placeholder="${ph}"></div>`;

  const html18 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="edu-fields">${seg('a', '第1段')}</div>
      <button type="button" class="add-edu">添加教育经历</button>
    </div>
  </form></body></html>`;
  const dom18 = new JSDOM(html18, { pretendToBeVisual: true });
  global.window = dom18.window;
  global.document = dom18.window.document;
  global.getComputedStyle = dom18.window.getComputedStyle.bind(dom18.window);
  global.HTMLInputElement = dom18.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom18.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom18.window.HTMLSelectElement;

  const doc21 = dom18.window.document;
  doc21.querySelector('.add-edu').addEventListener('click', () => {
    const host = doc21.querySelector('.edu-fields');
    const wrap = doc21.createElement('div');
    wrap.innerHTML = seg('b', '第2段').replace(/class="b-/g, 'class="b-');
    host.append(...wrap.children);
  });

  const p21 = defaultProfile();
  p21.education = [
    { 学校名称: '香港城市大学', 学院名称: '商学院', 专业名称: '商业及数据分析', 专业课程: '数据挖掘' },
    { 学校名称: '天津大学', 学院名称: '数学学院', 专业名称: '金融数学', 专业课程: '随机过程' },
  ];
  const report21 = await fillPage(p21, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });

  const v = sel => [...doc21.querySelectorAll(sel)].map(i => i.value);
  ok('点了一次添加', report21.repeat.added === 1, JSON.stringify(report21.repeat));
  ok('第 1 段填对', v('.a-school')[0] === '香港城市大学', JSON.stringify(v('.a-school')));
  ok('第 2 段学校填上（不再是一条都不填）', v('.b-school')[0] === '天津大学', JSON.stringify(v('.b-school')));
  ok('第 2 段专业填上', v('.b-major')[0] === '金融数学', JSON.stringify(v('.b-major')));
  ok('第 2 段课程填上', v('.b-courses')[0] === '随机过程', JSON.stringify(v('.b-courses')));
}

console.log('\n[20] 「证件号码：[类型 ▼] [请输入]」复合控件 → 标签要给值输入框，不能被下拉抢走');
{
  const html19 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item">
        <label class="form-label">证件号码</label>
        <select id="idtype"><option value="">请选择</option><option value="1">身份证</option></select>
        <input id="idno" placeholder="请输入">
      </div>
      <div class="form-item"><label class="form-label">邮箱</label><input id="mail20"></div>
    </div>
  </form></body></html>`;
  const dom19 = new JSDOM(html19, { pretendToBeVisual: true });
  global.window = dom19.window;
  global.document = dom19.window.document;
  global.getComputedStyle = dom19.window.getComputedStyle.bind(dom19.window);
  global.HTMLInputElement = dom19.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom19.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom19.window.HTMLSelectElement;

  const p20 = defaultProfile();
  p20.personal = [{ 证件号码: '110108199801012024', 邮箱: 'nirui57@126.com' }];
  const report20 = await fillPage(p20, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const doc22 = dom19.window.document;
  ok(
    '证件号码填进了那个输入框',
    doc22.querySelector('#idno').value === '110108199801012024',
    doc22.querySelector('#idno').value || '(空)'
  );
  ok('同一行的邮箱照常填', doc22.querySelector('#mail20').value === 'nirui57@126.com', doc22.querySelector('#mail20').value);
  const row = report20.results.find(r => r.slot === 'personal.idNo');
  ok('报告里证件号码是已填', row && row.status === 'filled', JSON.stringify(row && { s: row.status, r: row.reason }));
}

console.log('\n[21] 名字含"日期/时间"的字段一律按日期链路写（含月粒度降级）');
{
  // 用户的明确要求："只要是字段名称包含时间、日期的，都按照出生日期的方式处理"。
  // 这里用一个 schema 里**没有声明**的字段名（自定义字段），且网页只收年月。
  const html20 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">档案寄出日期</label><input type="text" id="d21" value=""></div>
      <div class="form-item"><label class="form-label">姓名</label><input id="n21"></div>
    </div>
  </form></body></html>`;
  const dom20 = new JSDOM(html20, { pretendToBeVisual: true });
  global.window = dom20.window;
  global.document = dom20.window.document;
  global.getComputedStyle = dom20.window.getComputedStyle.bind(dom20.window);
  global.HTMLInputElement = dom20.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom20.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom20.window.HTMLSelectElement;

  const doc23 = dom20.window.document;
  const el = doc23.querySelector('#d21');
  // 只收年月
  el.addEventListener('input', () => {
    if (el.value && !/^\d{4}-\d{2}$/.test(el.value)) el.value = '';
  });

  const p22 = defaultProfile();
  p22.personal = [{ 姓名: '倪睿', __custom: [{ name: '档案寄出日期', value: '2025-07-01' }] }];
  const report22 = await fillPage(p22, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const row22 = report22.results.find(r => String(r.slot || '').includes('档案寄出日期'));

  ok('自定义的"日期"字段被识别并绑定', !!row22, JSON.stringify(report22.results.map(r => r.slot)));
  ok('按日期链路写入并降级到年月', el.value === '2025-07', el.value || '(空)');
  ok('报告标注网页只到年月', row22 && row22.downgraded === 'month', JSON.stringify(row22 && row22.downgraded));
  ok('姓名不受影响', doc23.querySelector('#n21').value === '倪睿', doc23.querySelector('#n21').value);
}

console.log('\n[22] 新加那段比上一段少一个字段（4 + 3）→ 也要切开');
{
  const html21 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="edu-fields">
        <div class="form-item"><label class="form-label">学校名称</label><input class="a-school"></div>
        <div class="form-item"><label class="form-label">学院名称</label><input class="a-college"></div>
        <div class="form-item"><label class="form-label">专业名称</label><input class="a-major"></div>
        <div class="form-item"><label class="form-label">专业课程</label><input class="a-courses"></div>
      </div>
      <button type="button" class="add-edu">添加教育经历</button>
    </div>
  </form></body></html>`;
  const dom21 = new JSDOM(html21, { pretendToBeVisual: true });
  global.window = dom21.window;
  global.document = dom21.window.document;
  global.getComputedStyle = dom21.window.getComputedStyle.bind(dom21.window);
  global.HTMLInputElement = dom21.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom21.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom21.window.HTMLSelectElement;

  const doc24 = dom21.window.document;
  doc24.querySelector('.add-edu').addEventListener('click', () => {
    const host = doc24.querySelector('.edu-fields');
    const wrap = doc24.createElement('div');
    // 第 2 段少了「专业课程」
    wrap.innerHTML =
      '<div class="form-item"><label class="form-label">学校名称</label><input class="b-school"></div>' +
      '<div class="form-item"><label class="form-label">学院名称</label><input class="b-college"></div>' +
      '<div class="form-item"><label class="form-label">专业名称</label><input class="b-major"></div>';
    host.append(...wrap.children);
  });

  const p23 = defaultProfile();
  p23.education = [
    { 学校名称: '香港城市大学', 学院名称: '商学院', 专业名称: '商业及数据分析', 专业课程: '数据挖掘' },
    { 学校名称: '天津大学', 学院名称: '数学学院', 专业名称: '金融数学' },
  ];
  const report23 = await fillPage(p23, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  ok('点了一次添加', report23.repeat.added === 1, JSON.stringify(report23.repeat));
  ok('第 2 段学校填上', doc24.querySelector('.b-school').value === '天津大学', doc24.querySelector('.b-school').value || '(空)');
  ok('第 2 段专业填上', doc24.querySelector('.b-major').value === '金融数学', doc24.querySelector('.b-major').value || '(空)');
  ok('第 1 段没被覆盖', doc24.querySelector('.a-school').value === '香港城市大学', doc24.querySelector('.a-school').value);
}

console.log('\n[23] 网格布局站点（每个字段独占一个 .fields-col）→ 两段经历必须都填上');
{
  // 真机形态（用户截图）：
  //   .form-part-body > .fields-col × N > .form-item > .form-item__title + .form-item__control
  // 关键：**每个字段都独占一个父容器**。按父容器切块永远切不出 2 段
  // （每个 .fields-col 里只有 1 个字段），整段退化成 1 个 block →
  // 第 2 段的字段全部和第一段撞槽 → 被同块去重整段跳过
  // → 现象就是用户说的"填了两段，只渲染了第一段"。
  const cell = (label, inner) => `
    <div class="fields-col">
      <div class="form-item">
        <div class="form-item__title">${label}</div>
        <div class="form-item__control">${inner}</div>
      </div>
    </div>`;
  const eduSeg = k => [
    cell('开始时间', `<input class="${k}-start" type="text" placeholder="请选择">`),
    cell('结束时间', `<input class="${k}-end" type="text" placeholder="请选择">`),
    cell('学校名称', `<input class="${k}-school" type="text">`),
    cell('学院名称', `<input class="${k}-college" type="text">`),
    cell('专业名称', `<input class="${k}-major" type="text">`),
    cell('学历', `<select class="${k}-level"><option value="">请选择</option><option>大专</option><option>本科</option><option>硕士</option><option>博士</option></select>`),
    cell('学位', `<select class="${k}-degree"><option value="">请选择</option><option>无</option><option>学士</option><option>硕士</option><option>博士</option></select>`),
  ].join('');

  const html23 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-part-body">${eduSeg('a')}</div>
      <button type="button" class="add-edu">添加教育经历</button>
    </div>
  </form></body></html>`;
  const dom23 = new JSDOM(html23, { pretendToBeVisual: true });
  global.window = dom23.window;
  global.document = dom23.window.document;
  global.getComputedStyle = dom23.window.getComputedStyle.bind(dom23.window);
  global.HTMLInputElement = dom23.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom23.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom23.window.HTMLSelectElement;

  const doc25 = dom23.window.document;
  doc25.querySelector('.add-edu').addEventListener('click', () => {
    const host = doc25.querySelector('.form-part-body');
    const wrap = doc25.createElement('div');
    wrap.innerHTML = eduSeg('b');
    host.append(...wrap.children); // 新增的 7 个 .fields-col 平铺到同一个 body 下
  });

  const p24 = defaultProfile();
  p24.education = [
    {
      开始时间: '2024-09-01', 结束时间: '2025-11-30',
      学校名称: '香港城市大学', 学院名称: '商学院', 专业名称: '商业及数据分析',
      学历: '硕士', 学位: '硕士学位',
    },
    {
      开始时间: '2020-09-01', 结束时间: '2024-06-30',
      学校名称: '天津大学', 学院名称: '数学学院', 专业名称: '金融数学',
      学历: '本科', 学位: '学士',
    },
  ];
  const report24 = await fillPage(p24, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });

  const q = sel => doc25.querySelector(sel);
  ok('点了一次添加', report24.repeat.added === 1, JSON.stringify(report24.repeat));
  ok('第 1 段学校填对', q('.a-school').value === '香港城市大学', q('.a-school').value || '(空)');
  ok('第 2 段学校填上（不再只填第一段）', q('.b-school').value === '天津大学', q('.b-school').value || '(空)');
  ok('第 2 段学院填上', q('.b-college').value === '数学学院', q('.b-college').value || '(空)');
  ok('第 2 段专业填上', q('.b-major').value === '金融数学', q('.b-major').value || '(空)');
  ok('第 1 段开始日期填上', q('.a-start').value === '2024-09-01', q('.a-start').value || '(空)');
  ok('第 2 段开始日期填上', q('.b-start').value === '2020-09-01', q('.b-start').value || '(空)');
  ok('第 2 段结束日期填上', q('.b-end').value === '2024-06-30', q('.b-end').value || '(空)');
  ok('第 1 段学历选上', q('.a-level').value === '硕士', q('.a-level').value || '(空)');
  ok('第 2 段学历选上', q('.b-level').value === '本科', q('.b-level').value || '(空)');
  ok('第 1 段学位选上', q('.a-degree').value === '硕士', q('.a-degree').value || '(空)');
  ok('第 2 段学位选上', q('.b-degree').value === '学士', q('.b-degree').value || '(空)');
}

console.log('\n[24] 网格布局站点：证件号码复合控件 + 家庭情况的职务');
{
  // 同一套网格结构下，用户截图里另外两处没填上的：
  //   ① 身份证号：标签后跟「[证件类型 ▼] [请输入]」两个控件，标签只能给值输入框
  //   ② 家庭情况里的「职务 / 职位」（多个别名）
  const cell = (label, inner) => `
    <div class="fields-col">
      <div class="form-item">
        <div class="form-item__title">${label}</div>
        <div class="form-item__control">${inner}</div>
      </div>
    </div>`;

  const html24 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-part-body">
        ${cell('姓名', '<input class="p-name" type="text">')}
        ${cell('证件类型', '<select class="p-idtype"><option value="">请选择</option><option>身份证</option><option>护照</option></select>')}
        ${cell('证件号码', '<select class="p-idtype2"><option value="">请选择</option><option>身份证</option></select><input class="p-idno" type="text" placeholder="请输入">')}
        ${cell('手机号码', '<input class="p-mobile" type="text">')}
        ${cell('电子邮箱', '<input class="p-mail" type="text">')}
      </div>
    </div>
    <div class="card">
      <div class="section-title">家庭情况</div>
      <div class="form-part-body">
        ${cell('姓名', '<input class="f-name" type="text">')}
        ${cell('与本人关系', '<input class="f-rel" type="text">')}
        ${cell('工作单位', '<input class="f-company" type="text">')}
        ${cell('职务', '<input class="f-title" type="text">')}
        ${cell('工作所在地', '<input class="f-loc" type="text">')}
      </div>
    </div>
  </form></body></html>`;
  const dom24 = new JSDOM(html24, { pretendToBeVisual: true });
  global.window = dom24.window;
  global.document = dom24.window.document;
  global.getComputedStyle = dom24.window.getComputedStyle.bind(dom24.window);
  global.HTMLInputElement = dom24.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom24.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom24.window.HTMLSelectElement;

  const p25 = defaultProfile();
  p25.personal = [{
    姓名: '倪睿',
    证件号码: '120103199807161234',
    手机: '13800138000',
    邮箱: 'nirui57@126.com',
  }];
  p25.family = [{ 姓名: '倪某某', 与本人关系: '父亲', 工作单位: '某某建筑设计院', 职务: '高级工程师', 工作所在地: '天津' }];

  const report25 = await fillPage(p25, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });

  const doc26 = dom24.window.document;
  const q = sel => doc26.querySelector(sel);
  ok('身份证号填进了值输入框', q('.p-idno').value === '120103199807161234', q('.p-idno').value || '(空)');
  ok('证件号码那一行的下拉没被写坏', q('.p-idtype2').value === '', q('.p-idtype2').value || '(空)');
  ok('姓名填上', q('.p-name').value === '倪睿', q('.p-name').value || '(空)');
  ok('手机填上', q('.p-mobile').value === '13800138000', q('.p-mobile').value || '(空)');
  ok('邮箱填上', q('.p-mail').value === 'nirui57@126.com', q('.p-mail').value || '(空)');
  ok('家庭情况的职务填上', q('.f-title').value === '高级工程师', q('.f-title').value || '(空)');
  ok('家庭成员姓名没被"个人信息姓名"抢走', q('.f-name').value === '倪某某', q('.f-name').value || '(空)');
  const tid = report25.results.find(r => r.slot === 'family.title');
  ok('报告里职务是已填', tid && tid.status === 'filled', JSON.stringify(tid && { s: tid.status, r: tid.reason }));
}

console.log('\n[25] 块确实切不开时，报告必须说明白「哪一处被跳过了、为什么」');
{
  // 两段实习经历，每段只有 2 个字段（单位名称 / 职务），网格布局各自独占一个 .fields-col。
  // 字段总数 4 < 6，达不到"按标签重复周期切分"的下限 → 只能当成 1 块 →
  // 第 2 段的字段和第一段撞槽。这种情况下**不能悄悄丢掉**：
  // 报告里必须出现 duplicate-slot，让用户知道"这一段没切分开"。
  const cell = (label, inner) => `
    <div class="fields-col">
      <div class="form-item">
        <div class="form-item__title">${label}</div>
        <div class="form-item__control">${inner}</div>
      </div>
    </div>`;
  const html25 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">实习经历</div>
      <div class="form-part-body">
        ${cell('单位名称', '<input class="a-company" type="text">')}
        ${cell('实习地点', '<input class="a-loc" type="text">')}
        ${cell('单位名称', '<input class="b-company" type="text">')}
        ${cell('实习地点', '<input class="b-loc" type="text">')}
      </div>
    </div>
  </form></body></html>`;
  const dom25 = new JSDOM(html25, { pretendToBeVisual: true });
  global.window = dom25.window;
  global.document = dom25.window.document;
  global.getComputedStyle = dom25.window.getComputedStyle.bind(dom25.window);
  global.HTMLInputElement = dom25.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom25.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom25.window.HTMLSelectElement;

  const p26 = defaultProfile();
  p26.internships = [
    { 单位名称: '腾讯科技', 实习地点: '深圳' },
    { 单位名称: '某咨询公司', 实习地点: '北京' },
  ];
  const report26 = await fillPage(p26, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });

  const doc27 = dom25.window.document;
  const dup = report26.results.filter(r => r.reason === 'duplicate-slot');
  ok('第 1 段照常填上', doc27.querySelector('.a-company').value === '腾讯科技', doc27.querySelector('.a-company').value || '(空)');
  ok('报告里点名了被跳过的重复字段', dup.length >= 1, JSON.stringify(report26.results.map(r => r.reason)));
  ok('重复字段带上了网页标签，便于定位', dup.some(r => (r.parts || []).join('').includes('单位名称')), JSON.stringify(dup.map(r => r.parts)));
}

console.log('\n[26] 「证件类型[组件下拉] + 值输入框」同行 → 标签必须给值输入框');
{
  // 真机截图（北森 phoenix-select）：证件类型根本不是原生 select，而是组件化下拉，
  // 它内部自带一个 <input class="phoenix-select_input"> 当搜索框。
  // 于是「1 个标签 + 2 个 input」，原来"1 个标签配 1 个文本框"的特殊规则永不成立
  // → 下拉的搜索框抢走 personal.idNo（还被当成 SELECT_CUSTOM，写不进去）
  // → 真正的值输入框被同槽去重跳过 → 身份证号整行空白。
  const html26 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-part-body">
        <div class="fields-col">
          <div class="form-item form-item--phoenix">
            <div class="form-item__title form-item__title--right">证件号码</div>
            <div class="form-item__control">
              <span class="phoenix-select phoenix-select-editable phoenix-select--large">
                <span class="phoenix-select_califier">身份证</span>
                <div class="phoenix-select_inputwrap">
                  <input placeholder="请选择" class="phoenix-select_input phoenix-select_input--large" value="身份证" type="text">
                </div>
              </span>
              <div class="phoenix-input phoenix-input--large">
                <input class="id-no" type="text" placeholder="请输入">
              </div>
            </div>
          </div>
        </div>
        <div class="fields-col">
          <div class="form-item form-item--phoenix">
            <div class="form-item__title form-item__title--right">姓名</div>
            <div class="form-item__control">
              <div class="phoenix-input"><input class="p-name26" type="text" placeholder="请输入"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form></body></html>`;
  const dom26 = new JSDOM(html26, { pretendToBeVisual: true });
  global.window = dom26.window;
  global.document = dom26.window.document;
  global.getComputedStyle = dom26.window.getComputedStyle.bind(dom26.window);
  global.Node = dom26.window.Node;
  global.HTMLInputElement = dom26.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom26.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom26.window.HTMLSelectElement;

  const p27 = defaultProfile();
  p27.personal = [{ 姓名: '倪睿', 证件号码: '120113200305070829' }];
  const report27 = await fillPage(p27, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });

  const doc28 = dom26.window.document;
  ok('身份证号填进真正的值输入框', doc28.querySelector('.id-no').value === '120113200305070829', doc28.querySelector('.id-no').value || '(空)');
  ok(
    '组件下拉的搜索框没被写成身份证号',
    doc28.querySelector('.phoenix-select_input').value === '身份证',
    doc28.querySelector('.phoenix-select_input').value || '(空)'
  );
  ok('同一区块的姓名照常填', doc28.querySelector('.p-name26').value === '倪睿', doc28.querySelector('.p-name26').value);
  ok('不再有 duplicate-slot', !report27.results.some(r => r.reason === 'duplicate-slot'), JSON.stringify(report27.results.map(r => r.reason)));
}

console.log('\n[27] 学位下拉：选项里有「双硕士」也不能把「硕士」判成歧义');
{
  // 真机截图的学位选项：无 / 学士 / 双学士 / 硕士 / 博士 / 双硕士 / MBA / EMBA。
  // "双硕士"因为**包含**"硕士"，得分 0.9533；精确命中的"硕士"是 1.0，
  // 差值 0.0467 < 0.05 的歧义阈值 → 被判成"多个选项都可能，未敢选"。
  // 学历之所以能填，是因为它的选项里没有别的项包含"硕士研究生"。
  const html27 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-part-body">
        <div class="fields-col">
          <div class="form-item form-item--phoenix">
            <div class="form-item__title form-item__title--right">学历</div>
            <div class="form-item__control">
              <span class="phoenix-select phoenix-select-editable phoenix-select--large lv-wrap">
                <span class="phoenix-select_califier"></span>
                <div class="phoenix-select_inputwrap"><input class="phoenix-select_input lv-in" placeholder="请选择" value="" type="text"></div>
                <div class="phoenix-unmodeled-layer" style="display:none">
                  <div class="phoenix-select-dropdown"><ul class="phoenix-select_content"></ul></div>
                </div>
              </span>
            </div>
          </div>
        </div>
        <div class="fields-col">
          <div class="form-item form-item--phoenix">
            <div class="form-item__title form-item__title--right">学位</div>
            <div class="form-item__control">
              <span class="phoenix-select phoenix-select-editable phoenix-select--large dg-wrap">
                <span class="phoenix-select_califier"></span>
                <div class="phoenix-select_inputwrap"><input class="phoenix-select_input dg-in" placeholder="请选择" value="" type="text"></div>
                <div class="phoenix-unmodeled-layer" style="display:none">
                  <div class="phoenix-select-dropdown"><ul class="phoenix-select_content"></ul></div>
                </div>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form></body></html>`;
  const dom27 = new JSDOM(html27, { pretendToBeVisual: true });
  global.window = dom27.window;
  global.document = dom27.window.document;
  global.getComputedStyle = dom27.window.getComputedStyle.bind(dom27.window);
  global.Node = dom27.window.Node;
  global.HTMLInputElement = dom27.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom27.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom27.window.HTMLSelectElement;

  const doc29 = dom27.window.document;
  const wire = (root, opts) => {
    const host = doc29.querySelector(root);
    const list = host.querySelector('.phoenix-select_content');
    const portal = host.querySelector('.phoenix-unmodeled-layer');
    const cal = host.querySelector('.phoenix-select_califier');
    const inp = host.querySelector('input');
    host.addEventListener('click', e => {
      const li = e.target && e.target.closest ? e.target.closest('li[role="option"]') : null;
      if (li) {
        cal.textContent = li.textContent;
        inp.value = li.textContent;
        portal.style.display = 'none';
        return;
      }
      if (!list.children.length) list.innerHTML = opts.map(o => `<li role="option">${o}</li>`).join('');
      portal.style.display = '';
    });
  };
  wire('.lv-wrap', ['大专', '本科', '硕士研究生', '博士']);
  wire('.dg-wrap', ['无', '学士', '双学士', '硕士', '博士', '双硕士', 'MBA', 'EMBA']);

  const p28 = defaultProfile();
  p28.education = [{ 学历: '硕士研究生', 学位: '硕士' }];
  const report28 = await fillPage(p28, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });

  ok('学位选到了「硕士」', doc29.querySelector('.dg-in').value === '硕士', doc29.querySelector('.dg-in').value || '(空)');
  ok('学历选到了「硕士研究生」', doc29.querySelector('.lv-in').value === '硕士研究生', doc29.querySelector('.lv-in').value || '(空)');
  const dg = report28.results.find(r => r.slot === 'edu.degreeName');
  ok('学位不是被判成歧义', dg && dg.status === 'filled', JSON.stringify(dg && { s: dg.status, r: dg.reason }));
}

console.log('\n[28] 资料库里存的是别名（职位）→ 网页标签写的是「职务」也要取到值');
{
  // 老记录 / 手改过键名的情况：{职位:'财务经理'}，而 schema 的 label 是「职务」。
  // 按 label 取不到就当作"没值"，现象是"职务填不上"，但值其实一直在。
  const html28 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">家庭情况</div>
      <div class="form-part-body">
        <div class="fields-col"><div class="form-item">
          <div class="form-item__title">姓名</div>
          <div class="form-item__control"><input class="f-name28" type="text"></div>
        </div></div>
        <div class="fields-col"><div class="form-item">
          <div class="form-item__title">职务</div>
          <div class="form-item__control"><input class="f-title28" type="text"></div>
        </div></div>
      </div>
    </div>
  </form></body></html>`;
  const dom28 = new JSDOM(html28, { pretendToBeVisual: true });
  global.window = dom28.window;
  global.document = dom28.window.document;
  global.getComputedStyle = dom28.window.getComputedStyle.bind(dom28.window);
  global.Node = dom28.window.Node;
  global.HTMLInputElement = dom28.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom28.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom28.window.HTMLSelectElement;

  const p29 = defaultProfile();
  p29.family = [{ 姓名: '倪旭祥', 职位: '财务经理' }]; // 注意：用的是别名「职位」
  const report29 = await fillPage(p29, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  const doc30 = dom28.window.document;
  ok('职务从别名「职位」取到了值', doc30.querySelector('.f-title28').value === '财务经理', doc30.querySelector('.f-title28').value || '(空)');
  const row = report29.results.find(r => r.slot === 'family.title');
  ok('报告里职务是已填', row && row.status === 'filled', JSON.stringify(row && { s: row.status, r: row.reason }));
}

console.log('\n[29] 自定义字段按记录取值：每条信息的同名字段各填各的值');
{
  // 用户要求：多条类目下加自定义字段，每条记录都有这个字段，但**内容独立**。
  // 老逻辑把"第一条记录的值"用于所有块 → 第二条记录的年龄段也被写成第一条的。
  const cell29 = (label, cls) => `
    <div class="fields-col"><div class="form-item">
      <div class="form-item__title">${label}</div>
      <div class="form-item__control"><input class="${cls}" type="text"></div>
    </div></div>`;
  // 每条记录 5 个字段 × 2 条 = 10 个，达到周期切分的下限（每段 ≥3 个字段）
  const famSeg = k => [
    cell29('姓名', `${k}-name`), cell29('与本人关系', `${k}-rel`),
    cell29('工作单位', `${k}-co`), cell29('职务', `${k}-title`), cell29('年龄段', `${k}-age`),
  ].join('');
  const html29 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">家庭情况</div>
      <div class="form-part-body">${famSeg('fa')}${famSeg('fb')}</div>
    </div>
  </form></body></html>`;
  const dom29 = new JSDOM(html29, { pretendToBeVisual: true });
  global.window = dom29.window;
  global.document = dom29.window.document;
  global.getComputedStyle = dom29.window.getComputedStyle.bind(dom29.window);
  global.Node = dom29.window.Node;
  global.HTMLInputElement = dom29.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom29.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom29.window.HTMLSelectElement;

  const p30 = defaultProfile();
  p30.family = [
    { 姓名: '倪旭祥', 与本人关系: '父女', 工作单位: '天津市宏鹏实业有限公司', 职务: '高级工程师', __custom: [{ name: '年龄段', value: '50-55岁' }] },
    { 姓名: '董少玥', 与本人关系: '母女', 工作单位: '无', 职务: '无', __custom: [{ name: '年龄段', value: '45-50岁' }] },
  ];
  const report30 = await fillPage(p30, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  const doc31 = dom29.window.document;
  ok('第 1 条的年龄段用自己的值', doc31.querySelector('.fa-age').value === '50-55岁', doc31.querySelector('.fa-age').value || '(空)');
  ok('第 2 条的年龄段用自己的值（不再被第一条顶掉）', doc31.querySelector('.fb-age').value === '45-50岁', doc31.querySelector('.fb-age').value || '(空)');
  ok('两条的姓名照常填', doc31.querySelector('.fa-name').value === '倪旭祥' && doc31.querySelector('.fb-name').value === '董少玥',
    doc31.querySelector('.fa-name').value + '/' + doc31.querySelector('.fb-name').value);
  ok('两条的职务照常填', doc31.querySelector('.fa-title').value === '高级工程师' && doc31.querySelector('.fb-title').value === '无',
    doc31.querySelector('.fa-title').value + '/' + doc31.querySelector('.fb-title').value);
  ok('报告里两条自定义都是已填',
    report30.results.filter(r => String(r.slot || '').includes('年龄段')).every(r => r.status === 'filled'),
    JSON.stringify(report30.results.map(r => ({ s: r.slot, st: r.status }))));
}

console.log('\n[30] 内置字段被当成自定义字段填过（值在 __custom 里）→ 也要取到');
{
  // 真机推断：用户在家庭情况里用"自定义字段"填过「职务」，
  // 撞名规则会把这条自定义候选丢掉（不丢会让同一标签命中两个槽），
  // 但**值本身是用户认真填的**，不该跟着丢 → 职务看起来"填不上"。
  const html30 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">家庭情况</div>
      <div class="form-part-body">
        <div class="fields-col"><div class="form-item">
          <div class="form-item__title">姓名</div>
          <div class="form-item__control"><input class="f30-name" type="text"></div>
        </div></div>
        <div class="fields-col"><div class="form-item">
          <div class="form-item__title">职务</div>
          <div class="form-item__control"><input class="f30-title" type="text"></div>
        </div></div>
      </div>
    </div>
  </form></body></html>`;
  const dom30 = new JSDOM(html30, { pretendToBeVisual: true });
  global.window = dom30.window;
  global.document = dom30.window.document;
  global.getComputedStyle = dom30.window.getComputedStyle.bind(dom30.window);
  global.Node = dom30.window.Node;
  global.HTMLInputElement = dom30.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom30.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom30.window.HTMLSelectElement;

  const p31 = defaultProfile();
  p31.family = [{ 姓名: '倪旭祥', __custom: [{ name: '职务', value: '高级工程师' }] }];
  const report31 = await fillPage(p31, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  const doc32 = dom30.window.document;
  ok('职务从 __custom 里取到了值', doc32.querySelector('.f30-title').value === '高级工程师', doc32.querySelector('.f30-title').value || '(空)');
  const row = report31.results.find(r => r.slot === 'family.title');
  ok('报告里职务是已填', row && row.status === 'filled', JSON.stringify(row && { s: row.status, r: row.reason }));
}

console.log('\n[31] 无标题杂项区块里的同名字段不得抢走正式区块的槽');
{
  // 真机诊断证据：页面顶部一个无标题的杂项组件（styled-components 类名）里也有
  // 「职务」输入框，它文档顺序靠前、先被写并占住了 family.title；
  // 真正的家庭情况第 1 条反而撞重复被跳过 —— 诊断里那条计划压根不出现。
  const cell31 = (label, cls) => `
    <div class="fields-col"><div class="form-item">
      <div class="form-item__title">${label}</div>
      <div class="form-item__control"><input class="${cls}" type="text"></div>
    </div></div>`;
  const famSeg = k => [
    cell31('姓名', `${k}-name`), cell31('与本人关系', `${k}-rel`),
    cell31('工作单位', `${k}-co`), cell31('职务', `${k}-title`), cell31('工作所在地', `${k}-loc`),
  ].join('');
  const html31 = `<!doctype html><html><body><form>
    <div class="sc-junk"><div class="sc-inner">
      <label class="form-label">职务</label><input class="junk-title" type="text">
    </div></div>
    <div class="card">
      <div class="section-title">家庭情况</div>
      <div class="form-part-body">${famSeg('fa')}${famSeg('fb')}</div>
    </div>
  </form></body></html>`;
  const dom31 = new JSDOM(html31, { pretendToBeVisual: true });
  global.window = dom31.window;
  global.document = dom31.window.document;
  global.getComputedStyle = dom31.window.getComputedStyle.bind(dom31.window);
  global.Node = dom31.window.Node;
  global.HTMLInputElement = dom31.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom31.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom31.window.HTMLSelectElement;

  const p32 = defaultProfile();
  p32.family = [
    { 姓名: '倪旭祥', 与本人关系: '父女', 工作单位: '天津市宏鹏实业有限公司', 职务: '财务', 工作所在地: '天津市' },
    { 姓名: '董少玥', 与本人关系: '母女', 工作单位: '无', 职务: '无', 工作所在地: '天津市' },
  ];
  const report32 = await fillPage(p32, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  const doc33 = dom31.window.document;
  ok('家庭情况第 1 条的职务填上了', doc33.querySelector('.fa-title').value === '财务', doc33.querySelector('.fa-title').value || '(空)');
  ok('家庭情况第 2 条的职务填上了', doc33.querySelector('.fb-title').value === '无', doc33.querySelector('.fb-title').value || '(空)');
  ok('杂项区块里的职务输入框没被写', doc33.querySelector('.junk-title').value === '', doc33.querySelector('.junk-title').value || '(空)');
  const junk = report32.results.find(r => String(r.path || '').includes('junk') || (r.label === '职务' && r.status !== 'filled'));
  ok('杂项那条在报告里是跳过（duplicate-slot）或不存在', !junk || junk.reason === 'duplicate-slot', JSON.stringify(junk && { s: junk.status, r: junk.reason }));
}

console.log('\n[32] 文本框写入后被站点清空 → 收尾复核会重写一次');
{
  // 真机证据：证件号码 status=filled、readback 正确，但页面上几秒后是空的 ——
  // 站点在后续重渲染里把没走它自己状态的控件清了。这里模拟：B 被写时 A 被清空。
  const html32 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">证件号码</label><input class="a32" type="text"></div>
      <div class="form-item"><label class="form-label">邮箱</label><input class="b32" type="text"></div>
    </div>
  </form></body></html>`;
  const dom32 = new JSDOM(html32, { pretendToBeVisual: true });
  global.window = dom32.window;
  global.document = dom32.window.document;
  global.getComputedStyle = dom32.window.getComputedStyle.bind(dom32.window);
  global.Node = dom32.window.Node;
  global.HTMLInputElement = dom32.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom32.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom32.window.HTMLSelectElement;

  const doc34 = dom32.window.document;
  const a = doc34.querySelector('.a32');
  // 模拟站点行为：往邮箱写值的重渲染把证件号码清掉
  doc34.querySelector('.b32').addEventListener('input', () => {
    a.value = '';
  });

  const p33 = defaultProfile();
  p33.personal = [{ 证件号码: '120113200305070829', 邮箱: 'nirui57@126.com' }];
  const report33 = await fillPage(p33, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('证件号码最终还在（被清空后重写成功）', a.value === '120113200305070829', a.value || '(空)');
  const row = report33.results.find(r => r.slot === 'personal.idNo');
  ok('报告记了恢复标记', row && row.status === 'filled' && row.note === 'recovered-after-clear', JSON.stringify(row && { s: row.status, n: row.note }));
  ok('邮箱照常填', doc34.querySelector('.b32').value === 'nirui57@126.com', doc34.querySelector('.b32').value);
}

console.log('\n[33] 年月下拉面板（只有「2026年 10月」头，无日格子）→ 点年点月写入');
{
  const html33 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-item"><label class="form-label">开始时间</label>
        <div class="phoenix-date-picker">
          <input class="d33" type="text" placeholder="请选择" readonly>
          <div class="phoenix-calendar-panel" style="display:none">
            <span class="phoenix-calendar-ym-select">2026年 10月</span>
            <ul class="ym-list" style="display:none"></ul>
          </div>
        </div>
      </div>
      <div class="form-item"><label class="form-label">学校名称</label><input class="s33" type="text"></div>
    </div>
  </form></body></html>`;
  const dom33 = new JSDOM(html33, { pretendToBeVisual: true });
  global.window = dom33.window;
  global.document = dom33.window.document;
  global.getComputedStyle = dom33.window.getComputedStyle.bind(dom33.window);
  global.Node = dom33.window.Node;
  global.HTMLInputElement = dom33.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom33.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom33.window.HTMLSelectElement;

  const doc35 = dom33.window.document;
  // 复刻 phoenix 年月面板的行为
  const inp = doc35.querySelector('.d33');
  const panelEl = doc35.querySelector('.phoenix-calendar-panel');
  const head = doc35.querySelector('.phoenix-calendar-ym-select');
  const list = doc35.querySelector('.ym-list');
  let selYear = 2026;
  inp.addEventListener('click', () => {
    panelEl.style.display = '';
  });
  head.addEventListener('click', () => {
    if (!list.children.length) {
      const ys = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
      const ms = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      list.innerHTML =
        ys.map(y => `<li class="ym-year">${y}</li>`).join('') +
        ms.map(m => `<li class="ym-month">${m}月</li>`).join('');
    }
    list.style.display = '';
  });
  list.addEventListener('click', e => {
    const li = e.target && e.target.closest ? e.target.closest('li') : null;
    if (!li) return;
    const t = li.textContent.trim();
    if (/^\d{4}$/.test(t)) {
      selYear = Number(t);
      head.textContent = `${selYear}年 10月`;
      return;
    }
    const m = Number(String(t).replace('月', ''));
    inp.value = `${selYear}-${String(m).padStart(2, '0')}`;
    list.style.display = 'none';
    panelEl.style.display = 'none';
  });

  const p34 = defaultProfile();
  p34.education = [{ 开始时间: '2025-09-01', 学校名称: '香港城市大学' }];
  const report34 = await fillPage(p34, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('年月面板点选写入了 2025-09', inp.value === '2025-09', inp.value || '(空)');
  const row = report34.results.find(r => r.slot === 'edu.start');
  ok('按月粒度收工并标注降级', row && row.status === 'filled' && (row.downgraded === 'month' || String(row.via).includes('ym')),
    JSON.stringify(row && { s: row.status, v: row.via, d: row.downgraded }));
  ok('学校名称照常填', doc35.querySelector('.s33').value === '香港城市大学', doc35.querySelector('.s33').value || '(空)');
}

console.log('\n[34] 站点反复清空文本框 → 收尾复核最多重试 3 次，最终能救回来');
{
  // 真机：证件号码写入成功、回读成功，几秒后被站点清空；v2.0.27 收尾复核重写一次
  // 仍被清（cleared-by-site）。这里模拟"前两次 change 都被站点清掉、第三次才认"，
  // 验证最多 3 次重试能把它救回来。
  const html34 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">证件号码</label><input class="a34" type="text"></div>
      <div class="form-item"><label class="form-label">邮箱</label><input class="b34" type="text"></div>
    </div>
  </form></body></html>`;
  const dom34 = new JSDOM(html34, { pretendToBeVisual: true });
  global.window = dom34.window;
  global.document = dom34.window.document;
  global.getComputedStyle = dom34.window.getComputedStyle.bind(dom34.window);
  global.Node = dom34.window.Node;
  global.HTMLInputElement = dom34.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom34.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom34.window.HTMLSelectElement;

  const doc36 = dom34.window.document;
  const a = doc36.querySelector('.a34');
  const b = doc36.querySelector('.b34');
  // ① 写邮箱的重渲染把证件号码清掉（和 [32] 同款）
  b.addEventListener('input', () => { a.value = ''; });
  // ② 证件号码自己被改写（change）时，前两次也被站点清掉，第三次才认
  let clears = 0;
  a.addEventListener('change', () => { clears++; if (clears <= 2) a.value = ''; });

  const p35 = defaultProfile();
  p35.personal = [{ 证件号码: '120113200305070829', 邮箱: 'nirui57@126.com' }];
  const report35 = await fillPage(p35, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('被反复清空后最终重写成功', a.value === '120113200305070829', a.value || '(空)');
  const row = report35.results.find(r => r.slot === 'personal.idNo');
  ok('报告记了恢复标记', row && row.status === 'filled' && row.note === 'recovered-after-clear',
    JSON.stringify(row && { s: row.status, n: row.note, reason: row.reason }));
}

console.log('\n[35] 站点一直清空（3 次都救不回）→ 如实报 cleared-by-site，不假装成功');
{
  const html35 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">证件号码</label><input class="a35" type="text"></div>
      <div class="form-item"><label class="form-label">邮箱</label><input class="b35" type="text"></div>
    </div>
  </form></body></html>`;
  const dom35 = new JSDOM(html35, { pretendToBeVisual: true });
  global.window = dom35.window;
  global.document = dom35.window.document;
  global.getComputedStyle = dom35.window.getComputedStyle.bind(dom35.window);
  global.Node = dom35.window.Node;
  global.HTMLInputElement = dom35.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom35.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom35.window.HTMLSelectElement;

  const doc37 = dom35.window.document;
  const a = doc37.querySelector('.a35');
  const b = doc37.querySelector('.b35');
  b.addEventListener('input', () => { a.value = ''; });
  a.addEventListener('change', () => { a.value = ''; }); // 永远清掉，绝不认

  const p36 = defaultProfile();
  p36.personal = [{ 证件号码: '120113200305070829', 邮箱: 'nirui57@126.com' }];
  const report36 = await fillPage(p36, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('控件最终为空', a.value === '', a.value || '(空)');
  const row = report36.results.find(r => r.slot === 'personal.idNo');
  ok('报告如实报 cleared-by-site', row && row.status === 'failed' && row.reason === 'cleared-by-site',
    JSON.stringify(row && { s: row.status, reason: row.reason }));
}

/** 复刻 phoenix 年月下拉面板：head 是「2026年/10月」两个子 span（真机形态），点列表项提交 */
function mountYmPanel36(doc, years = [2024, 2025, 2026, 2027]) {
  const inp = doc.querySelector('.d36');
  const panelEl = doc.querySelector('.phoenix-calendar-panel');
  const head = doc.querySelector('.phoenix-calendar-ym-select');
  const list = doc.querySelector('.ym-list');
  let selYear = 2026;
  let selMonth = 10;
  inp.addEventListener('click', () => {
    panelEl.style.display = '';
  });
  head.addEventListener('click', () => {
    if (!list.children.length) {
      const ms = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      list.innerHTML =
        years.map(y => `<li class="ym-year">${y}</li>`).join('') +
        ms.map(m => `<li class="ym-month">${m}月</li>`).join('');
    }
    list.style.display = '';
  });
  list.addEventListener('click', e => {
    const li = e.target && e.target.closest ? e.target.closest('li') : null;
    if (!li) return;
    const t = li.textContent.trim();
    if (/^\d{4}$/.test(t)) {
      selYear = Number(t);
      head.innerHTML = `<span>${selYear}年</span><span>${selMonth}月</span>`;
      return;
    }
    selMonth = Number(String(t).replace('月', ''));
    inp.value = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    list.style.display = 'none';
    panelEl.style.display = 'none';
  });
  return { inp, panelEl, head, list };
}

const YM_HTML = `<!doctype html><html><body><form>
  <div class="card">
    <div class="section-title">教育经历</div>
    <div class="form-item"><label class="form-label">结束时间</label>
      <div class="phoenix-date-picker">
        <input class="d36" type="text" placeholder="请选择" readonly>
        <div class="phoenix-calendar-panel" style="display:none">
          <span class="phoenix-calendar-ym-select"><span>2026年</span><span>10月</span></span>
          <ul class="ym-list" style="display:none"></ul>
        </div>
      </div>
    </div>
    <div class="form-item"><label class="form-label">学校名称</label><input class="s36" type="text"></div>
  </div>
</form></body></html>`;

const YM_GLOBALS = dom => {
  global.window = dom.window;
  global.document = dom.window.document;
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  global.Node = dom.window.Node;
  global.HTMLInputElement = dom.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom.window.HTMLSelectElement;
};

console.log('\n[36] 年月下拉头被拆成「2026年」「10月」两个子 span（真机形态）→ 必须点列表项，不能点头部');
{
  const dom36 = new JSDOM(YM_HTML, { pretendToBeVisual: true });
  YM_GLOBALS(dom36);
  const doc38 = dom36.window.document;
  const { inp, head } = mountYmPanel36(doc38);
  // 头部子 span 的文字恰好能匹配年/月正则：旧逻辑会点到头部（开合下拉），永远选不中
  const headSpans = [...head.querySelectorAll('span')];
  ok('头部确实有两个子 span（复刻真机）', headSpans.length === 2, String(headSpans.length));

  const p37 = defaultProfile();
  p37.education = [{ 结束时间: '2026-10-02', 学校名称: '香港城市大学' }];
  const report37 = await fillPage(p37, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('结束时间写入了 2026-10（点的是列表项不是头部）', inp.value === '2026-10', inp.value || '(空)');
  const row = report37.results.find(r => r.slot === 'edu.end');
  ok('报告按填充收工', row && row.status === 'filled',
    JSON.stringify(row && { s: row.status, a: row.attempts }));
  ok('学校名称照常填', doc38.querySelector('.s36').value === '香港城市大学', doc38.querySelector('.s36').value || '(空)');
}

console.log('\n[37] 年列表是虚拟滚动（初始只有 2024/2026/2027）→ 滚动列表找到 2025 再点');
{
  const dom37 = new JSDOM(YM_HTML, { pretendToBeVisual: true });
  YM_GLOBALS(dom37);
  const doc39 = dom37.window.document;
  // 年列表不含 2025（模拟虚拟滚动只渲染可视窗口）
  const mounted = mountYmPanel36(doc39, [2024, 2026, 2027]);
  const list = mounted.list;
  Object.defineProperty(list, 'scrollHeight', { value: 900, configurable: true });
  Object.defineProperty(list, 'clientHeight', { value: 300, configurable: true });
  Object.defineProperty(list, 'scrollTop', {
    get() { return this._st || 0; },
    set() {
      if (!this._loaded) {
        this._loaded = true;
        const li = doc39.createElement('li');
        li.className = 'ym-year';
        li.textContent = '2025';
        list.insertBefore(li, list.firstChild);
      }
    },
    configurable: true,
  });

  const p38 = defaultProfile();
  p38.education = [{ 结束时间: '2025-09-01', 学校名称: '香港城市大学' }];
  const report38 = await fillPage(p38, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('滚动后找到 2025 并写入 2025-09', mounted.inp.value === '2025-09', mounted.inp.value || '(空)');
  const row = report38.results.find(r => r.slot === 'edu.end');
  ok('按填充收工且标注降级', row && row.status === 'filled' && (row.downgraded === 'month' || String(row.via || '').includes('ym')),
    JSON.stringify(row && { s: row.status, v: row.via, a: row.attempts }));
}

console.log('\n[38] 一块里塞了两段经历（尾部挂一对自定义单选组）→ 按标签周期切开，两段都填');
{
  // 真机形态（诊断 JSON）：教育经历 12 个字段全在同一父容器，
  // 顺序 = [开始,结束,学校,专业,学历]×2 + [是否统招(自定义 radio)]×2 挂尾部。
  // 旧逻辑因尾巴只有 2 个字段拒切 → 第 2 段全部 duplicate-slot。
  const html40 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="edu-all">
        <div class="form-item"><label class="form-label">开始时间</label><input class="s38a" type="text"></div>
        <div class="form-item"><label class="form-label">结束时间</label><input class="e38a" type="text"></div>
        <div class="form-item"><label class="form-label">学校名称</label><input class="sc38a" type="text"></div>
        <div class="form-item"><label class="form-label">专业名称</label><input class="mj38a" type="text"></div>
        <div class="form-item"><label class="form-label">学历</label><input class="dg38a" type="text"></div>
        <div class="form-item"><label class="form-label">开始时间</label><input class="s38b" type="text"></div>
        <div class="form-item"><label class="form-label">结束时间</label><input class="e38b" type="text"></div>
        <div class="form-item"><label class="form-label">学校名称</label><input class="sc38b" type="text"></div>
        <div class="form-item"><label class="form-label">专业名称</label><input class="mj38b" type="text"></div>
        <div class="form-item"><label class="form-label">学历</label><input class="dg38b" type="text"></div>
        <div class="form-item"><label class="form-label">是否统招</label>
          <div class="phoenix-radio-group">
            <div class="phoenix-radio"><div class="phoenix-radio__circle"></div>是</div>
            <div class="phoenix-radio"><div class="phoenix-radio__circle"></div>否</div>
          </div>
        </div>
        <div class="form-item"><label class="form-label">是否统招</label>
          <div class="phoenix-radio-group">
            <div class="phoenix-radio"><div class="phoenix-radio__circle"></div>是</div>
            <div class="phoenix-radio"><div class="phoenix-radio__circle"></div>否</div>
          </div>
        </div>
      </div>
    </div>
  </form></body></html>`;
  const dom38 = new JSDOM(html40, { pretendToBeVisual: true });
  YM_GLOBALS(dom38);
  const doc40 = dom38.window.document;

  const p39 = defaultProfile();
  p39.education = [
    { 开始时间: '2021-09-01', 结束时间: '2025-06-30', 学校名称: '天津大学', 专业名称: '金融数学', 学历: '本科' },
    { 开始时间: '2025-09-01', 结束时间: '2026-10-02', 学校名称: '香港城市大学', 专业名称: '商业及数据分析', 学历: '硕士研究生' },
  ];
  const report39 = await fillPage(p39, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('第 1 段学校填上', doc40.querySelector('.sc38a').value === '天津大学', doc40.querySelector('.sc38a').value || '(空)');
  ok('第 2 段学校填上（不再被 duplicate-slot 整段跳过）', doc40.querySelector('.sc38b').value === '香港城市大学', doc40.querySelector('.sc38b').value || '(空)');
  ok('第 2 段专业填上', doc40.querySelector('.mj38b').value === '商业及数据分析', doc40.querySelector('.mj38b').value || '(空)');
  const dups = report39.results.filter(r => r.categoryId === 'education' && r.reason === 'duplicate-slot');
  ok('教育经历不再出现 duplicate-slot', dups.length === 0, JSON.stringify(dups.map(d => d.label)));
}

console.log('\n[39] 日历面板根识别：真根含日格子 + 头部 span 也命中 PANEL_SEL → 按年月日写入，不降级不串年份');
{
  // 真机（诊断 JSON）：<div.phoenix-calendar-panel>（真根：header + 日格子）
  //   > <span.phoenix-calendar-ym-select>（头部「2026年/10月」）
  // 两个类名都命中 PANEL_SEL。旧排序把头部 span 选成面板根 → 日格子探测不到 → 只能走年月下拉，
  // 站点把月选择自动落成 10 号（2026-10-02 → 2026-10-10）。修复后应直接按年月日写入。
  const days39 = Array.from({ length: 31 }, (_, i) => `<div class="cal-day">${i + 1}</div>`).join('');
  const html39 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">教育经历</div>
      <div class="form-item"><label class="form-label">结束时间</label>
        <div class="phoenix-date-picker">
          <input class="d39" type="text" placeholder="请选择" readonly>
          <div class="phoenix-calendar-panel" style="display:none">
            <span class="phoenix-calendar-ym-select"><span>2026年</span><span>10月</span></span>
            <div class="cal-days">${days39}</div>
          </div>
        </div>
      </div>
      <div class="form-item"><label class="form-label">学校名称</label><input class="s39" type="text"></div>
    </div>
  </form></body></html>`;
  const dom39 = new JSDOM(html39, { pretendToBeVisual: true });
  YM_GLOBALS(dom39);
  const doc39d = dom39.window.document;
  const inp39 = doc39d.querySelector('.d39');
  const panel39 = doc39d.querySelector('.phoenix-calendar-panel');
  inp39.addEventListener('click', () => { panel39.style.display = ''; });
  panel39.querySelectorAll('.cal-day').forEach(cell => {
    cell.addEventListener('click', () => {
      inp39.value = '2026-10-' + String(cell.textContent).padStart(2, '0');
      panel39.style.display = 'none';
    });
  });

  const p40 = defaultProfile();
  p40.education = [{ 结束时间: '2026-10-02', 学校名称: '香港城市大学' }];
  const report40 = await fillPage(p40, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('结束时间按年月日写入（不是年月、没串成 10 号）', inp39.value === '2026-10-02', inp39.value || '(空)');
  const row39 = report40.results.find(r => r.slot === 'edu.end');
  ok('报告走的是日面板路径、未降级', row39 && row39.status === 'filled' && row39.via === 'panel' && !row39.downgraded,
    JSON.stringify(row39 && { s: row39.status, v: row39.via, d: row39.downgraded, a: row39.attempts }));
  ok('尝试链路里点了日格子', row39 && (row39.attempts || []).some(a => String(a).includes('day:ok')),
    JSON.stringify(row39 && row39.attempts));
  ok('学校名称照常填', doc39d.querySelector('.s39').value === '香港城市大学', doc39d.querySelector('.s39').value || '(空)');
}

console.log('\n[40] 站点延迟清空（恢复后 450ms 内二次清）→ 观察确认 + 继续重试救回');
{
  // 真机：证件号码恢复后，站点不是当场清、而是过 100ms 再清。旧逻辑恢复后立刻收工，
  // 第二次清空把值吃掉 → 报告 recovered-after-clear、页面却是空的。修复后恢复要观察 450ms，
  // 期间被二次清掉就当作没恢复继续重试。
  const html40 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">证件号码</label><input class="a40" type="text"></div>
      <div class="form-item"><label class="form-label">邮箱</label><input class="b40" type="text"></div>
    </div>
  </form></body></html>`;
  const dom40 = new JSDOM(html40, { pretendToBeVisual: true });
  YM_GLOBALS(dom40);
  const doc40d = dom40.window.document;
  const a40 = doc40d.querySelector('.a40');
  const b40 = doc40d.querySelector('.b40');
  b40.addEventListener('input', () => { a40.value = ''; });
  let clears40 = 0;
  a40.addEventListener('change', () => { clears40++; if (clears40 <= 2) setTimeout(() => { a40.value = ''; }, 100); });

  const p41 = defaultProfile();
  p41.personal = [{ 证件号码: '120113200305070829', 邮箱: 'nirui57@126.com' }];
  const report41 = await fillPage(p41, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('延迟二次清空仍被救回', a40.value === '120113200305070829', a40.value || '(空)');
  const row40 = report41.results.find(r => r.slot === 'personal.idNo');
  ok('报告记了恢复标记', row40 && row40.status === 'filled' && row40.note === 'recovered-after-clear',
    JSON.stringify(row40 && { s: row40.status, n: row40.note, reason: row40.reason }));
}

console.log('\n[41] 站点连续清空 4 次（超出第一轮 4 次重试）→ 延迟 1.2s 第二轮救回');
{
  // 第一轮最多重试 4 次，站点前 4 次 change 都清空；第 5 次（延迟第二轮）才认。
  // 没有"延迟 1.2s 第二轮"时，第一轮 4 次全失败会如实报 cleared-by-site 且页面为空。
  const html41 = `<!doctype html><html><body><form>
    <div class="card">
      <div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">证件号码</label><input class="a41" type="text"></div>
      <div class="form-item"><label class="form-label">邮箱</label><input class="b41" type="text"></div>
    </div>
  </form></body></html>`;
  const dom41 = new JSDOM(html41, { pretendToBeVisual: true });
  YM_GLOBALS(dom41);
  const doc41d = dom41.window.document;
  const a41 = doc41d.querySelector('.a41');
  const b41 = doc41d.querySelector('.b41');
  b41.addEventListener('input', () => { a41.value = ''; });
  let clears41 = 0;
  a41.addEventListener('change', () => { clears41++; if (clears41 <= 4) a41.value = ''; });

  const p42 = defaultProfile();
  p42.personal = [{ 证件号码: '120113200305070829', 邮箱: 'nirui57@126.com' }];
  const report42 = await fillPage(p42, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  ok('超出第一轮重试次数后，延迟第二轮仍救回', a41.value === '120113200305070829', a41.value || '(空)');
  const row41 = report42.results.find(r => r.slot === 'personal.idNo');
  ok('报告最终是恢复成功（不是 cleared-by-site）', row41 && row41.status === 'filled' && row41.note === 'recovered-after-clear',
    JSON.stringify(row41 && { s: row41.status, n: row41.note, reason: row41.reason }));
}

// 年月选择器（phoenix-date-picker 年月模式）复刻：标题「YYYY年/M月」+ 月份列表（缺当前月）+「本月」。
// 年份列表不在 DOM 里，点「年份标签」才动态渲染；点年份 → 更新标题、移除列表；点月份/「本月」→ 提交。
// opts.realMode（2.0.32 真机证据）：「本月」只是导航**不落值**；月份列表动态渲染，
// 缺的是「当前视图月」（点了 9 月重开后，列表缺 9 月、含 10 月）——只有列表项点选才提交。
function mountYmSelector(doc, cls, selYear = 2026, selMonth = 10, opts = {}) {
  const realMode = !!opts.realMode;
  const inp = doc.querySelector('.' + cls);
  const panel = doc.querySelector('.phoenix-calendar-panel');
  const head = doc.querySelector('.phoenix-calendar-ym-select');
  const yearLabel = doc.querySelector('.ym-year-label');
  const monthLabel = doc.querySelector('.ym-month-label');
  const monthList = doc.querySelector('.month-list');
  const state = { year: selYear, month: selMonth };

  const renderMonths = () => {
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(m => m !== state.month);
    monthList.innerHTML =
      months.map(m => `<span class="month-item">${m}月</span>`).join('') +
      '<span class="month-item month-this">本月</span>';
  };
  renderMonths();

  const commit = () => {
    inp.value = `${state.year}-${String(state.month).padStart(2, '0')}`;
    renderMonths();
    panel.style.display = 'none';
  };

  inp.addEventListener('click', () => {
    renderMonths();
    panel.style.display = '';
  });
  // 真实日历：点「完整年月标题」不切视图（driveYmPanel 点头部无效）
  head.addEventListener('click', () => {});
  // 点年份标签 → 动态渲染年份列表（切到年份视图）
  yearLabel.addEventListener('click', () => {
    if (panel.querySelector('.year-list')) return;
    const yearList = doc.createElement('div');
    yearList.className = 'year-list';
    yearList.innerHTML = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]
      .map(y => `<span class="year-item">${y}</span>`)
      .join('');
    panel.appendChild(yearList);
    yearList.addEventListener('click', e => {
      const it = e.target && e.target.closest ? e.target.closest('.year-item') : null;
      if (!it) return;
      state.year = Number(it.textContent);
      yearLabel.textContent = state.year + '年';
      // 真实日历：点完年份停在年份视图，不自动回月份视图
    });
  });
  // 点标题月份标签 → 移除年份列表，切回月份视图
  monthLabel.addEventListener('click', () => {
    const yearList = panel.querySelector('.year-list');
    if (yearList) yearList.remove();
  });
  // 点月份 → 提交并关面板；「本月」仅 old 模式提交（真机上它只是导航，不落值）
  monthList.addEventListener('click', e => {
    const it = e.target && e.target.closest ? e.target.closest('.month-item') : null;
    if (!it) return;
    if (it.classList.contains('month-this')) {
      if (!realMode) commit();
      return;
    }
    state.month = Number(it.textContent.replace('月', ''));
    monthLabel.textContent = state.month + '月';
    commit();
  });
  return { inp, state };
}

const YM_SELECTOR_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12]; // 缺当前月 10
function ymSelectorHtml(cls) {
  return `
    <div class="phoenix-date-picker">
      <input class="${cls}" type="text" readonly placeholder="请选择">
      <div class="phoenix-calendar-panel" style="display:none">
        <span class="phoenix-calendar-ym-select">
          <span class="ym-year-label">2026年</span>
          <span class="ym-month-label">10月</span>
        </span>
        <div class="month-list">
          ${YM_SELECTOR_MONTHS.map(m => `<span class="month-item">${m}月</span>`).join('')}
          <span class="month-item month-this">本月</span>
        </div>
      </div>
    </div>`;
}

console.log('\n[42] 年月选择器（无日格子，月份列表缺当前月）→ 点年/点月/点本月写入');
{
  // 真机（诊断 16 个 date-failed）：经历类日期是「年月选择器」——面板打开就是
  // 标题 + 月份列表（缺当前月，因为已选中态不在可选列表），点标题年份切年份视图点年。
  // 旧 driveYmPanel 点头部展开列表的假设不成立：ym-year:fail（点年失败）或
  // ym-month:fail（目标月=当前月，列表里没这个月）。修复后应降级按月写入。
  const runCase = async (endVal, expected, opts) => {
    const html42 = `<!doctype html><html><body><form>
      <div class="card">
        <div class="section-title">教育经历</div>
        <div class="form-item"><label class="form-label">结束时间</label>${ymSelectorHtml('d42')}</div>
        <div class="form-item"><label class="form-label">学校名称</label><input class="s42" type="text"></div>
      </div>
    </form></body></html>`;
    const dom42 = new JSDOM(html42, { pretendToBeVisual: true });
    YM_GLOBALS(dom42);
    const doc42d = dom42.window.document;
    const { inp } = mountYmSelector(doc42d, 'd42', 2026, 10, opts || {});

    const p43 = defaultProfile();
    p43.education = [{ 结束时间: endVal, 学校名称: '香港城市大学' }];
    const report43 = await fillPage(p43, {
      bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
      expand: false,
    });
    const row = report43.results.find(r => r.slot === 'edu.end');
    return { inp, row };
  };

  // 场景 B：目标月 = 当前月（2026-10），月份列表缺 10 月 → 靠「本月」提交（旧组件行为）
  const b = await runCase('2026-10-02', '2026-10');
  ok('场景B（目标月=当前月）按年月写入', b.inp.value === '2026-10', b.inp.value || '(空)');
  ok('场景B 报告按年月降级收工', b.row && b.row.status === 'filled' && b.row.downgraded === 'month',
    JSON.stringify(b.row && { s: b.row.status, v: b.row.via, d: b.row.downgraded, a: b.row.attempts }));

  // 场景 A：目标年 ≠ 当前年（2025-09），先点年再点月
  const a = await runCase('2025-09-01', '2025-09');
  ok('场景A（目标年≠当前年）按年月写入', a.inp.value === '2025-09', a.inp.value || '(空)');
  ok('场景A 报告按年月降级收工', a.row && a.row.status === 'filled' && a.row.downgraded === 'month',
    JSON.stringify(a.row && { s: a.row.status, v: a.row.via, d: a.row.downgraded, a: a.row.attempts }));

  // 场景 C（2.0.32 真机证据）：「本月」不落值（只是导航），点月才提交 →
  // already + 本月是假成功，必须走「中间月跳板」：点 9 月提交关面板 → 重开
  // （列表缺 9 月、含 10 月）→ 点 10 月提交。最终落 2026-10。
  const c = await runCase('2026-10-02', '2026-10', { realMode: true });
  ok('场景C（真机：本月不落值）中间月跳板落上 2026-10', c.inp.value === '2026-10', c.inp.value || '(空)');
  ok('场景C 报告按年月降级收工', c.row && c.row.status === 'filled' && c.row.downgraded === 'month',
    JSON.stringify(c.row && { s: c.row.status, v: c.row.via, d: c.row.downgraded, a: c.row.attempts }));

  // 场景 D（真机第二模式）：realMode + 目标年≠当前年（2025-09），点年 + 点月一次到位
  const d = await runCase('2025-09-01', '2025-09', { realMode: true });
  ok('场景D（真机：目标年≠当前年）按年月写入', d.inp.value === '2025-09', d.inp.value || '(空)');
  ok('场景D 报告按年月降级收工', d.row && d.row.status === 'filled' && d.row.downgraded === 'month',
    JSON.stringify(d.row && { s: d.row.status, v: d.row.via, d: d.row.downgraded, a: d.row.attempts }));
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
