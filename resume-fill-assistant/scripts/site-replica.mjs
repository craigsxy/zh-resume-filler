// 真机复刻诊断（不是断言用例）：按用户截图里的真实类名/层级搭一份页面，
// 把插件"看到的东西"全部打印出来，看它到底卡在哪一步。
// 运行：node scripts/site-replica.mjs
//
// 真机结构（来自 8 张截图）：
//   .form-part > .form-part-body > .fields-col × N > .form-item
//        > .form-item__title(.form-item__title--right)
//        > .form-item__control > .phoenix-input > input.phoenix-input_input
//   phoenix-select（组件化下拉，不是原生 select）：
//        <span class="phoenix-select phoenix-select-editable phoenix-select--large">
//          <span class="phoenix-select_califier">已选值</span>
//          <div class="phoenix-select_placeholder phoenix-select_placeholder--large">已选值/请选择</div>
//          <div class="phoenix-select_inputwrap">
//            <input class="phoenix-select_input phoenix-select_input--large" value="">
//          </div>
//        </span>
//   phoenix-date-picker：
//        <div class="phoenix-date-picker">
//          <div class="phoenix-calendar-date-input">
//            <input class="phoenix-calendar-input" value="2026-10-08">
//          </div>
//        </div>

import { JSDOM } from 'jsdom';
import { buildFormModel } from '../src/form-model.js';
import { bind } from '../src/binder.js';
import { fillPage } from '../src/fill.js';
import { defaultProfile } from '../src/schema.js';

const input = (cls, ph = '请输入') =>
  `<div class="phoenix-input phoenix-input--large">
     <input class="${cls}" type="text" placeholder="${ph}">
   </div>`;

const dateBox = cls =>
  `<div class="phoenix-date-picker">
     <div class="phoenix-calendar-date-input">
       <input class="${cls}" type="text" placeholder="请选择">
     </div>
   </div>`;

// 组件化下拉：注意它内部**有自己的 input**，这就是位置配对的杀手
const picker = (cls, val = '') => `
  <span class="phoenix-select phoenix-select-editable phoenix-select-borderColorable phoenix-select--large ${cls}-wrap">
    <span class="phoenix-select_califier">${val}</span>
    <div class="phoenix-select_placeholder phoenix-select_placeholder--large">${val || '请选择'}</div>
    <div class="phoenix-select_inputwrap ${val ? '' : 'phoenix-select_inputwrap--empty'}">
      <input placeholder="请选择" class="${cls}-input phoenix-select_input phoenix-select_input--large" value="${val}" type="text">
    </div>
    <span class="phoenix-select_switchArrow"></span>
    <div class="phoenix-unmodeled-layer" style="display:none">
      <div class="phoenix-select-dropdown">
        <ul class="phoenix-select_content"></ul>
      </div>
    </div>
  </span>`;

const cell = (label, inner) => `
  <div class="fields-col">
    <div class="form-item form-item--phoenix">
      <div class="form-item__title form-item__title--right">${label}</div>
      <div class="form-item__control">${inner}</div>
    </div>
  </div>`;

const part = (title, cells) => `
  <div class="form-part false space-large size-large align-right">
    <div class="form-part-header"><span class="form-part-title">${title}</span></div>
    <div class="form-part-body clearfix false">${cells}</div>
  </div>`;

const eduSeg = k => [
  cell('开始时间', dateBox(`a${k}-start`)),
  cell('结束时间', dateBox(`a${k}-end`)),
  cell('学校名称', input(`a${k}-school`)),
  cell('学院名称', input(`a${k}-college`)),
  cell('专业名称', input(`a${k}-major`)),
  cell('学习形式', input(`a${k}-mode`)),
  cell('学历', picker(`${k}-level`)),
  cell('学位', picker(`${k}-degree`)),
].join('');

const HTML = `<!doctype html><html><body><form>
  ${part('个人信息', [
    cell('姓名', input('p-name')),
    cell('毕业时间', dateBox('p-grad')),
    cell('邮箱', input('p-mail')),
    cell('手机号', picker('p-phonecc', '中国大陆') + input('p-mobile', '请输入')),
    cell('证件号码', picker('p-idtype', '身份证') + input('p-idno', '请输入')),
  ].join(''))}
  ${part('教育经历', eduSeg('1') + eduSeg('2'))}
  ${part('家庭情况', [
    cell('姓名', input('f-name')),
    cell('与本人关系', input('f-rel')),
    cell('工作单位', input('f-company')),
    cell('职务', input('f-title')),
    cell('工作所在地', input('f-loc')),
  ].join(''))}
</form></body></html>`;

