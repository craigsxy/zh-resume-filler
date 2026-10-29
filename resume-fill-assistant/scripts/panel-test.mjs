// 侧边栏 UI 仿真：**不做任何选择交互**，枚举字段也是普通输入框，由用户自己填
// 场景来源：用户 2026-10-22 反馈"插件中不做选择了，全部改成让用户自己填写字段"
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

// 只取 body 骨架，不执行 script（panel 逻辑由后面 import 源码执行）
const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.CSS = dom.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

// 最小 chrome 桩：只用到 storage.local
let stored = {
  resumeProfile: {
    schemaVersion: 2,
    personal: [{ 性别: '女', 政治面貌: '共青团员', 民族: '汉族' }],
    education: [],
  },
};
global.chrome = {
  storage: {
    local: {
      get: async k => ({ [k]: stored[k] }),
      set: async obj => Object.assign(stored, obj),
    },
  },
};

const panelMod = await import('../src/panel/index.js');
await new Promise(r => setTimeout(r, 30));

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

const fieldOf = label => {
  const all = [...document.querySelectorAll('#records .field')];
  return all.find(f => {
    const l = f.querySelector('label');
    return l && String(l.textContent || '').startsWith(label);
  });
};
const inputOf = label => {
  const f = fieldOf(label);
  return f && f.querySelector('input,textarea');
};

console.log('\n[1] 所有字段都只是输入框，没有任何"选择"控件');
{
  ok('能找到"性别"字段', !!fieldOf('性别'));
  ok('性别就是普通文本框', inputOf('性别') && inputOf('性别').type === 'text', inputOf('性别') && inputOf('性别').type);
  ok('没有下拉按钮', !document.querySelector('.enum-caret'));
  ok('没有下拉菜单', !document.querySelector('.enum-menu'));
  ok('没有 listbox 角色', !document.querySelector('[role="listbox"]'));
  ok('没有任何 option 角色', !document.querySelector('[role="option"]'));
  ok('页面上不存在 datalist', !document.querySelector('datalist'));
  ok('当前值直接显示在输入框里（性别=女）', inputOf('性别').value === '女', inputOf('性别').value);
  ok('民族字段同样只是文本框', inputOf('民族').type === 'text', inputOf('民族').type);
  ok('枚举不再写"点右侧下拉选择"这种提示', !/下拉/.test(inputOf('民族').placeholder), inputOf('民族').placeholder);
}

console.log('\n[2] 用户手填即生效，值原样进资料库');
{
  const input = inputOf('性别');
  input.value = '女';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 260));
  ok('性别写进资料库', stored.resumeProfile.personal[0]['性别'] === '女', String(stored.resumeProfile.personal[0]['性别']));
}

console.log('\n[3] 词表外的自由文本照原样保存（不做选择就不该有"非法值"）');
{
  const input = inputOf('政治面貌');
  input.value = '无党派人士';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  ok('输入框保留原样', input.value === '无党派人士', input.value);
  await new Promise(r => setTimeout(r, 260));
  ok(
    '值被写进资料库（不会被吞掉）',
    stored.resumeProfile.personal[0]['政治面貌'] === '无党派人士',
    String(stored.resumeProfile.personal[0]['政治面貌'])
  );
}

console.log('\n[4] 短写法也能保存（归一化只发生在填充时，不发生在输入时）');
{
  const input = inputOf('民族');
  input.value = '傣';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 260));
  ok('填"傣"就存"傣"（不擅自改写成"傣族"）', stored.resumeProfile.personal[0]['民族'] === '傣', String(stored.resumeProfile.personal[0]['民族']));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const click = el => el.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
const fireInput = el => el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
const navTo = name => {
  const b = [...document.querySelectorAll('#category-nav .nav-item')].find(x =>
    String(x.textContent || '').startsWith(name)
  );
  if (b) click(b);
  return !!b;
};
const addRecord = () => click(document.querySelector('#add-record'));

console.log('\n[5] 个人信息：新增「最高学历」');
{
  ok('能找到"最高学历"字段', !!fieldOf('最高学历'));
  const el = inputOf('最高学历');
  ok('最高学历是普通文本框（词表只用于填充归一，界面上不做选择）', el && el.type === 'text', el && el.type);
  el.value = '硕士';
  fireInput(el);
  await sleep(260);
  ok(
    '最高学历写进个人信息',
    stored.resumeProfile.personal[0]['最高学历'] === '硕士',
    String(stored.resumeProfile.personal[0]['最高学历'])
  );
}

