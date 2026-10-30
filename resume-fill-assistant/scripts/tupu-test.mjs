// 图谱 tupu360（辉瑞校招 careersite.tupu360.com）真机结构仿真 · 端到端
//
// 页面骨架来自用户 2026-10-29 保存的真机网页（scripts/fixtures/tupu360-form.html，已去脚本/去个人信息），
// 交互行为按 Ant Design Vue 1.x 复刻：
//   · 区块：.cardDetail > .section-title-wrapper > .section-title + .section-object（字段卡）
//   · 多段经历是"卡片式录入"：「添加 X」→ 新编辑卡（.edit_mode）→ 卡片内「确认」校验必填 → 变只读卡
//   · 下拉：点 .ant-select-selection → body 下挂 .ant-select-dropdown（ul#aria-controls > li）
//   · 日期：点 .ant-calendar-picker-input → 弹 .ant-calendar-picker-container，
//     面板头部 .ant-calendar-input 可键入 YYYY-MM-DD，回车提交并关闭；也可点日格
//   · 「英语水平」只有一张已保存的只读卡（托福 / 111）、没有编辑卡
// 运行：node scripts/tupu-test.mjs

import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const FIXTURE = readFileSync(new URL('./fixtures/tupu360-form.html', import.meta.url), 'utf8');

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

const OPTIONS = {
  意向城市: ['上海', '北京', '广州'],
  是否服从岗位调剂: ['是', '否'],
  你是从哪个渠道获取招聘信息的: ['高校微信公众号', '辉瑞官网', '招聘网站', '宣讲会', '其他'],
  '每周可出勤天数（要求3天及以上）': ['3天', '4天', '5天'],
  '可实习时长（要求最少3个月及以上）': ['3个月', '4-6个月', '6个月以上'],
  最高学历专业类别: ['信息科学与技术类', '工学', '医学', '管理学'],
  专业类别: ['信息科学与技术类', '工学', '医学', '管理学'],
  学历: ['本科', '硕士', '博士'],
  英语等级: ['大学英语四级', '大学英语六级', '托福', '雅思'],
  是否有实习经验: ['是', '否'],
  是否有医药类公司或医药类项目实习经验: ['是', '否'],
  是否有销售类实习经验: ['是', '否'],
  是否有校内外实践活动经历: ['是', '否'],
  是否有获奖经验: ['是', '否'],
};

// ---------- 页面 ----------