const dom = new JSDOM(HTML, { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.Node = dom.window.Node;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.MouseEvent = dom.window.MouseEvent;
global.CSS = dom.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

const model = buildFormModel();

// 让复刻页面里的下拉真的能弹开、真的能选中（否则只会看到 panel-not-open）
const OPTS = {
  'p-idtype': ['身份证', '护照'],
  'p-phonecc': ['中国大陆', '中国香港'],
  '1-level': ['大专', '本科', '硕士研究生', '博士'],
  '1-degree': ['无', '学士', '双学士', '硕士', '博士', '双硕士', 'MBA', 'EMBA'],
  '2-level': ['大专', '本科', '硕士研究生', '博士'],
  '2-degree': ['无', '学士', '双学士', '硕士', '博士', '双硕士', 'MBA', 'EMBA'],
};
for (const host of document.querySelectorAll('.phoenix-select')) {
  const key = [...host.classList].map(c => c.replace(/-wrap$/, '')).find(c => OPTS[c]);
  if (!key) continue;
  const list = host.querySelector('.phoenix-select_content');
  const portal = host.querySelector('.phoenix-unmodeled-layer');
  const califier = host.querySelector('.phoenix-select_califier');
  const ph = host.querySelector('.phoenix-select_placeholder');
  const inp = host.querySelector('input');
  host.addEventListener('click', e => {
    const li = e.target && e.target.closest ? e.target.closest('li[role="option"]') : null;
    if (li) {
      califier.textContent = li.textContent;
      ph.textContent = li.textContent;
      inp.value = li.textContent;
      portal.style.display = 'none';
      return;
    }
    if (!list.children.length) {
      list.innerHTML = OPTS[key].map(o => `<li role="option">${o}</li>`).join('');
    }
    portal.style.display = '';
  });
}
console.log('\n===== 扫描结果 =====');
for (const s of model.sections) {
  console.log(`\n[区块] ${s.title}  category=${s.categoryId}  blocks=${s.blocks.length}`);
  for (const b of s.blocks) {
    console.log(`  #${b.index}  ${b.fields.length} 个字段`);
    for (const f of b.fields) {
      const el = f.el;
      const id = el.className || el.tagName;
      console.log(
        `      - label=${JSON.stringify(f.label)}  parts=${JSON.stringify(f.labelParts || [])}` +
          `  ck=${f.controlKind}  el=${el.tagName}.${id}`
      );
    }
  }
}

const p = defaultProfile();
p.personal = [{
  姓名: '倪睿',
  毕业时间: '2025-07-03',
  邮箱: 'nirui57@126.com',
  手机: '18622697613',
  证件号码: '120113200305070829',
}];
p.education = [
  {
    开始时间: '2024-09-01', 结束时间: '2025-11-30',
    学校名称: '香港城市大学', 学院名称: '商学院', 专业名称: '商业及数据分析',
    学习形式: '海外留学生', 学历: '硕士研究生', 学位: '硕士',
  },
  {
    开始时间: '2021-08-17', 结束时间: '2025-07-03',
    学校名称: '天津大学', 学院名称: '数学学院', 专业名称: '金融数学',
    学习形式: '普通全日制', 学历: '本科', 学位: '学士',
  },
];
p.family = [{ 姓名: '倪旭祥', 与本人关系: '父女', 工作单位: '天津市宏鹏实业有限公司', 职务: '财务经理', 工作所在地: '天津市' }];

console.log('\n===== 绑定结果 =====');
for (const plan of bind(model, p)) {
  console.log(
    `  ${String(plan.sectionTitle).padEnd(6)} #${plan.blockIndex} ` +
      `${String(plan.label).padEnd(8)} slot=${String(plan.slot).padEnd(18)} kind=${String(plan.kind).padEnd(8)} ` +
      `ck=${String(plan.field.controlKind).padEnd(13)} value=${JSON.stringify(plan.value)} dup=${!!plan.dup}`
  );
}

const report = await fillPage(p, {
  bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  expand: false,
});

console.log('\n===== 写入结果 =====');
for (const r of report.results) {
  console.log(
    `  ${String(r.section).padEnd(6)} #${r.block} ${String(r.label).padEnd(8)} ` +
      `${String(r.status).padEnd(8)} reason=${String(r.reason || '').padEnd(20)} ` +
      `value=${JSON.stringify(r.value)} rb=${JSON.stringify(r.readback || '')}`
  );
}
console.log('\n统计：', JSON.stringify({ total: report.total, filled: report.filled, skipped: report.skipped, failed: report.failed, empty: report.empty }));