console.log('\n[6] 所有日期字段都是日粒度（与"出生日期"同一种处理）');
{
  ok('能切到教育经历', navTo('教育经历'));
  addRecord();
  const start = fieldOf('开始时间');
  ok('教育经历开始时间是日期控件（日粒度）', inputOf('开始时间') && inputOf('开始时间').type === 'date', inputOf('开始时间') && inputOf('开始时间').type);
  ok('教育经历开始时间不再挂"年月"标签', !/年月/.test(start.querySelector('label').textContent));
  ok('教育经历结束时间同样是日粒度', inputOf('结束时间') && inputOf('结束时间').type === 'date');

  navTo('实习经历');
  addRecord();
  ok('实习经历开始时间也是日粒度', inputOf('开始时间') && inputOf('开始时间').type === 'date');

  navTo('求职意向');
  addRecord();
  ok(
    '"到岗时间"和出生日期一样是日期控件（v2.0.19 起没有"年月"字段了）',
    inputOf('到岗时间') && inputOf('到岗时间').type === 'date',
    inputOf('到岗时间') && inputOf('到岗时间').type
  );
  ok('"到岗时间"不再标"年月"', !/年月/.test(fieldOf('到岗时间').querySelector('label').textContent));
}

console.log('\n[7] v1 老数据「只有年月」在日粒度字段里怎么显示');
{
  // 老数据 education[0] 已经在 [6] 里建好了，这里直接塞一个 YYYY-MM
  stored.resumeProfile.education[0]['开始时间'] = '2020-09';
  navTo('个人信息');
  navTo('教育经历');
  const el = inputOf('开始时间');
  ok('日期框有值（不是被浏览器清空）', el.value === '2020-09-01', el.value || '(空)');
  ok('标签上标了"仅年月"', /仅年月/.test(fieldOf('开始时间').querySelector('label').textContent));
  ok(
    '资料库里仍然是 YYYY-MM（没有背地里替用户补 01 号）',
    stored.resumeProfile.education[0]['开始时间'] === '2020-09',
    String(stored.resumeProfile.education[0]['开始时间'])
  );
}

console.log('\n[8] 每个分类下都能加自定义字段');
{
  navTo('个人信息');
  const card = () => document.querySelector('#records .record-card');
  ok('默认给出"没有自定义字段"的提示', !!card().querySelector('.custom-hint'));
  const add = card().querySelector('.custom-head .link-button');
  ok('有「＋ 添加」入口', !!add && /添加/.test(add.textContent));

  click(add);
  const row = () => document.querySelector('#records .custom-row');
  ok('点一下多一行：字段名 + 内容', !!row() && !!row().querySelector('.custom-name') && !!row().querySelector('.custom-value'));

  const name = row().querySelector('.custom-name');
  const value = row().querySelector('.custom-value');
  name.value = '钉钉号';
  fireInput(name);
  value.value = 'nirui_pm';
  fireInput(value);
  await sleep(260);

  const custom = stored.resumeProfile.personal[0].__custom;
  ok('字段名进资料库', custom && custom[0] && custom[0].name === '钉钉号', JSON.stringify(custom));
  ok('字段内容进资料库', custom && custom[0] && custom[0].value === 'nirui_pm', JSON.stringify(custom));
  ok('自定义字段挂在"个人信息"这条记录上（分类级，不是全局）', stored.resumeProfile.education[0].__custom === undefined);

  click(row().querySelector('.delete-button'));
  const after = stored.resumeProfile.personal[0].__custom;
  ok('删除后条目没了', !after || after.length === 0, JSON.stringify(after));

  navTo('教育经历');
  ok('教育经历卡片同样有自定义字段入口', !!document.querySelector('#records .custom-head'));
}

