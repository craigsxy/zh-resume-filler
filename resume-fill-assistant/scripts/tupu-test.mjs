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

  const openSelect = sel => {
    closeDropdowns();
    const g = sel.closest('.field-group');
    const opts = OPTIONS[labelOfGroup(g)] || ['选项A', '选项B'];
    const id = 'aria-' + ++ariaSeq;
    sel.setAttribute('aria-controls', id);
    sel.setAttribute('aria-expanded', 'true');
    const host = doc.createElement('div');
    host.innerHTML = `<div class="ant-select-dropdown ant-select-dropdown--single ant-select-dropdown-placement-bottomLeft" style="position:absolute">
      <div style="overflow:auto"><ul role="listbox" id="${id}" class="ant-select-dropdown-menu ant-select-dropdown-menu-root ant-select-dropdown-menu-vertical">
      ${opts.map(o => `<li role="option" unselectable="on" class="ant-select-dropdown-menu-item">${o}</li>`).join('')}
      </ul></div></div>`;
    doc.body.append(host);
    host.querySelectorAll('li').forEach(li =>
      li.addEventListener('click', () => {
        const v = li.textContent.trim();
        sel.querySelector('.ant-select-selection__rendered').innerHTML =
          `<div title="${v}" class="ant-select-selection-selected-value">${v}</div>`;
        sel.setAttribute('aria-expanded', 'false');
        host.querySelector('.ant-select-dropdown').style.display = 'none';
        const err = g.querySelector('.ant-form-explain');
        if (err) err.remove();
      })
    );
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
      if (ctl) ctl.insertAdjacentHTML('beforeend', `<div class="ant-form-explain">请填写${labelOfGroup(g)}</div>`);
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
    const sel = t.closest && t.closest('.ant-select-selection');
    if (sel && !t.closest('.ant-select-dropdown')) return openSelect(sel);
    const cal = t.closest && t.closest('.ant-calendar-picker-input');
    if (cal) return openCalendar(cal);
    const add = t.closest && t.closest('.add_btn');
    if (add) {
      const cardDetail = add.closest('.cardDetail');
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
    { 学校名称: '河海大学', 学历: '本科', 开始时间: '2021-09-01', 结束时间: '2025-06-30', 专业类别: '工学', 专业名称: '机械工程' },
    { 学校名称: '同济大学', 学历: '硕士', 开始时间: '2025-09-01', 结束时间: '2027-06-30', 专业类别: '信息科学与技术类', 专业名称: '机器人与机电方向' },
  ];
  p.languages = [
    { 证书类型: 'TOEFL', 语言成绩: '111' }, // 页面上已保存（只读卡：托福 / 111）
    { 证书类型: 'CET-6', 语言成绩: '580' },
  ];
  p.internships = [
    {
      单位名称: '辉瑞投资有限公司',
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
  ok('教育第 1 段：河海大学 / 本科 / 入学 2021-09-01 / 工学 / 机械工程', /河海大学.*本科.*2021-09-01.*2025-06-30.*工学.*机械工程/.test(eduView), eduView);
  ok('教育第 2 段：同济大学 / 硕士 / 2025-09-01', /同济大学.*硕士.*2025-09-01.*2027-06-30.*信息科学与技术类.*机器人与机电方向/.test(eduView), eduView);

  const lang = cardOf(doc, '英语水平')[0];
  const langView = viewText(lang);
  ok('已保存的托福没有被重复添加', (langView.match(/托福/g) || []).length === 1, langView);
  ok('CET-6 那段新加并确认（英语等级=大学英语六级 / 580）', /大学英语六级.*580/.test(langView), langView);
  ok('报告里说明了"已保存不再重复添加"', report.repeat.log.some(l => /已保存/.test(l)), JSON.stringify(report.repeat.log));

  const exp = cardOf(doc, '实习经历').find(c => c.querySelector('.add_btn'));
  const expView = viewText(exp);
  ok('实习第 2 段自动「添加」出来', exp.querySelectorAll('.section-object').length === 2, expView);
  ok('实习两段都确认成只读卡', exp.querySelectorAll('.section-object.edit_mode').length === 0, expView);
  ok('实习第 1 段：公司 / 起止 / 岗位 / 职责', /辉瑞投资有限公司.*2024-07-01.*2024-09-30.*医学信息实习生.*文献检索与整理/.test(expView), expView);
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
  p.education[0] = { 学校名称: '河海大学', 学历: '本科' }; // 缺入学/毕业日期、专业
  p.languages = [];
  p.internships = [];
  p.awards = [];
  const report = await fillPage(p, { bridge });
  const commits = report.results.filter(r => r.controlKind === 'CARD_COMMIT');
  const blocked = commits.find(r => r.status === 'failed');
  ok('第 1 段确认失败，原因 card-commit-blocked', blocked && blocked.reason === 'card-commit-blocked', JSON.stringify(commits));
  ok('带上了站点的校验提示', blocked && /请填写/.test(blocked.note || ''), blocked && blocked.note);
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

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