function boot() {
  const dom = new JSDOM(`<!doctype html><html><body>${FIXTURE}</body></html>`, { pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(global, {
    window: w,
    document: w.document,
    Node: w.Node,
    HTMLInputElement: w.HTMLInputElement,
    HTMLTextAreaElement: w.HTMLTextAreaElement,
    HTMLSelectElement: w.HTMLSelectElement,
    getComputedStyle: w.getComputedStyle.bind(w),
    CSS: { escape: s => String(s).replace(/["\\]/g, '\\$&') },
  });
  const doc = w.document;
  // 保存下来的页面里，只读卡的「确认/取消」由 CSS 隐藏（编辑态才显示）
  doc.querySelectorAll('.section-object:not(.edit_mode) .submite').forEach(n => (n.style.display = 'none'));
  // 真机快照里下拉有用户之前选的值：清回占位，测试从空表开始
  doc.querySelectorAll('.ant-select-selection__rendered').forEach(r => {
    r.innerHTML = '<div unselectable="on" class="ant-select-selection__placeholder">请选择</div>';
  });
  install(doc, w);
  return { dom, doc, w };
}

const labelOfGroup = g =>
  String((g.querySelector('.field-label') || {}).textContent || '')
    .replace(/[*\s]/g, '')
    .trim();

function langCardHTML() {
  // 「英语水平」页面上没有编辑卡可复制：按同站其他编辑卡的结构造一张
  const sel = lbl => `<div class="field-group"><span class="field-value field-editor">
    <span class="field-label"><span class="require_tip">*</span>${lbl}</span>
    <form class="ant-form ant-form-horizontal specialSelect" path="languageExp"><div class="ant-row ant-form-item"><div class="ant-form-item-control-wrapper"><div class="ant-form-item-control"><span class="ant-form-item-children"><div>
      <div class="searchStyle ant-select ant-select-enabled"><div role="combobox" aria-haspopup="true" tabindex="0" class="ant-select-selection ant-select-selection--single"><div class="ant-select-selection__rendered"><div unselectable="on" class="ant-select-selection__placeholder">请选择</div></div><span class="ant-select-arrow"><i class="anticon anticon-down"></i></span></div></div>
    </div></span></div></div></div></form></span></div>`;
  const txt = lbl => `<div class="field-group"><span class="field-value field-editor">
    <span class="field-label"><span class="require_tip">*</span>${lbl}</span>
    <form class="ant-form ant-form-horizontal" path="languageExp"><div class="ant-row ant-form-item"><div class="ant-form-item-control-wrapper"><div class="ant-form-item-control"><span class="ant-form-item-children">
      <input placeholder="" type="text" class="ant-input">
    </span></div></div></div></form></span></div>`;
  return `<div class="section-object section-list edit_mode"><i class="fr iconfont iconshanchu pointer deleter"></i> <i class="fr iconfont iconbianji pointer editor"></i>
    ${sel('英语等级')}${txt('分数')}
    <div class="submite"><button class="btn btnBgActive pointer">确认</button> <button class="btn btnBg pointer">取消</button></div></div>`;
}

let ariaSeq = 0;
function install(doc, w) {
  // 编辑卡模板：每个区块第一张编辑卡（清空后备用）
  const templates = new Map();
  for (const card of doc.querySelectorAll('.cardDetail')) {
    const edit = card.querySelector('.section-object.edit_mode');
    if (!edit) continue;
    const t = edit.cloneNode(true);
    t.querySelectorAll('input,textarea').forEach(i => (i.value = ''));
    templates.set(card, t);
  }

  const valueOf = g => {
    const i = g.querySelector('input.ant-input:not(.ant-calendar-picker-input), textarea');
    if (i) return String(i.value || '').trim();
    const d = g.querySelector('.ant-calendar-picker-input');
    if (d) return String(d.value || '').trim();
    const s = g.querySelector('.ant-select-selection-selected-value');
    return s ? String(s.textContent || '').trim() : '';
  };

  const closeDropdowns = () => {
    doc.querySelectorAll('.ant-select-dropdown').forEach(d => (d.style.display = 'none'));
    doc.querySelectorAll('.ant-calendar-picker-container').forEach(c => c.remove());
  };

  // Ant Design Vue（getPopupContainer = 字段自身）：弹层第一次打开后**留在字段行里**，
  // 关闭只是 display:none —— 真机快照里就是这样，标签采集必须能扛住它
  const pickOption = li => {
    const dd = li.closest('.ant-select-dropdown');
    const sel = dd.__sel || dd.closest('.ant-form-item').querySelector('.ant-select-selection');
    const v = li.textContent.trim();
    sel.querySelector('.ant-select-selection__rendered').innerHTML =
      `<div title="${v}" class="ant-select-selection-selected-value">${v}</div>`;
    sel.setAttribute('aria-expanded', 'false');
    dd.style.display = 'none';
    const err = sel.closest('.field-group') && sel.closest('.field-group').querySelector('.ant-form-explain');
    if (err) err.remove();
  };

  const openSelect = sel => {
    closeDropdowns();
    const g = sel.closest('.field-group');
    const label = labelOfGroup(g);
    const item = sel.closest('.ant-form-item');
    let dd = item && item.querySelector('.ant-select-dropdown');
    if (!dd) {
      const host = doc.createElement('div');
      host.innerHTML = `<div class="ant-select-dropdown ant-select-dropdown--single ant-select-dropdown-placement-bottomLeft" style="position:absolute">
        <div class="ant-select-dropdown-content"><div style="overflow:auto"><ul role="listbox" class="ant-select-dropdown-menu ant-select-dropdown-menu-root ant-select-dropdown-menu-vertical"></ul></div></div></div>`;
      doc.body.append(host);
      dd = host.firstElementChild;
      dd.__sel = sel;
    }
    const ul = dd.querySelector('ul');
    if (OPTIONS[label] || !ul.querySelector('li')) {
      ul.innerHTML = (OPTIONS[label] || ['选项A', '选项B'])
        .map(o => `<li role="option" unselectable="on" class="ant-select-dropdown-menu-item">${o}</li>`)
        .join('');
    }
    const id = (dd.querySelector('[id]') && dd.querySelector('[id]').id) || 'aria-' + ++ariaSeq;
    if (!dd.querySelector('[id]')) ul.id = id;
    sel.setAttribute('aria-controls', id);
    sel.setAttribute('aria-expanded', 'true');
    dd.style.display = '';
  };

  const openCalendar = input => {
    closeDropdowns();
    const now = { y: 2026, m: 10 };
    const host = doc.createElement('div');
    host.innerHTML = `<div class="ant-calendar-picker-container ant-calendar-picker-container-placement-bottomLeft" style="position:absolute">
      <div class="ant-calendar"><div class="ant-calendar-panel">
        <div class="ant-calendar-input-wrap"><div class="ant-calendar-date-input-wrap"><input class="ant-calendar-input" placeholder="请选择日期"></div></div>
        <div class="ant-calendar-date-panel"><div class="ant-calendar-header"><div style="position:relative">
          <a class="ant-calendar-prev-year-btn" title="上一年"></a><a class="ant-calendar-prev-month-btn" title="上个月"></a>
          <span class="ant-calendar-my-select"><a class="ant-calendar-year-select">${now.y}年</a><a class="ant-calendar-month-select">${now.m}月</a></span>
          <a class="ant-calendar-next-month-btn" title="下个月"></a><a class="ant-calendar-next-year-btn" title="下一年"></a>
        </div></div>
        <div class="ant-calendar-body"><table class="ant-calendar-table"><tbody><tr>
          ${Array.from({ length: 31 }, (_, i) => `<td class="ant-calendar-cell"><div class="ant-calendar-date">${i + 1}</div></td>`).join('')}
        </tr></tbody></table></div></div>
        <div class="ant-calendar-footer"><span class="ant-calendar-footer-btn"><a class="ant-calendar-today-btn">今天</a></span></div>
      </div></div></div>`;
    doc.body.append(host);
    const panelInput = host.querySelector('.ant-calendar-input');
    let pending = null;
    const commit = v => {
      input.value = v;
      input.dispatchEvent(new w.Event('change', { bubbles: true }));
      host.remove();
    };
    // rc-calendar DateInput：格式合法才接收（否则保持原样不提交），回车提交并关面板
    panelInput.addEventListener('input', () => {
      const v = String(panelInput.value || '').trim();
      pending = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    });
    panelInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && pending) commit(pending);
    });
    host.querySelectorAll('.ant-calendar-date').forEach(c =>
      c.addEventListener('click', () => commit(`${now.y}-${String(now.m).padStart(2, '0')}-${String(c.textContent).padStart(2, '0')}`))
    );
  };

  const confirmCard = card => {
    card.querySelectorAll('.ant-form-explain').forEach(e => e.remove());
    const groups = [...card.querySelectorAll('.field-group')];
    let bad = 0;
    for (const g of groups) {
      if (!g.querySelector('.require_tip')) continue;
      if (valueOf(g)) continue;
      bad++;
      const ctl = g.querySelector('.ant-form-item-control');
      if (ctl) ctl.insertAdjacentHTML('beforeend', `<div class="ant-form-explain">必填字段不能为空</div>`);
    }
    if (bad) return;
    const view = doc.createElement('div');
    view.className = 'section-object section-list';
    view.innerHTML =
      '<i class="fr iconfont iconshanchu pointer deleter"></i> <i class="fr iconfont iconbianji pointer editor"></i>' +
      groups
        .map(g => `<div class="field-group"><span><span class="field-value"><span>${labelOfGroup(g)}：<div><span>${valueOf(g)}</span></div></span></span></span></div>`)
        .join('');
    card.replaceWith(view);
  };

  doc.addEventListener('click', e => {
    const t = e.target;
    const li = t.closest && t.closest('.ant-select-dropdown li');
    if (li) return pickOption(li);
    const sel = t.closest && t.closest('.ant-select-selection');
    if (sel && !t.closest('.ant-select-dropdown')) return openSelect(sel);
    const cal = t.closest && t.closest('.ant-calendar-picker-input');
    if (cal) return openCalendar(cal);
    const add = t.closest && t.closest('.add_btn');
    if (add) {
      const cardDetail = add.closest('.cardDetail');
      // 严格模式（真机常见）：当前还有没保存的编辑卡时，「添加」不响应
      if (w.__strictAdd && cardDetail.querySelector('.section-object.edit_mode')) return;
      const tpl = templates.get(cardDetail);
      const wrap = doc.createElement('div');
      if (tpl) wrap.append(tpl.cloneNode(true));
      else wrap.innerHTML = langCardHTML();
      const groups = cardDetail.querySelectorAll('.add_fieldGroup');
      const last = groups[groups.length - 1];
      last.parentElement.insertBefore(wrap.firstElementChild, last);
      return;
    }
    const btn = t.closest && t.closest('button.btn');
    if (btn && btn.closest('.section-object.edit_mode')) {
      const card = btn.closest('.section-object');
      if (/确认/.test(btn.textContent)) confirmCard(card);
      else card.remove();
    }
  });
}

// ---------- 资料 ----------

const { fillPage } = await import('../src/fill.js');
const { buildFormModel } = await import('../src/form-model.js');
const { defaultProfile } = await import('../src/schema.js');

function profileOf() {
  const p = defaultProfile();
  p.personal = [
    {
      姓名: '张三',
      性别: '女',
      邮箱: 'test@example.com',
      当前所在城市: '上海市黄浦区',
      __custom: [
        { name: '是否有校内外实践活动经历', value: '否' },
        { name: '是否有获奖经验', value: '是' },
      ],
    },
  ];
  p.intention = [
    {
      意向城市: '北京',
      是否服从调剂: '是',
      信息来源: '辉瑞官网',
      最早可实习时间: '2027-05-22',
      每周实习天数: '4天',
      实习时长: '6个月以上',
    },
  ];
  p.education = [
    { 学校名称: '东湖大学', 学历: '本科', 开始时间: '2021-09-01', 结束时间: '2025-06-30', 专业类别: '工学', 专业名称: '机械工程' },
    { 学校名称: '西岭大学', 学历: '硕士', 开始时间: '2025-09-01', 结束时间: '2027-06-30', 专业类别: '信息科学与技术类', 专业名称: '智能制造方向' },
  ];
  p.languages = [
    { 证书类型: 'TOEFL', 语言成绩: '111' }, // 页面上已保存（只读卡：托福 / 111）
    { 证书类型: 'CET-6', 语言成绩: '580' },
  ];
  p.internships = [
    {
      单位名称: '示例医药有限公司',
      开始时间: '2024-07-01',
      结束时间: '2024-09-30',
      实习岗位: '医学信息实习生',
      实习内容: '文献检索与整理',
      __custom: [
        { name: '是否有实习经验', value: '是' },
        { name: '是否有医药类公司或医药类项目实习经验', value: '是' },
        { name: '是否有销售类实习经验', value: '否' },
      ],
    },
    { 单位名称: '某咨询公司', 开始时间: '2025-01-01', 结束时间: '2025-03-31', 实习岗位: '分析师', 实习内容: '行业研究' },
  ];
  p.awards = [{ 奖项: '国家奖学金', 获奖时间: '2024-10-01' }];
  return p;
}

const bridge = { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) };
const cardOf = (doc, title) =>
  [...doc.querySelectorAll('.cardDetail')].filter(c => String(c.querySelector('.section-title')?.textContent || '').includes(title));
const viewText = card =>
  [...card.querySelectorAll('.section-object:not(.edit_mode)')].map(v => v.textContent.replace(/\s+/g, '')).join(' || ');

console.log('\n[1] 扫描：区块按 .section-title 切开（单问区块也独立）');
{
  boot();
  const model = buildFormModel(document.body);
  const titles = model.sections.map(s => `${s.title}:${s.categoryId}`);
  ok('「申请信息」独立成区块', titles.includes('申请信息:intention'), titles.join(' / '));
  ok('「求职意向-请选择…」取前缀', titles.includes('求职意向:intention'), titles.join(' / '));
  ok('「实践活动经验」→ practice', titles.includes('实践活动经验:practice'), titles.join(' / '));
  ok('「获奖经验」→ awards', titles.filter(t => t === '获奖经验:awards').length === 2, titles.join(' / '));
  const edu = model.sections.find(s => s.title === '教育背景');
  ok('教育背景切出 2 块', edu && edu.blocks.length === 2, edu && String(edu.blocks.length));
  const all = model.sections.flatMap(s => s.blocks.flatMap(b => b.fields));
  ok(
    '整句问题标签完整保留',
    all.some(f => (f.labelParts || []).includes('是否有医药类公司或医药类项目实习经验')),
    JSON.stringify(all.map(f => f.label))
  );
  ok('「你是从哪个渠道获取招聘信息的」不再是空标签', all.some(f => (f.labelParts || []).includes('你是从哪个渠道获取招聘信息的')));
}

console.log('\n[2] 端到端：卡片式录入（扩充 → 填写 → 卡片确认）');
{
  const { doc } = boot();
  const report = await fillPage(profileOf(), { bridge });
  const res = report.results;
  const bySlot = s => res.filter(r => r.slot === s);
  const show = rs => JSON.stringify(rs.map(r => ({ s: r.status, r: r.reason, v: r.readback, n: r.note })));

  ok('姓名', bySlot('personal.name')[0]?.status === 'filled', show(bySlot('personal.name')));
  ok('性别 → 女', doc.querySelector('input[value="女"]').checked, show(bySlot('personal.gender')));
  ok('当前所在城市', bySlot('personal.currentCity')[0]?.status === 'filled', show(bySlot('personal.currentCity')));
  ok('意向城市选成北京', /北京/.test(cardOf(doc, '求职意向')[0].textContent), show(bySlot('intent.city')));
  ok('是否服从调剂', bySlot('intent.adjust')[0]?.status === 'filled', show(bySlot('intent.adjust')));
  ok('渠道（整句标签）', bySlot('intent.source')[0]?.status === 'filled', show(bySlot('intent.source')));
  ok('每周可出勤天数', bySlot('intent.daysPerWeek')[0]?.status === 'filled', show(bySlot('intent.daysPerWeek')));
  ok('可实习时长', bySlot('intent.internDuration')[0]?.status === 'filled', show(bySlot('intent.internDuration')));
  ok('最早可实习时间（日期）', bySlot('intent.internStart')[0]?.status === 'filled', show(bySlot('intent.internStart')));
  const hiMajor = cardOf(doc, '最高学历专业类别')[0];
  ok('最高学历专业类别取硕士那段（信息科学与技术类）', /信息科学与技术类/.test(hiMajor.textContent), hiMajor.textContent.replace(/\s+/g, '').slice(0, 60));

  const eduCard = cardOf(doc, '教育背景').find(c => !/最高学历/.test(c.querySelector('.section-title').textContent));
  const eduView = viewText(eduCard);
  ok('教育两段都点了确认、变成只读卡', eduCard.querySelectorAll('.section-object.edit_mode').length === 0, eduView);
  ok('教育第 1 段：东湖大学 / 本科 / 入学 2021-09-01 / 工学 / 机械工程', /东湖大学.*本科.*2021-09-01.*2025-06-30.*工学.*机械工程/.test(eduView), eduView);
  ok('教育第 2 段：西岭大学 / 硕士 / 2025-09-01', /西岭大学.*硕士.*2025-09-01.*2027-06-30.*信息科学与技术类.*智能制造方向/.test(eduView), eduView);

  const lang = cardOf(doc, '英语水平')[0];
  const langView = viewText(lang);
  ok('已保存的托福没有被重复添加', (langView.match(/托福/g) || []).length === 1, langView);
  ok('CET-6 那段新加并确认（英语等级=大学英语六级 / 580）', /大学英语六级.*580/.test(langView), langView);
  ok('报告里说明了"已保存不再重复添加"', report.repeat.log.some(l => /已保存/.test(l)), JSON.stringify(report.repeat.log));

  const exp = cardOf(doc, '实习经历').find(c => c.querySelector('.add_btn'));
  const expView = viewText(exp);
  ok('实习第 2 段自动「添加」出来', exp.querySelectorAll('.section-object').length === 2, expView);
  ok('实习两段都确认成只读卡', exp.querySelectorAll('.section-object.edit_mode').length === 0, expView);
  ok('实习第 1 段：公司 / 起止 / 岗位 / 职责', /示例医药有限公司.*2024-07-01.*2024-09-30.*医学信息实习生.*文献检索与整理/.test(expView), expView);
  ok('实习第 2 段：某咨询公司 / 分析师', /某咨询公司.*2025-01-01.*2025-03-31.*分析师.*行业研究/.test(expView), expView);

  const yn = cardOf(doc, '实习经历').find(c => !c.querySelector('.add_btn'));
  ok('三个"是否有…经验"按自定义字段选上', /是.*是.*否/.test(yn.textContent.replace(/\s+/g, '')), yn.textContent.replace(/\s+/g, ''));
  ok('是否有校内外实践活动经历 = 否', /否/.test(cardOf(doc, '实践活动经验')[0].textContent));

  const award = cardOf(doc, '获奖经验').find(c => c.querySelector('.add_btn'));
  ok('获奖卡确认：国家奖学金 / 2024-10-01', /2024-10-01.*国家奖学金/.test(viewText(award)), viewText(award));

  const commits = res.filter(r => r.controlKind === 'CARD_COMMIT');
  ok('一共确认了 6 张卡（教育 2 + 英语 1 + 实习 2 + 获奖 1）', commits.filter(r => r.status === 'filled').length === 6, show(commits));
  ok('授权勾选框一个都没勾', [...doc.querySelectorAll('.ant-checkbox-input')].every(c => !c.checked));
  ok('页面上没有残留打开的下拉/日历', ![...doc.querySelectorAll('.ant-calendar-picker-container')].length);
}

console.log('\n[3] 必填没填全：确认被站点拦下 → 报告如实说明，不假装成功');
{
  const { doc } = boot();
  const p = profileOf();
  p.education[0] = { 学校名称: '东湖大学', 学历: '本科' }; // 缺入学/毕业日期、专业
  p.languages = [];
  p.internships = [];
  p.awards = [];
  const report = await fillPage(p, { bridge });
  const commits = report.results.filter(r => r.controlKind === 'CARD_COMMIT');
  const blocked = commits.find(r => r.status === 'failed');
  ok('第 1 段确认失败，原因 card-commit-blocked', blocked && blocked.reason === 'card-commit-blocked', JSON.stringify(commits));
  ok('点名缺哪几个必填项（站点只说「必填字段不能为空」）', blocked && /入学日期.*毕业日期/.test(blocked.note || '') && !/必填字段不能为空/.test(blocked.note), blocked && blocked.note);
  const eduCard = cardOf(doc, '教育背景').find(c => !/最高学历/.test(c.querySelector('.section-title').textContent));
  ok('那张卡仍在编辑态（用户能接着补）', eduCard.querySelectorAll('.section-object.edit_mode').length === 1);
}

console.log('\n[4] commitCards:false 时不点确认');
{
  const { doc } = boot();
  const p = profileOf();
  p.languages = [p.languages[0]];
  p.internships = [p.internships[0]];
  await fillPage(p, { bridge, commitCards: false });
  const eduCard = cardOf(doc, '教育背景').find(c => !/最高学历/.test(c.querySelector('.section-title').textContent));
  ok('编辑卡保持编辑态', eduCard.querySelectorAll('.section-object.edit_mode').length === 2, eduCard.querySelectorAll('.section-object').length + ' / ' + viewText(eduCard));
}

console.log('\n[5] 简历附件：标签落在文件名框上时，就近找到同一行的 input[type=file]');
{
  const { doc } = boot();
  const { writeUpload } = await import('../src/adapters/upload.js');
  const fileInput = doc.querySelector('input.input_file');
  fileInput.setAttribute('accept', 'application/pdf,.pdf,.doc,.docx');
  const nameBox = fileInput.closest('.field-group').querySelector('input.ant-input');
  const photo = { name: 'me.jpg', type: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA' };
  const r1 = await writeUpload({ value: photo, field: { el: nameBox, container: nameBox.closest('.field-value') } });
  ok('找到了旁边的文件控件（照片不往只收文档的控件里塞）', r1.reason === 'upload-type-mismatch', JSON.stringify(r1));
  const r2 = await writeUpload({ value: photo, field: { el: doc.querySelector('.titleLine'), container: doc.querySelector('.titleLine') } });
  ok('附近没有文件控件 → not-file-input', r2.reason === 'not-file-input', JSON.stringify(r2));
}

console.log('\n[7] 真机回归（2026-10-29 诊断）：隐藏的下拉弹层留在字段行里，不能被当成标签');
{
  boot();
  const model = buildFormModel(document.body);
  const all = model.sections.flatMap(s => s.blocks.flatMap(b => b.fields));
  const labels = all.map(f => f.label);
  ok('快照里确实带着隐藏的下拉弹层', document.querySelectorAll('.ant-form-item .ant-select-dropdown').length >= 10);
  ok('没有一个字段的标签是选项文字（上海 / 是否 / 3天以下3天4天5天 / 大专本科硕士博士）', !labels.some(l => /^(上海|是否|3天以下3天4天5天|大专本科硕士博士)$/.test(l)), JSON.stringify(labels));
  for (const want of ['意向城市', '是否服从岗位调剂', '每周可出勤天数', '学历', '是否有实习经验', '是否有校内外实践活动经历', '是否有获奖经验']) {
    ok(`取到真标签「${want}」`, all.some(f => (f.labelParts || []).includes(want) || f.label === want));
  }
}

console.log('\n[8] 资料值的备选：多选值落单选 / 「|」备选 / 层级路径');
{
  const { doc } = boot();
  const p = profileOf();
  p.intention[0]['意向城市'] = '杭州、上海、深圳'; // 网页选项只有 上海/北京/广州
  p.intention[0]['信息来源'] = '官网 | 高校微信公众号';
  p.education[1]['专业类别'] = '学术型硕士 / 工学 / 机械工程 | 信息科学与技术类';
  p.languages = [p.languages[0]];
  p.internships = [p.internships[0]];
  const report = await fillPage(p, { bridge });
  const bySlot = sl => report.results.filter(r => r.slot === sl);
  ok('意向城市：杭州没有 → 选了上海', /上海/.test(cardOf(doc, '求职意向')[0].textContent), JSON.stringify(bySlot('intent.city')));
  ok('信息来源：官网没有 → 用备选「高校微信公众号」', bySlot('intent.source')[0]?.status === 'filled' && /高校微信公众号/.test(cardOf(doc, '个人信息')[0].textContent), JSON.stringify(bySlot('intent.source')));
  ok('专业类别：路径对不上 → 用备选「信息科学与技术类」', /信息科学与技术类/.test(cardOf(doc, '最高学历专业类别')[0].textContent));
  ok('文本框里绝不会写进「a | b」', ![...doc.querySelectorAll('input,textarea')].some(i => /[|｜]/.test(i.value || '')));
}

console.log('\n[9] 4 段实习 · 页面 1 张卡 → 补到 4 张（点击上限按"一开始差几段"算）');
{
  const { doc } = boot();
  const p = profileOf();
  p.languages = [p.languages[0]];
  p.internships = [0, 1, 2, 3].map(i => ({ 单位名称: `示例公司${i + 1}`, 开始时间: `202${i}-07-01`, 结束时间: `202${i}-09-30`, 实习岗位: '实习生', 实习内容: '工作内容' }));
  const r9 = await fillPage(p, { bridge });
  const exp = cardOf(doc, '实习经历').find(c => c.querySelector('.add_btn'));
  ok('一共 4 张实习卡', exp.querySelectorAll('.section-object').length === 4, String(exp.querySelectorAll('.section-object').length));
  const v = viewText(exp);
  ok('4 段全部确认成只读卡且各归各位', [1, 2, 3, 4].every(i => v.includes(`示例公司${i}`)) && !exp.querySelector('.edit_mode'), v);
}

console.log('\n[10] 每张卡只有 2 个字段（获奖）也能按卡片切开；站点要求先保存才能再加 → 自动第 2 轮');
{
  const { doc, w } = boot();
  w.__strictAdd = true;
  const p = profileOf();
  p.languages = [p.languages[0]];
  p.internships = [p.internships[0]];
  p.awards = [
    { 奖项: '国家奖学金', 获奖时间: '2024-10-01' },
    { 奖项: '校级一等奖学金', 获奖时间: '2023-10-01' },
  ];
  const report = await fillPage(p, { bridge });
  const award = cardOf(doc, '获奖经验').find(c => c.querySelector('.add_btn'));
  const v = viewText(award);
  ok('两条获奖都确认成只读卡', /国家奖学金/.test(v) && /校级一等奖学金/.test(v) && !award.querySelector('.edit_mode'), v);
  ok('报告里有「第 2 轮」', report.repeat.log.some(l => /第 2 轮/.test(l)), JSON.stringify(report.repeat.log));
  ok('第 2 轮没有把已保存的第 1 条再录一遍', (v.match(/国家奖学金/g) || []).length === 1, v);
}

console.log('\n[11] 真机回归（2026-10-30 诊断）：教育已全部保存时，单问区块照常取值；是否有X经历自动答；授权单列');
{
  const { doc } = boot();
  const p = profileOf();
  p.languages = [p.languages[0]];
  p.internships = [p.internships[0]];
  p.personal[0].__custom = []; // 不定义「是否有校内外实践活动经历 / 是否有获奖经验」自定义字段
  await fillPage(p, { bridge }); // 第一遍：教育两段确认成只读卡
  const hi = cardOf(doc, '最高学历专业类别')[0];
  hi.querySelector('.ant-select-selection__rendered').innerHTML = '<div class="ant-select-selection__placeholder">请选择</div>';
  const report = await fillPage(p, { bridge }); // 第二遍：教育记录都被认成"已保存"
  const row = report.results.find(r => r.slot === 'edu.majorCategory' && /最高学历/.test(r.section));
  ok('最高学历专业类别照常填上（不再报「无对应记录」）', row && row.status === 'filled' && /信息科学与技术类/.test(hi.textContent), JSON.stringify(row && { s: row.status, r: row.reason }));
  ok('「是否有校内外实践活动经历」按资料推断为「否」', /否/.test(cardOf(doc, '实践活动经验')[0].textContent), cardOf(doc, '实践活动经验')[0].textContent.replace(/\s+/g, ''));
  const awardQ = cardOf(doc, '获奖经验').find(c => !c.querySelector('.add_btn'));
  ok('「是否有获奖经验」按资料推断为「是」', /是/.test(awardQ.textContent.replace(/是否有获奖经验/, '')));
  ok('推断出的答案在报告里有标注', report.results.some(r => r.note === 'derived-yesno' && r.status === 'filled'));
  const consent = report.results.filter(r => r.reason === 'consent-manual');
  ok('授权勾选单列为「需要你自己勾」，不再混进标签认不出', consent.length === 3 && !report.results.some(r => r.reason === 'label-uncertain' && /授权/.test(r.section)), JSON.stringify(report.results.filter(r => /授权/.test(r.section)).map(r => r.reason)));
  ok('简历附件旁的文件名框不再报重复', !report.results.some(r => r.reason === 'duplicate-slot' && r.slot === 'personal.resume'));
}

console.log('\n[12] 填写进度回调');
{
  boot();
  const p = profileOf();
  p.languages = [p.languages[0]];
  p.internships = [p.internships[0]];
  const seen = [];
  await fillPage(p, { bridge, onProgress: x => seen.push(x) });
  const stages = [...new Set(seen.map(x => x.stage))];
  ok('依次报告 识别 → 扩充 → 填写 → 确认 → 完成', ['scan', 'expand', 'fill', 'commit', 'done'].every(st => stages.includes(st)), stages.join(','));
  const fills = seen.filter(x => x.stage === 'fill');
  ok('填写阶段带「第几个 / 共几个」和字段名', fills.length > 5 && fills.every(x => x.done <= x.total) && /正在填写 1\//.test(fills[0].text), fills[0] && fills[0].text);
  const r2 = await fillPage(p, { bridge, onProgress: () => { throw new Error('boom'); } });
  ok('进度回调出错不影响填写', r2 && r2.found);
}

console.log('\n[6] 新分类 + 派生字段：项目经历 / 工作经历←实习 / 年龄 / 毕业院校');
{
  const html = `<!doctype html><html><body><form>
    <div class="card"><div class="section-title">个人信息</div>
      <div class="form-item"><label class="form-label">姓名</label><input id="n"></div>
      <div class="form-item"><label class="form-label">年龄</label><input id="age"></div>
      <div class="form-item"><label class="form-label">毕业院校</label><input id="gs"></div>
      <div class="form-item"><label class="form-label">婚姻状况</label><select id="mar"><option value="">请选择</option><option>已婚</option><option>未婚</option></select></div>
    </div>
    <div class="card"><div class="section-title">项目经历</div>
      <div class="form-item"><label class="form-label">项目名称</label><input id="pn"></div>
      <div class="form-item"><label class="form-label">项目职责</label><textarea id="pd"></textarea></div>
      <div class="form-item"><label class="form-label">起止时间</label><input id="pp"></div>
    </div>
    <div class="card"><div class="section-title">工作经历</div>
      <div class="form-item"><label class="form-label">公司名称</label><input id="wc"></div>
      <div class="form-item"><label class="form-label">职位</label><input id="wp"></div>
    </div>
  </form></body></html>`;
  const d = new JSDOM(html, { pretendToBeVisual: true });
  Object.assign(global, { window: d.window, document: d.window.document, Node: d.window.Node, HTMLInputElement: d.window.HTMLInputElement, HTMLTextAreaElement: d.window.HTMLTextAreaElement, HTMLSelectElement: d.window.HTMLSelectElement, getComputedStyle: d.window.getComputedStyle.bind(d.window) });
  const p = defaultProfile();
  p.personal = [{ 姓名: '王五', 出生日期: '2001-01-01', 婚姻状况: '未婚' }];
  p.education = [{ 学校名称: '南山大学', 学历: '本科' }, { 学校名称: '北岸大学', 学历: '硕士' }];
  p.projects = [{ 项目名称: '保温箱成本建模', 项目职责: '负责 DFM', 开始时间: '2025-01-01', 结束时间: '2025-05-01' }];
  p.internships = [{ 单位名称: '示例汽车', 实习岗位: '工程实习生' }];
  await fillPage(p, { bridge, expand: false });
  const $ = id => d.window.document.getElementById(id);
  ok('年龄按出生日期自动算出', /^\d{2}$/.test($('age').value), $('age').value);
  ok('毕业院校取学历最高那段', $('gs').value === '北岸大学', $('gs').value);
  ok('婚姻状况（新枚举）选中未婚', $('mar').value === '未婚', $('mar').value);
  ok('项目经历分类填上', $('pn').value === '保温箱成本建模' && $('pd').value === '负责 DFM');
  ok('起止时间自动拼接', $('pp').value === '2025.01-2025.05', $('pp').value);
  ok('工作经历为空时用实习代替', $('wc').value === '示例汽车' && $('wp').value === '工程实习生', $('wc').value + '/' + $('wp').value);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