console.log('\n[9] 同一分类下的字段唯一性监测');
{
  navTo('个人信息');
  const addBtn = () => document.querySelector('#records .custom-head .link-button');
  const items = () => [...document.querySelectorAll('#records .custom-item')];
  const warnOf = i => items()[i].querySelector('.custom-warn');
  const typeName = (i, text) => {
    const el = items()[i].querySelector('.custom-name');
    el.value = text;
    fireInput(el);
  };

  click(addBtn());
  click(addBtn());
  ok('加到两行', items().length === 2, String(items().length));
  ok('空字段名立刻提示"不会被填充"', !warnOf(0).hidden && /没填字段名/.test(warnOf(0).textContent), warnOf(0).textContent);

  typeName(0, '宿舍号');
  typeName(1, '宿舍号');
  ok('两行重名 → 都提示同名', /同名字段/.test(warnOf(0).textContent) && /同名字段/.test(warnOf(1).textContent), warnOf(0).textContent + ' | ' + warnOf(1).textContent);
  ok('重名行被标红', items()[0].classList.contains('has-warning'));

  typeName(1, '学历');
  ok('和内置字段撞名 → 提示"内置的优先"', /内置字段重名/.test(warnOf(1).textContent), warnOf(1).textContent);
  ok('改完名字后第 1 行的重名提示消失', warnOf(0).hidden, warnOf(0).textContent);

  typeName(1, '研究兴趣领域');
  ok('改成唯一名字 → 提示消失', warnOf(1).hidden && !items()[1].classList.contains('has-warning'), warnOf(1).textContent);
}

console.log('\n[10] 老的「自定义字段」分类：字段名称也做唯一性监测');
{
  navTo('自定义字段');
  click(document.querySelector('#add-record'));
  click(document.querySelector('#add-record'));
  const names = () => [...document.querySelectorAll('#records .field.custom-name-field input')];
  ok('两行"字段名称"都挂了监测标记', names().length === 2, String(names().length));

  names()[0].value = '领英主页';
  fireInput(names()[0]);
  names()[1].value = '领英主页';
  fireInput(names()[1]);
  const warns = () => [...document.querySelectorAll('#records .field.custom-name-field .custom-warn')];
  ok(
    '重名 → 两行都提示（全局自定义字段重名只会生效第一条）',
    warns().every(w => !w.hidden && /同名字段/.test(w.textContent)),
    warns().map(w => w.textContent).join(' | ')
  );

  names()[1].value = '博客地址';
  fireInput(names()[1]);
  ok('改成唯一名字 → 提示消失', warns().every(w => w.hidden));
}

console.log('\n[11] 跨记录同步的同名字段不提示重名（各填各的值）');
{
  navTo('家庭情况');
  click(document.querySelector('#add-record'));
  click(document.querySelector('#add-record'));
  const cards = () => [...document.querySelectorAll('#records .record-card')];
  ok('家庭情况有两条记录', cards().length === 2, String(cards().length));

  // 加一个自定义字段 → 每条记录都应自动多出这一行（字段名同步、内容各填）
  click(cards()[0].querySelector('.custom-head .link-button'));
  const items = () => [...document.querySelectorAll('#records .custom-item')];
  ok('两条记录各有一行自定义字段', items().length === 2, String(items().length));

  const names = () => [...document.querySelectorAll('#records .custom-name')];
  const values = () => [...document.querySelectorAll('#records .custom-value')];
  names()[0].value = '期望工位';
  fireInput(names()[0]);
  values()[0].value = '25';
  fireInput(values()[0]);
  values()[1].value = '48';
  fireInput(values()[1]);
  await sleep(260);

  const fam = stored.resumeProfile.family;
  ok('字段名自动同步到信息2（数据层）', fam[1].__custom && fam[1].__custom[0].name === '期望工位', JSON.stringify(fam));
  ok('内容各自独立', fam[0].__custom[0].value === '25' && fam[1].__custom[0].value === '48', JSON.stringify(fam.map(r => r.__custom)));

  // 重渲染让信息2 的 DOM 也显示"年龄"，此时跨记录同名不应再提示重名
  navTo('个人信息');
  navTo('家庭情况');
  const warns = () => [...document.querySelectorAll('#records .custom-item .custom-warn')];
  ok('跨记录同名字段不再提示"同名字段"', warns().every(w => w.hidden || !/同名字段/.test(w.textContent)), warns().map(w => w.textContent).join(' | '));
  ok('也没有标红', [...document.querySelectorAll('#records .custom-item')].every(it => !it.classList.contains('has-warning')));

  // 同一条记录里手工输入两个同名，仍然要提示（不能把真重名也放过去）
  click(cards()[0].querySelector('.custom-head .link-button'));
  const rows = () => [...document.querySelectorAll('#records .custom-item')];
  ok('两条记录现在各有两行（共 4 行）', rows().length === 4, String(rows().length));
  // DOM 顺序：信息1行0、信息1行1、信息2行0、信息2行1；把信息1行1 也改成"年龄"
  const nameInputs = () => [...document.querySelectorAll('#records .custom-name')];
  nameInputs()[1].value = '期望工位';
  fireInput(nameInputs()[1]);
  const warnTexts = () => [...document.querySelectorAll('#records .custom-item .custom-warn')].map(w => w.textContent);
  ok('同一条记录内真重名仍会提示', warnTexts().some(t => /同名字段/.test(t)), warnTexts().join(' | '));
}

console.log('\n[12] 字段名同步到界面：信息1 填名字，其他记录的输入框立刻跟上');
{
  navTo('实习经历');
  click(document.querySelector('#add-record')); // 第二条记录
  const cards = () => [...document.querySelectorAll('#records .record-card')];
  ok('实习经历有两条记录', cards().length === 2, String(cards().length));
  click(cards()[0].querySelector('.custom-head .link-button'));
  const names = () => [...document.querySelectorAll('#records .custom-name')];
  ok('两条记录各有一行自定义字段', names().length === 2, String(names().length));

  names()[0].value = '解决';
  fireInput(names()[0]);
  ok('信息2 的输入框立刻同步成"解决"（不用切分类刷新）', names()[1].value === '解决', names()[1].value || '(空)');
  const warns = () => [...document.querySelectorAll('#records .custom-item .custom-warn')];
  ok('信息2 的"没填字段名"提示消失', warns()[1] && warns()[1].hidden, warns().map(w => w.textContent).join(' | '));

  await sleep(260);
  ok('数据层同步仍在', stored.resumeProfile.internships[1].__custom[0].name === '解决',
    JSON.stringify(stored.resumeProfile.internships[1].__custom));
  // 内容仍各填各的
  const values = () => [...document.querySelectorAll('#records .custom-value')];
  values()[0].value = 'A 记录的内容';
  fireInput(values()[0]);
  await sleep(260);
  ok('内容不被同步（各填各的）', stored.resumeProfile.internships[0].__custom[0].value === 'A 记录的内容'
    && (stored.resumeProfile.internships[1].__custom[0].value || '') === '',
    JSON.stringify(stored.resumeProfile.internships.map(r => r.__custom)));
}

const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));

console.log('\n[13] 完成度：顶部总进度 + 导航分类计数 + 卡片"未补齐 N 项"');
{
  navTo('个人信息');
  const txt = () => document.querySelector('#progress .progress-text').textContent;
  ok('顶部显示「已填写 X / Y 个字段 · 完成度」', /已填写 \d+ \/ \d+ 个字段 · 完成度 \d+%/.test(txt()), txt());
  const before = Number(txt().match(/已填写 (\d+)/)[1]);
  const name = inputOf('姓名');
  name.value = '测试姓名';
  fireInput(name);
  ok('填一个字段 → 已填写数 +1', Number(txt().match(/已填写 (\d+)/)[1]) === before + 1, txt());
  const navCount = [...document.querySelectorAll('#category-nav .nav-item')].find(b => b.dataset.id === 'personal').querySelector('.nav-count').textContent;
  ok('导航上个人信息显示 已填/总数', /^\d+\/\d+$/.test(navCount), navCount);
  ok('卡片标题带「未补齐 N 项」', /未补齐 \d+ 项/.test(document.querySelector('#records .record-missing').textContent));
  ok('派生字段有说明（年龄留空自动算）', /出生日期自动计算/.test(inputOf('年龄').placeholder), inputOf('年龄').placeholder);
}

console.log('\n[14] 多份简历：新建 / 切换 / 复制，互不串数据');
{
  const sel = document.querySelector('#resume-select');
  const firstId = sel.value;
  click(document.querySelector('#resume-new'));
  await tick();
  ok('新建后有 2 份', sel.options.length === 2, String(sel.options.length));
  navTo('个人信息');
  ok('新简历是空的', inputOf('姓名').value === '', inputOf('姓名').value);
  inputOf('姓名').value = '第二份';
  fireInput(inputOf('姓名'));
  await tick(220);
  sel.value = firstId;
  sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick();
  navTo('个人信息');
  ok('切回第一份，数据还在', inputOf('姓名').value === '测试姓名', inputOf('姓名').value);
  ok('当前简历始终写在 resumeProfile（填充只认它）', stored.resumeProfile.personal[0]['姓名'] === '测试姓名');
  click(document.querySelector('#resume-copy'));
  await tick();
  navTo('个人信息');
  ok('复制出第 3 份，内容一样', sel.options.length === 3 && inputOf('姓名').value === '测试姓名');
  const nameBox = document.querySelector('#resume-name');
  nameBox.value = '投产品岗';
  fireInput(nameBox);
  ok('改名同步到下拉', [...sel.options].some(o => o.textContent === '投产品岗'));
  const del = document.querySelector('#resume-delete');
  click(del);
  ok('删除先要求再点一次', /再点一次/.test(del.textContent), del.textContent);
  click(del);
  await tick();
  ok('第二次才真删', sel.options.length === 2, String(sel.options.length));
}

console.log('\n[15] 导入 / 导出 JSON');
{
  const { exportPayload, parseImport, sortEducation, completion } = await import('../src/panel/library.js');
  const payload = exportPayload('A', { personal: [{ 姓名: '甲' }], education: [{ 学校名称: 'X' }] });
  const back = parseImport(JSON.stringify(payload));
  ok('导出 → 导入 往返无损', back.ok && back.name === 'A' && back.profile.personal[0]['姓名'] === '甲' && back.profile.education[0]['学校名称'] === 'X');
  ok('裸资料对象也能导入', parseImport(JSON.stringify({ personal: { 姓名: '乙' } })).profile.personal[0]['姓名'] === '乙');
  ok('乱七八糟的 JSON 拒收', !parseImport('{"foo":1}').ok && !parseImport('not json').ok);
  const before = document.querySelector('#resume-select').options.length;
  await panelMod.importResumeText(JSON.stringify(exportPayload('导入测试', { personal: [{ 姓名: '丙' }] })));
  await tick();
  navTo('个人信息');
  ok('导入成为新的一份并切过去', document.querySelector('#resume-select').options.length === before + 1 && inputOf('姓名').value === '丙', inputOf('姓名').value);
  const sorted = sortEducation([{ 学历: '本科' }, { 学历: '博士' }, { 学历: '硕士研究生' }]);
  ok('按学历排序：博士 > 硕士 > 本科', sorted.map(r => r['学历']).join(',') === '博士,硕士研究生,本科');
  const c = completion({ personal: [{ 姓名: 'x' }], education: [] });
  ok('多记录分类没有记录时是 0/0，不拉低完成度', c.byCategory.education.total === 0 && c.byCategory.personal.filled === 1);
}

console.log('\n[16] 经历上移 / 下移 + 按学历排序按钮');
{
  navTo('教育经历');
  click(document.querySelector('#add-record'));
  click(document.querySelector('#add-record'));
  const school = i => document.querySelectorAll('#records .record-card')[i].querySelector('input[aria-label="学校名称"]');
  const degree = i => document.querySelectorAll('#records .record-card')[i].querySelector('input[aria-label="学历"]');
  school(0).value = '本科学校'; fireInput(school(0));
  degree(0).value = '本科'; fireInput(degree(0));
  school(1).value = '硕士学校'; fireInput(school(1));
  degree(1).value = '硕士'; fireInput(degree(1));
  const sortBtn = document.querySelector('#sort-edu');
  ok('教育经历 ≥2 条时出现「按学历排序」', sortBtn && !sortBtn.hidden);
  click(sortBtn);
  ok('排序后硕士在前', school(0).value === '硕士学校', school(0).value);
  const up = [...document.querySelectorAll('#records .record-card')[1].querySelectorAll('.link-button')].find(b => b.textContent === '上移');
  click(up);
  ok('上移后本科回到第 1', school(0).value === '本科学校', school(0).value);
  navTo('个人信息');
  ok('其他分类不显示排序按钮', document.querySelector('#sort-edu').hidden);
}

console.log('\n[17] 投递记录视图');
{
  click(document.querySelector('#apps-nav'));
  ok('标题切到「投递记录」', document.querySelector('#section-title').textContent === '投递记录');
  ok('没有记录时给出说明', /还没有投递记录/.test(document.querySelector('#apps-view').textContent));
  ok('资料卡片区被清空、添加按钮隐藏', !document.querySelector('#records .record-card') && document.querySelector('#add-record').hidden);
  navTo('个人信息');
  ok('切回分类后投递视图隐藏', document.querySelector('#apps-view').hidden);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);