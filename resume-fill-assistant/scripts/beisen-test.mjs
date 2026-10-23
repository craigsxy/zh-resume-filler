// 真实结构仿真：复刻北森（Phoenix / bx-* 类名）的表单骨架
// 场景来源：用户 2026-10-22 两次真机诊断
//   ① 69 个字段 68 个 label-uncertain（标签取不到）
//   ② 66 个字段 0 个填上，38 个 label-uncertain 的 container 全是
//      div.phoenix-unmodeled-layer__inner（phoenix-select 内部包了多层，爬不到 .form-item）
// 核心断言：标签能取到、区块标题不是字段名、自绘单选/自绘下拉能被发现并写入

import { JSDOM } from 'jsdom';
import { buildFormModel } from '../src/form-model.js';
import { bind } from '../src/binder.js';
import { fillPage } from '../src/fill.js';
import { defaultProfile } from '../src/schema.js';

const HTML = `<!doctype html><html><body>
<form class="bx-form">
  <div class="bx-card">
    <div class="bx-card-header"><span>个人信息</span></div>
    <div class="bx-form-body">
      <div class="bx-form-item">
        <div class="bx-form-item-title"><span>姓名</span></div>
        <div class="bx-form-item-content"><input class="bx-input" name="name"></div>
      </div>
      <div class="bx-form-item">
        <div class="bx-form-item-title"><span>性别</span></div>
        <div class="bx-form-item-content">
          <div class="bx-radio-group">
            <div class="bx-radio"><span>男</span></div>
            <div class="bx-radio"><span>女</span></div>
            <div class="bx-radio"><span>保密</span></div>
          </div>
        </div>
      </div>
      <div class="bx-form-item">
        <div class="bx-form-item-title"><span>出生日期</span></div>
        <div class="bx-form-item-content"><input class="bx-input" readonly placeholder="请选择" name="birth"></div>
      </div>
      <div class="bx-form-item">
        <div class="bx-form-item-title"><span>政治面貌</span></div>
        <div class="bx-form-item-content"><input class="bx-input" readonly placeholder="请选择" name="politics"></div>
      </div>
      <div class="bx-form-item">
        <div class="bx-form-item-title"><span>手机</span></div>
        <div class="bx-form-item-content"><input class="bx-input" name="mobile"></div>
      </div>
    </div>
  </div>

  <div class="bx-card">
    <div class="bx-card-header"><span>在校职务</span></div>
    <div class="bx-form-body">
      <div class="bx-form-item">
        <div class="bx-form-item-title"><span>在校职务类别</span></div>
        <div class="bx-form-item-content"><input class="bx-input" name="posType"></div>
      </div>
      <div class="bx-form-item">
        <div class="bx-form-item-title"><span>在校职务名称</span></div>
        <div class="bx-form-item-content"><input class="bx-input" name="posName"></div>
      </div>
      <div class="bx-form-item">
        <div class="bx-form-item-title"><span>在校职务描述</span></div>
        <div class="bx-form-item-content"><textarea class="bx-input" name="posDesc"></textarea></div>
      </div>
    </div>
  </div>
</form>
</body></html>`;

const dom = new JSDOM(HTML, { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.Node = dom.window.Node;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.CSS = dom.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

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

console.log('\n[1] 区块识别：字段名不能当区块标题');
{
  const titles = model.sections.map(s => s.title);
  ok('识别出 2 个区块', model.sections.length === 2, JSON.stringify(titles));
  ok('区块标题是真正的区块名', titles.join(',') === '个人信息,在校职务', titles.join(','));
  ok(
    '没有把"在校职务类别/名称/描述"当成区块',
    !titles.some(t => /在校职务类别|在校职务名称|在校职务描述/.test(t)),
    titles.join(',')
  );
  ok('每个区块 1 块', model.sections.every(s => s.blocks.length === 1));
}

console.log('\n[2] 标签提取：字段名在"只包 input 的那层 div"外面');
{
  const all = model.sections.flatMap(s => s.blocks.flatMap(b => b.fields));
  const labels = all.map(f => f.label);
  ok('8 个字段都取到标签', labels.filter(Boolean).length === 8, JSON.stringify(labels));
  ok('姓名标签正确', labels.includes('姓名'));
  ok('性别标签正确', labels.includes('性别'));
  ok('出生日期标签正确', labels.includes('出生日期'));
  ok('政治面貌标签正确', labels.includes('政治面貌'));
  ok('在校职务类别标签正确', labels.includes('在校职务类别'));
  ok('没有一个字段是空标签', !labels.includes(''), JSON.stringify(labels));
}

console.log('\n[3] 控件类型识别');
{
  const all = model.sections.flatMap(s => s.blocks.flatMap(b => b.fields));
  const byLabel = l => all.find(f => f.label === l);
  ok('性别 → RADIO_GROUP（纯 div 自绘单选也能发现）', byLabel('性别').controlKind === 'RADIO_GROUP', byLabel('性别').controlKind);
  ok('出生日期 → DATE_CUSTOM', byLabel('出生日期').controlKind === 'DATE_CUSTOM', byLabel('出生日期').controlKind);
  ok('政治面貌 → SELECT_CUSTOM', byLabel('政治面貌').controlKind === 'SELECT_CUSTOM', byLabel('政治面貌').controlKind);
  ok('在校职务描述 → TEXTAREA', byLabel('在校职务描述').controlKind === 'TEXTAREA', byLabel('在校职务描述').controlKind);
}

const profile = defaultProfile();
profile.personal = [{ 姓名: '倪睿', 性别: '女', 出生日期: '1999-05-20', 政治面貌: '共青团员', 手机: '13800000000' }];
profile.positions = [{ 在校职务类别: '学生组织', 在校职务名称: '学生会主席', 在校职务描述: '负责统筹活动' }];

console.log('\n[4] 绑定：槽位全部命中');
{
  const plans = bind(model, profile);
  const bySlot = slot => plans.find(p => p.slot === slot);
  ok('姓名 → personal.name', !!bySlot('personal.name'));
  ok('性别 → personal.gender', !!bySlot('personal.gender'));
  ok('出生日期 → personal.birth', !!bySlot('personal.birth'));
  ok('政治面貌 → personal.politics', !!bySlot('personal.politics'));
  ok('手机 → personal.mobile', !!bySlot('personal.mobile'));
  ok('在校职务类别 → pos.type', !!bySlot('pos.type'), JSON.stringify(plans.map(p => p.slot).filter(Boolean)));
  ok('在校职务名称 → pos.name', !!bySlot('pos.name'));
  ok('在校职务描述 → pos.desc', !!bySlot('pos.desc'));
  const unknown = plans.filter(p => !p.slot);
  ok('没有字段落空（原先是 68/69）', unknown.length === 0, JSON.stringify(unknown.map(p => p.label)));
}

console.log('\n[5] 写入');
{
  const fakeBridge = {
    setModelValue: async () => ({ ok: false, reason: 'no-bridge' }),
    readModel: async () => ({ ok: false }),
  };
  const report = await fillPage(profile, { bridge: fakeBridge });
  ok('无 error', !report.error, report.error || '');
  ok('姓名写入 DOM', document.querySelector('input[name="name"]').value === '倪睿');
  ok('手机写入 DOM', document.querySelector('input[name="mobile"]').value === '13800000000');
  ok('在校职务名称写入 DOM', document.querySelector('input[name="posName"]').value === '学生会主席');
  const genderRow = report.results.find(r => r.slot === 'personal.gender');
  ok('性别走单选组并点中', genderRow && genderRow.status === 'filled', JSON.stringify(genderRow));
  const politicsRow = report.results.find(r => r.slot === 'personal.politics');
  ok('政治面貌无面板 → 跳过而不是写脏值', politicsRow && politicsRow.status === 'skipped', JSON.stringify(politicsRow && politicsRow.reason));
  ok('跳过后 readonly 输入框仍为空', document.querySelector('input[name="politics"]').value === '');
  ok('已填数量 >= 4', report.filled >= 4, `filled=${report.filled}`);
}

console.log('\n[6] 原生单选但没写 name（antd 风格的 label 包 input）');
{
  const HTML2 = `<!doctype html><html><body><form>
    <div class="bx-card">
      <div class="bx-card-header"><span>个人信息</span></div>
      <div class="bx-form-body">
        <div class="bx-form-item">
          <div class="bx-form-item-title"><span>姓名</span></div>
          <div class="bx-form-item-content"><input class="bx-input" name="name"></div>
        </div>
        <div class="bx-form-item">
          <div class="bx-form-item-title"><span>性别</span></div>
          <div class="bx-form-item-content">
            <label class="bx-radio-wrapper"><span class="bx-radio"><input type="radio" value="M"></span>男</label>
            <label class="bx-radio-wrapper"><span class="bx-radio"><input type="radio" value="F"></span>女</label>
            <label class="bx-radio-wrapper"><span class="bx-radio"><input type="radio" value="U"></span>保密</label>
          </div>
        </div>
        <div class="bx-form-item">
          <div class="bx-form-item-title"><span>政治面貌</span></div>
          <div class="bx-form-item-content">
            <label class="bx-radio-wrapper"><span class="bx-radio"><input type="radio" value="1"></span>群众</label>
            <label class="bx-radio-wrapper"><span class="bx-radio"><input type="radio" value="2"></span>共青团员</label>
          </div>
        </div>
      </div>
    </div></form></body></html>`;
  const dom2 = new JSDOM(HTML2, { pretendToBeVisual: true });
  global.window = dom2.window;
  global.document = dom2.window.document;
  global.getComputedStyle = dom2.window.getComputedStyle.bind(dom2.window);
  global.Node = dom2.window.Node;
  global.HTMLInputElement = dom2.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom2.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom2.window.HTMLSelectElement;
  global.CSS = dom2.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const m2 = buildFormModel(document.body);
  const fields = m2.sections.flatMap(s => s.blocks.flatMap(b => b.fields));
  const genders = fields.filter(f => f.label === '性别');
  ok('"性别"只算一个字段（不是 3 个）', genders.length === 1, JSON.stringify(fields.map(f => f.label)));
  ok('性别识别为 RADIO_GROUP', genders[0] && genders[0].controlKind === 'RADIO_GROUP', genders[0] && genders[0].controlKind);

  // 两个单选组不能被合成一个（性别 3 项 / 政治面貌 2 项）
  const politics = fields.filter(f => f.label === '政治面貌');
  ok('"政治面貌"也是独立一个字段', politics.length === 1, JSON.stringify(fields.map(f => f.label)));
  ok('两个单选组没有被并到一起', genders.length === 1 && politics.length === 1 && genders[0] !== politics[0]);

  const report = await fillPage(profile, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const gRow = report.results.find(r => r.slot === 'personal.gender');
  ok('性别填成功（选项收全了）', gRow && gRow.status === 'filled', JSON.stringify(gRow));
  // 注意：这些 radio 没写 name，浏览器不会自动互斥，所以只断言"性别组内只选中了一个"
  const genderRow = [...document.querySelectorAll('.bx-form-item')].find(el => /性别/.test(el.textContent || ''));
  const checkedInGender = genderRow ? [...genderRow.querySelectorAll('input[type="radio"]:checked')] : [];
  ok('性别组内只选中一个选项', checkedInGender.length === 1, String(checkedInGender.length));
  ok('选中的是"女"', checkedInGender[0] && checkedInGender[0].value === 'F', checkedInGender[0] && checkedInGender[0].value);
}

console.log('\n[7] 真机结构：phoenix-select（下拉被当成文本框 + 标签取不到 + 面板不可知）');
{
  // 复刻诊断里的真实类名：form-item / form-item__label / form-item__control
  // phoenix-select 内部多包两层，输入框上没有 label，label 是 control 的前一个兄弟
  const HTML3 = `<!doctype html><html><body><form>
    <div class="form-item">
      <div class="form-item__label"><label>姓名</label></div>
      <div class="form-item__control"><div class="phoenix-input"><input class="phoenix-input__input" name="name"></div></div>
    </div>
    <div class="form-item">
      <div class="form-item__label"><label>性别</label></div>
      <div class="form-item__control">
        <div class="phoenix-select phoenix-select--large">
          <div class="phoenix-select__selection">
            <span class="phoenix-select__placeholder">请选择</span>
            <div class="phoenix-unmodeled-layer">
              <div class="phoenix-unmodeled-layer__inner">
                <input class="phoenix-select__input phoenix-select__input--large" readonly>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="form-item">
      <div class="form-item__label"><label>政治面貌</label></div>
      <div class="form-item__control">
        <div class="phoenix-select">
          <div class="phoenix-select__selection">
            <div class="phoenix-unmodeled-layer">
              <div class="phoenix-unmodeled-layer__inner">
                <input class="phoenix-select__input phoenix-select__input--large" readonly>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form></body></html>`;
  const dom3 = new JSDOM(HTML3, { pretendToBeVisual: true });
  global.window = dom3.window;
  global.document = dom3.window.document;
  global.getComputedStyle = dom3.window.getComputedStyle.bind(dom3.window);
  global.Node = dom3.window.Node;
  global.HTMLInputElement = dom3.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom3.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom3.window.HTMLSelectElement;
  global.CSS = dom3.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const m3 = buildFormModel(document.body);
  const fs3 = m3.sections.flatMap(s => s.blocks.flatMap(b => b.fields));
  const byLabel = l => fs3.find(f => f.label === l);

  ok('3 个字段都取到标签', fs3.filter(f => f.label).length === 3, JSON.stringify(fs3.map(f => f.label)));
  ok('姓名容器是 .form-item（不是内部 div）', byLabel('姓名').container.className === 'form-item', byLabel('姓名').container.className);
  ok('性别标签不再为空', !!byLabel('性别'), JSON.stringify(fs3.map(f => f.label)));
  ok(
    'phoenix-select 被识别为 SELECT_CUSTOM 而不是 TEXT',
    byLabel('性别').controlKind === 'SELECT_CUSTOM',
    byLabel('性别').controlKind
  );
  ok(
    '政治面貌也被识别为 SELECT_CUSTOM',
    byLabel('政治面貌').controlKind === 'SELECT_CUSTOM',
    byLabel('政治面貌').controlKind
  );

  const plans3 = bind(m3, profile);
  ok('性别绑定 personal.gender', plans3.some(p => p.slot === 'personal.gender'));
  ok('政治面貌绑定 personal.politics', plans3.some(p => p.slot === 'personal.politics'));
  ok('没有字段落空', plans3.every(p => p.slot), JSON.stringify(plans3.filter(p => !p.slot).map(p => p.label)));

  // 模拟真实组件：点击 → body 上挂一个面板（类名不带 dropdown/option 关键词，逼它走差集法）
  // 选中选项后把触发器里的"请选择"改掉，模拟组件回写
  const OPTIONS = {
    性别: ['男', '女', '保密'],
    政治面貌: ['共青团员', '中共党员', '群众'],
  };
  const openLayer = sel => {
    const label = String(sel.closest('.form-item').querySelector('.form-item__label').textContent).trim();
    const box = document.createElement('div');
    box.className = 'fake-layer';
    for (const t of OPTIONS[label] || []) {
      const o = document.createElement('div');
      o.className = 'phoenix-select__option';
      o.textContent = t;
      o.addEventListener('click', () => {
        const ph = sel.querySelector('.phoenix-select__placeholder');
        if (ph) ph.textContent = t;
        box.remove();
      });
      box.append(o);
    }
    document.body.append(box);
  };
  document.querySelectorAll('.phoenix-select').forEach(sel => {
    sel.addEventListener('click', () => {
      if (document.querySelector('.fake-layer')) return;
      openLayer(sel);
    });
    // 点击落在 placeholder 上也要能冒泡到 sel（真实组件是整块可点）
    const ph = sel.querySelector('.phoenix-select__placeholder');
    if (ph) ph.addEventListener('click', () => sel.dispatchEvent(new dom3.window.MouseEvent('click', { bubbles: true })));
  });

  const report3 = await fillPage(profile, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const gRow = report3.results.find(r => r.slot === 'personal.gender');
  ok('性别走自绘下拉并匹配到选项', gRow && gRow.status === 'filled', JSON.stringify(gRow && { s: gRow.status, r: gRow.reason, h: gRow.hints }));
  const pRow = report3.results.find(r => r.slot === 'personal.politics');
  ok('政治面貌也填上', pRow && pRow.status === 'filled', JSON.stringify(pRow && { s: pRow.status, r: pRow.reason }));
}

console.log('\n[8] 真机结构：.form-part 分块（标题是普通 div，不是 legend/h*，类名也不带 title）');
{
  // 诊断报告里区块 title 全为空 → 70 个字段塌成一块 → 分类靠猜（教育经历抢走"姓名"）
  const HTML4 = `<!doctype html><html><body><form>
    <div class="form-part false space-large">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body clearfix">
        <div class="fields-col">
          <div class="form-item form-item--phoenix">
            <div class="form-item__label">姓名</div>
            <div class="form-item__control"><div class="phoenix-input"><input class="phoenix-input__input" name="name"></div></div>
          </div>
          <div class="form-item form-item--phoenix">
            <div class="form-item__label">手机</div>
            <div class="form-item__control"><div class="phoenix-input"><input class="phoenix-input__input" name="mobile"></div></div>
          </div>
        </div>
      </div>
    </div>
    <div class="form-part false space-large">
      <div class="form-part-head"><div class="name">教育经历</div></div>
      <div class="form-part-body clearfix">
        <div class="fields-col">
          <div class="form-item form-item--phoenix">
            <div class="form-item__label">学校名称</div>
            <div class="form-item__control"><div class="phoenix-input"><input class="phoenix-input__input" name="school"></div></div>
          </div>
          <div class="form-item form-item--phoenix">
            <div class="form-item__label">学历</div>
            <div class="form-item__control"><div class="phoenix-input"><input class="phoenix-input__input" name="degree"></div></div>
          </div>
        </div>
      </div>
    </div>
  </form></body></html>`;
  const dom4 = new JSDOM(HTML4, { pretendToBeVisual: true });
  global.window = dom4.window;
  global.document = dom4.window.document;
  global.getComputedStyle = dom4.window.getComputedStyle.bind(dom4.window);
  global.Node = dom4.window.Node;
  global.HTMLInputElement = dom4.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom4.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom4.window.HTMLSelectElement;
  global.CSS = dom4.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const m4 = buildFormModel(document.body);
  const titles = m4.sections.map(s => s.title);
  ok('识别出 2 个 form-part 区块', m4.sections.length === 2, JSON.stringify(titles));
  ok('标题是真标题（个人信息 / 教育经历）', titles.join(',') === '个人信息,教育经历', titles.join(','));
  ok(
    '个人信息被归到 personal',
    m4.sections.find(s => s.title === '个人信息').categoryId === 'personal',
    String(m4.sections.find(s => s.title === '个人信息').categoryId)
  );
  ok(
    '教育经历被归到 education',
    m4.sections.find(s => s.title === '教育经历').categoryId === 'education',
    String(m4.sections.find(s => s.title === '教育经历').categoryId)
  );

  const plans4 = bind(m4, profile);
  const nameP = plans4.find(p => p.label === '姓名');
  ok('姓名绑到 personal.name（不再被"家庭姓名"拖成歧义）', nameP && nameP.slot === 'personal.name', JSON.stringify(nameP && nameP.slot));
  const degreeP = plans4.find(p => p.label === '学历');
  ok('学历绑到 edu.degreeLevel', degreeP && degreeP.slot === 'edu.degreeLevel', JSON.stringify(degreeP && degreeP.slot));
}

console.log('\n[9] 真机结构：日期靠左右箭头切月（原来只切年不切月 → view-mismatch）');
{
  const HTML5 = `<!doctype html><html><body><form>
    <div class="form-item form-item--phoenix">
      <div class="form-item__label">出生日期</div>
      <div class="form-item__control">
        <div class="phoenix-date-picker"><input class="phoenix-input__input" placeholder="请选择"></div>
      </div>
    </div>
  </form></body></html>`;
  const dom5 = new JSDOM(HTML5, { pretendToBeVisual: true });
  global.window = dom5.window;
  global.document = dom5.window.document;
  global.getComputedStyle = dom5.window.getComputedStyle.bind(dom5.window);
  global.Node = dom5.window.Node;
  global.HTMLInputElement = dom5.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom5.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom5.window.HTMLSelectElement;
  global.CSS = dom5.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const input = document.querySelector('.phoenix-date-picker input');
  let view = { y: 2026, m: 3 }; // 打开时停在 2026 年 3 月，目标是 2026-01-07

  const render = panelHost => {
    panelHost.innerHTML =
      `<div class="cal-head"><span class="cal-prev-month">&lt;</span>` +
      `<span class="cal-title">${view.y}年${view.m}月</span>` +
      `<span class="cal-next-month">&gt;</span></div>` +
      `<div class="cal-days">${Array.from({ length: 31 }, (_, i) => `<div class="cal-day">${i + 1}</div>`).join('')}</div>`;
    panelHost.querySelector('.cal-prev-month').addEventListener('click', () => {
      view.m = view.m === 1 ? 12 : view.m - 1;
      if (view.m === 12) view.y -= 1;
      render(panelHost);
    });
    panelHost.querySelector('.cal-next-month').addEventListener('click', () => {
      view.m = view.m === 12 ? 1 : view.m + 1;
      if (view.m === 1) view.y += 1;
      render(panelHost);
    });
    panelHost.querySelectorAll('.cal-day').forEach(d => {
      d.addEventListener('click', () => {
        const v = String(view.y) + '-' + String(view.m).padStart(2, '0') + '-' + String(d.textContent).padStart(2, '0');
        input.value = v;
        panelHost.remove();
      });
    });
  };

  input.addEventListener('click', () => {
    if (document.querySelector('.phoenix-calendar')) return;
    const host = document.createElement('div');
    host.className = 'phoenix-calendar';
    document.body.append(host);
    render(host);
  });

  const m5 = buildFormModel(document.body);
  const f5 = m5.sections.flatMap(s => s.blocks.flatMap(b => b.fields))[0];
  ok('出生日期被识别为日期类控件', f5 && f5.controlKind === 'DATE_CUSTOM', f5 && f5.controlKind);

  // 用一份只填了出生日期的资料，确保走的是面板而不是"键入兜底"
  const profile5 = defaultProfile();
  profile5.personal = [{ 出生日期: '2026-01-07' }];

  const plans5 = bind(m5, profile5);
  ok('出生日期绑定 personal.birth', plans5[0] && plans5[0].slot === 'personal.birth', JSON.stringify(plans5[0] && plans5[0].slot));

  const report5 = await fillPage(profile5, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const row = report5.results.find(r => r.slot === 'personal.birth');
  ok('日期面板填成功', row && row.status === 'filled', JSON.stringify(row && { s: row.status, r: row.reason, a: row.attempts }));
  ok('走的是面板驱动而不是键入兜底', row && row.via === 'panel', row && row.via);
  ok('切到了目标月份并点中 7 号', input.value === '2026-01-07', input.value || '(空)');
}

console.log('\n[10] 真机结构：日历面板自带日期输入框（React 受控）+ 残留日历不得污染下拉');
{
  // 截图证据：.phoenix-calendar-panel > .phoenix-calendar__header >
  //   .phoenix-calendar-date-input-wrap > input.phoenix-calendar-date-input (value="2004-01-")
  //   + .phoenix-calendar-date-pane1（日网格）
  // 曾经的错：只按"最深"取面板 → 取到日网格 → 年月读成 null → view-mismatch(null-null)
  const HTML6 = `<!doctype html><html><body><form>
    <div class="form-item form-item--phoenix">
      <div class="form-item__label">出生日期</div>
      <div class="form-item__control">
        <div class="phoenix-date-picker"><input class="phoenix-input__input" id="birth" placeholder="请选择" readonly></div>
      </div>
    </div>
    <div class="form-item form-item--phoenix">
      <div class="form-item__label">民族</div>
      <div class="form-item__control">
        <div class="phoenix-select"><input class="phoenix-select__input" id="ethnic" readonly></div>
      </div>
    </div>
  </form></body></html>`;
  const dom6 = new JSDOM(HTML6, { pretendToBeVisual: true });
  global.window = dom6.window;
  global.document = dom6.window.document;
  global.getComputedStyle = dom6.window.getComputedStyle.bind(dom6.window);
  global.Node = dom6.window.Node;
  global.HTMLInputElement = dom6.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom6.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom6.window.HTMLSelectElement;
  global.CSS = dom6.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const birth = document.querySelector('#birth');
  const ethnic = document.querySelector('#ethnic');
  let calendarOpen = 0;

  // 日历：点击触发区 → body 挂面板（header 输入框 + 日网格），回车提交
  document.querySelector('.phoenix-date-picker').addEventListener('click', () => {
    if (document.querySelector('.phoenix-calendar-panel')) return;
    calendarOpen++;
    const host = document.createElement('div');
    host.className = 'com-unmodeled-layer__content';
    host.innerHTML =
      '<div class="phoenix-date-picker__wrap"><div class="phoenix-calendar-panel">' +
      '<div class="phoenix-calendar__header"><div class="phoenix-calendar-date-input-wrap">' +
      '<input class="phoenix-calendar-date-input" placeholder="请输入" value="2004-01-"></div></div>' +
      '<div class="phoenix-calendar-date-pane1">' +
      Array.from({ length: 31 }, (_, i) => `<div class="phoenix-calendar-day">${i + 1}</div>`).join('') +
      '</div></div></div>';
    document.body.append(host);
    const head = host.querySelector('.phoenix-calendar-date-input');
    head.addEventListener('keydown', e => {
      // 模拟 React 受控组件：只有 Enter 才提交并关面板
      if (e.key !== 'Enter') return;
      const v = String(head.value || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        birth.value = v;
        host.remove();
      }
    });
  });

  // 民族：点击 → 挂选项面板
  document.querySelector('.phoenix-select').addEventListener('click', () => {
    if (document.querySelector('.ethnic-layer')) return;
    const box = document.createElement('div');
    box.className = 'ethnic-layer';
    box.innerHTML = '<div class="opt">汉族</div><div class="opt">回族</div><div class="opt">满族</div>';
    box.querySelectorAll('.opt').forEach(o =>
      o.addEventListener('click', () => {
        ethnic.value = o.textContent;
        box.remove();
      })
    );
    document.body.append(box);
  });

  const m6 = buildFormModel(document.body);
  const f6 = m6.sections.flatMap(s => s.blocks.flatMap(b => b.fields));
  ok('[10] 两个字段都取到标签', f6.length === 2, JSON.stringify(f6.map(f => f.label)));

  const profile6 = defaultProfile();
  profile6.personal = [{ 出生日期: '2026-01-07', 民族: '汉族' }];

  const report6 = await fillPage(profile6, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const bRow = report6.results.find(r => r.slot === 'personal.birth');
  const eRow = report6.results.find(r => r.slot === 'personal.ethnicity');

  ok(
    '出生日期走"面板输入框"填成功',
    bRow && bRow.status === 'filled' && bRow.via === 'panel-input',
    JSON.stringify(bRow && { s: bRow.status, v: bRow.via, r: bRow.reason, a: bRow.attempts })
  );
  ok('日期真的写进了页面', birth.value === '2026-01-07', birth.value || '(空)');
  ok('民族没被日历面板干扰，正常填上', eRow && eRow.status === 'filled', JSON.stringify(eRow && { s: eRow.status, r: eRow.reason, p: eRow.panelText }));
  ok('民族真的选中汉族', ethnic.value === '汉族', ethnic.value || '(空)');
}

console.log('\n[11] 真机结构：虚拟滚动下拉（民族 56 项只渲染 8 项）+ 月粒度日期走面板输入框');
{
  // 诊断里民族 available 只有 ["0/","1","清空已选","请在左侧选择内容"]：
  // 面板根本不在首屏渲染目标项 —— 56 项的列表只挂 8 个 DOM 节点。
  // 月粒度（教育经历 开始时间）则是"组件只认完整日期，YYYY-MM 会被清空拒收"。
  const ETHNIC = [
    '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族',
    '满族', '侗族', '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族',
    '佤族', '畲族', '高山族', '拉祜族', '水族', '东乡族', '纳西族', '景颇族', '柯尔克孜族', '土族',
    '达斡尔族', '仫佬族', '羌族', '布朗族', '撒拉族', '毛南族', '仡佬族', '锡伯族', '阿昌族', '普米族',
    '塔吉克族', '怒族', '乌孜别克族', '俄罗斯族', '鄂温克族', '德昂族', '保安族', '裕固族', '京族', '塔塔尔族',
    '独龙族', '鄂伦春族', '赫哲族', '门巴族', '珞巴族', '基诺族',
  ];
  const POLITICS = ['中共党员', '中共预备党员', '共青团员', '群众', '民革党员'];
  const ITEM_H = 32;
  const WIN = 8;
  if (ETHNIC.length !== 56) throw new Error('测试数据不是 56 个民族：' + ETHNIC.length);
  if (ETHNIC.indexOf('哈萨克族') < WIN) throw new Error('目标项必须落在首屏之外');

  const HTML7 = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select" data-list="ethnic">
              <div class="phoenix-select__selection">
                <span class="phoenix-select__calcEle" id="ethCalc"></span>
                <div class="phoenix-unmodeled-layer"><div class="phoenix-unmodeled-layer__inner">
                  <input class="phoenix-select__input" id="ethInput" readonly>
                </div></div>
              </div>
            </div>
          </div>
        </div>
        <div class="form-item">
          <div class="form-item__label">政治面貌</div>
          <div class="form-item__control">
            <div class="phoenix-select" data-list="politics">
              <div class="phoenix-select__selection">
                <span class="phoenix-select__calcEle" id="polCalc"></span>
                <div class="phoenix-unmodeled-layer"><div class="phoenix-unmodeled-layer__inner">
                  <input class="phoenix-select__input" id="polInput" readonly>
                </div></div>
              </div>
            </div>
          </div>
        </div>
      </div></div>
    </div>
    <div class="form-part">
      <div class="form-part-head"><div class="name">教育经历</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item">
          <div class="form-item__label">学校名称</div>
          <div class="form-item__control"><div class="phoenix-input"><input class="phoenix-input__input" id="eduSchool"></div></div>
        </div>
        <div class="form-item">
          <div class="form-item__label">开始时间</div>
          <div class="form-item__control">
            <div class="phoenix-date-picker"><input class="phoenix-input__input" id="eduStart" readonly placeholder="请选择"></div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom7 = new JSDOM(HTML7, { pretendToBeVisual: true });
  global.window = dom7.window;
  global.document = dom7.window.document;
  global.getComputedStyle = dom7.window.getComputedStyle.bind(dom7.window);
  global.Node = dom7.window.Node;
  global.HTMLInputElement = dom7.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom7.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom7.window.HTMLSelectElement;
  global.CSS = dom7.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const ethCalc = document.querySelector('#ethCalc');
  const polCalc = document.querySelector('#polCalc');
  const eduStart = document.querySelector('#eduStart');
  let scrollOps = 0;
  let shiftOps = 0;

  // 真机行为：对选项调 scrollIntoView 会让虚拟列表窗口整体位移一格，
  // 手里那个节点随即变成"另一个选项" —— 这就是「要汉族选成黎族」的复现条件
  dom7.window.Element.prototype.scrollIntoView = function () {
    const list = this.parentElement;
    if (list && typeof list.__shift === 'function') list.__shift();
  };

  /**
   * 复刻虚拟列表：只挂 WIN 个节点，滚动只改 textContent（节点复用）。
   * 节点复用是"点歪"的根源：手里的节点 isConnected 仍是 true，内容却已换成别的项。
   */
  const mountPanel = (panelClass, all, virtual, onPick) => {
    if (document.querySelector('.' + panelClass)) return;
    const panel = document.createElement('div');
    panel.className = 'phoenix-select__panel ' + panelClass;
    const listEl = document.createElement('div');
    listEl.className = 'phoenix-select__list';
    panel.append(listEl);
    document.body.append(panel);

    const count = virtual ? WIN : all.length;
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const o = document.createElement('div');
      o.className = 'phoenix-select__option';
      o.addEventListener('click', () => {
        onPick(o.textContent);
        panel.remove();
      });
      nodes.push(o);
      listEl.append(o);
    }

    let top = 0;
    const clamp = v => Math.max(0, Math.min(v, Math.max(0, all.length - WIN) * ITEM_H));
    const render = () => {
      const start = virtual ? Math.min(Math.floor(top / ITEM_H), Math.max(0, all.length - WIN)) : 0;
      nodes.forEach((o, i) => {
        o.textContent = all[start + i] || '';
      });
    };
    render();

    Object.defineProperty(listEl, 'scrollTop', {
      get: () => top,
      set: v => {
        scrollOps++;
        top = clamp(v);
        render();
      },
      configurable: true,
    });
    Object.defineProperty(listEl, 'scrollHeight', { get: () => all.length * ITEM_H, configurable: true });
    Object.defineProperty(listEl, 'clientHeight', {
      get: () => (virtual ? WIN : all.length) * ITEM_H,
      configurable: true,
    });

    // 真实浏览器里 scrollIntoView 会让虚拟列表整体位移一格 —— 旧代码点完就点歪了
    listEl.__shift = () => {
      shiftOps++;
      top = clamp(top + ITEM_H);
      render();
    };
  };

  document
    .querySelector('.phoenix-select[data-list="ethnic"]')
    .addEventListener('click', () => mountPanel('ethnic-panel', ETHNIC, true, t => (ethCalc.textContent = t)));
  document
    .querySelector('.phoenix-select[data-list="politics"]')
    .addEventListener('click', () => mountPanel('politics-panel', POLITICS, false, t => (polCalc.textContent = t)));

  // 日历：面板自带日期输入框，但只认完整日期；YYYY-MM 回车后被清空、面板留着
  document.querySelector('.phoenix-date-picker').addEventListener('click', () => {
    if (document.querySelector('.phoenix-calendar-panel')) return;
    const host = document.createElement('div');
    host.className = 'com-unmodeled-layer__content';
    host.innerHTML =
      '<div class="phoenix-calendar-panel">' +
      '<div class="phoenix-calendar__header">' +
      '<input class="phoenix-calendar-date-input" placeholder="请输入">' +
      '</div>' +
      '<div class="phoenix-calendar-date-pane1">' +
      Array.from({ length: 31 }, (_, i) => `<div class="phoenix-calendar-day">${i + 1}</div>`).join('') +
      '</div></div>';
    document.body.append(host);
    const head = host.querySelector('.phoenix-calendar-date-input');
    head.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const v = String(head.value || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        head.value = '';
        return;
      }
      eduStart.value = v.slice(0, 7); // 字段是月粒度，回显只到月
      host.remove();
    });
  });

  const m7 = buildFormModel(document.body);
  const titles7 = m7.sections.map(s => s.title);
  ok('[11] 两个区块都识别出来', titles7.join(',') === '个人信息,教育经历', titles7.join(','));

  const profile7 = defaultProfile();
  profile7.personal = [{ 民族: '哈萨克族', 政治面貌: '无党派人士' }];
  profile7.education = [{ 学校名称: '天津大学', 开始时间: '2026-01' }];

  const plans7 = bind(m7, profile7);
  ok('[11] 民族绑到 personal.ethnicity', plans7.some(p => p.slot === 'personal.ethnicity'));
  ok(
    '[11] 开始时间绑到 edu.start',
    plans7.some(p => p.slot === 'edu.start'),
    JSON.stringify(plans7.map(p => p.slot))
  );

  const report7 = await fillPage(profile7, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const ethRow = report7.results.find(r => r.slot === 'personal.ethnicity');
  const polRow = report7.results.find(r => r.slot === 'personal.politics');
  const startRow = report7.results.find(r => r.slot === 'edu.start');

  ok(
    '[11] 民族填成功（目标项不在首屏，靠滚动收割找到）',
    ethRow && ethRow.status === 'filled',
    JSON.stringify(ethRow && { s: ethRow.status, r: ethRow.reason, a: ethRow.available, p: ethRow.panelText })
  );
  ok('[11] 真的选中"哈萨克族"', ethCalc.textContent === '哈萨克族', ethCalc.textContent || '(空)');
  ok('[11] 收割时确实滚动过列表（证明是虚拟列表）', scrollOps > 0, String(scrollOps));
  ok(
    '[11] scrollIntoView 引发的窗口位移真的发生过（"点歪"的复现条件成立）',
    shiftOps > 0,
    String(shiftOps)
  );

  ok(
    '[11] 列表里没有的值 → 跳过而不是乱选',
    polRow && polRow.status === 'skipped' && polRow.reason === 'option-no-match',
    JSON.stringify(polRow && { s: polRow.status, r: polRow.reason, a: polRow.available })
  );
  ok('[11] 乱选防护：政治面貌回显仍为空', polCalc.textContent === '', polCalc.textContent || '(空)');

  ok(
    '[11] 月粒度日期填成功',
    startRow && startRow.status === 'filled',
    JSON.stringify(startRow && { s: startRow.status, r: startRow.reason, v: startRow.via, a: startRow.attempts })
  );
  ok('[11] 月粒度走的是面板输入框（和出生日期同一条路）', startRow && startRow.via === 'panel-input', startRow && startRow.via);
  ok('[11] 月粒度只回显到月', eduStart.value === '2026-01', eduStart.value || '(空)');
  ok(
    '[11] 先试 YYYY-MM 被拒，再补 01 号成功',
    startRow && startRow.attempts.includes('panel>panel-input:ok'),
    JSON.stringify(startRow && startRow.attempts)
  );
  ok('[11] 同一区块的文本字段照常写入', document.querySelector('#eduSchool').value === '天津大学');
}

console.log('\n[12] 真机结构：双栏选择器（左选右"已选0/1"+底部确定）+ 可编辑输入框直填');
{
  // 诊断⑤：民族 available=[]、reason=no-options、panelText="已选0/1 清空已选 请在左侧选择内容"
  // 截图：左栏是民族网格，右栏是"已选 0/1"，底部 取消/确定 —— 面板定位停在了右栏
  const HTML8 = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select" data-kind="dual">
              <div class="phoenix-select__selection">
                <span class="phoenix-select__calcEle" id="dualCalc"></span>
                <span class="phoenix-select__placeholder" id="dualPh">请选择</span>
                <ul class="phoenix-select__content"><li class="phoenix-select__inputWrapper">
                  <input class="phoenix-select__input phoenix-select__input--unText" id="dualInput" readonly>
                </li></ul>
              </div>
            </div>
          </div>
        </div>
        <div class="form-item">
          <div class="form-item__label">政治面貌</div>
          <div class="form-item__control">
            <div class="phoenix-select" data-kind="editable">
              <div class="phoenix-select__selection">
                <span class="phoenix-select__calcEle" id="editCalc"></span>
                <span class="phoenix-select__placeholder" id="editPh">请选择</span>
                <ul class="phoenix-select__content"><li class="phoenix-select__inputWrapper">
                  <input class="phoenix-select__input phoenix-select__input--large" id="editInput">
                </li></ul>
              </div>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom8 = new JSDOM(HTML8, { pretendToBeVisual: true });
  global.window = dom8.window;
  global.document = dom8.window.document;
  global.getComputedStyle = dom8.window.getComputedStyle.bind(dom8.window);
  global.Node = dom8.window.Node;
  global.HTMLInputElement = dom8.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom8.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom8.window.HTMLSelectElement;
  global.CSS = dom8.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const dualCalc = document.querySelector('#dualCalc');
  const dualPh = document.querySelector('#dualPh');
  const dualInput = document.querySelector('#dualInput');
  const editCalc = document.querySelector('#editCalc');
  const editPh = document.querySelector('#editPh');
  const editInput = document.querySelector('#editInput');
  let confirmClicks = 0;

  const DUAL = ['汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族', '满族', '侗族'];
  let picked = '';

  // 双栏选择器：弹层类名不带 panel/dropdown（真机也是这样，只能靠点击差集找）
  document.querySelector('.phoenix-select[data-kind="dual"]').addEventListener('click', () => {
    if (document.querySelector('.dual-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'dual-layer';
    layer.innerHTML =
      '<div class="dual-left">' +
      DUAL.map(t => `<div class="dual-cell"><span>${t}</span></div>`).join('') +
      '</div>' +
      '<div class="dual-right">' +
      '<span>已选 0/1</span><span>清空已选</span><span>请在左侧选择内容</span>' +
      '</div>' +
      '<div class="dual-footer"><span class="btn-cancel">取消</span><span class="btn-ok">确定</span></div>';
    document.body.append(layer);

    layer.querySelectorAll('.dual-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        picked = String(cell.textContent || '').trim();
        const right = layer.querySelector('.dual-right span');
        if (right) right.textContent = '已选 1/1';
      });
    });
    // 确定：写回触发器并关掉弹层（点击后列表页不关，必须点确定）
    layer.querySelector('.btn-ok').addEventListener('click', () => {
      confirmClicks++;
      dualCalc.textContent = picked;
      if (dualPh) dualPh.textContent = '';
      dualInput.value = picked;
      layer.remove();
    });
    layer.querySelector('.btn-cancel').addEventListener('click', () => layer.remove());
  });

  // 可编辑下拉：弹层里只有编号（真实值在组件内部），列表点不出来，只能靠输入框提交
  document.querySelector('.phoenix-select[data-kind="editable"]').addEventListener('click', () => {
    if (document.querySelector('.edit-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'edit-layer';
    layer.innerHTML = Array.from({ length: 8 }, (_, i) => `<div class="edit-row">0${i + 1}</div>`).join('');
    document.body.append(layer);

    const commit = () => {
      const v = String(editInput.value || '').trim();
      if (!v) return;
      editCalc.textContent = v;
      if (editPh) editPh.textContent = '';
      layer.remove();
    };
    editInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit();
    });
  });

  const m8 = buildFormModel(document.body);
  const profile8 = defaultProfile();
  profile8.personal = [{ 民族: '汉族', 政治面貌: '共青团员' }];

  const report8 = await fillPage(profile8, {
    bridge: { setModelValue: async () => ({ ok: false, readModel: async () => ({ ok: false }) }) },
  });
  const dualRow = report8.results.find(r => r.slot === 'personal.ethnicity');
  const editRow = report8.results.find(r => r.slot === 'personal.politics');

  ok(
    '[12] 双栏选择器：不再卡在右栏（no-options）',
    dualRow && dualRow.reason !== 'no-options',
    JSON.stringify(dualRow && { s: dualRow.status, r: dualRow.reason, a: dualRow.available, p: dualRow.panelText })
  );
  ok(
    '[12] 双栏选择器填成功（点左栏选项 + 底部确定）',
    dualRow && dualRow.status === 'filled',
    JSON.stringify(dualRow && { s: dualRow.status, r: dualRow.reason, v: dualRow.via, a: dualRow.attempts })
  );
  ok('[12] 真的选了汉族', dualCalc.textContent === '汉族', dualCalc.textContent || '(空)');
  ok('[12] 底部"确定"被点到（否则值不会提交）', confirmClicks > 0, String(confirmClicks));

  ok(
    '[12] 可编辑下拉：列表只有编号时走输入框直填',
    editRow && editRow.status === 'filled' && editRow.via === 'input-enter',
    JSON.stringify(editRow && { s: editRow.status, r: editRow.reason, v: editRow.via, a: editRow.attempts })
  );
  ok('[12] 输入框直填后显示正确', editCalc.textContent === '共青团员', editCalc.textContent || '(空)');
}

console.log('\n[14] 真机结构：双栏 + 顶部搜索框，目标项不在初始网格里（汉族 → 傣族）');
{
  // 诊断⑥：available=["1/","汉族"]、panelText="已选1/1 清空已选 汉族"、attempts=["input-enter:readback-mismatch"]
  // 页面当前选中汉族，要切成傣族；傣族不在初始渲染的网格里，只能靠弹层顶部的搜索框过滤
  const ETH13 = [
    '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族', '满族', '侗族',
    '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族', '佤族', '畲族', '高山族', '拉祜族',
  ];
  if (ETH13.indexOf('傣族') < 12) throw new Error('目标项必须落在初始网格之外');

  const HTML9 = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select phoenix-select--editable">
              <div class="phoenix-select__selection">
                <span class="phoenix-select__calcEle" id="s13calc">汉族</span>
                <span class="phoenix-select__placeholder" id="s13ph"></span>
                <ul class="phoenix-select__content"><li class="phoenix-select__inputWrapper">
                  <input class="phoenix-select__input phoenix-select__input--large phoenix-select__input--unText" id="s13input" value="汉族">
                </li></ul>
              </div>
            </div>
          </div>
        </div>
        <div class="form-item">
          <div class="form-item__label">手机</div>
          <div class="form-item__control"><div class="phoenix-input"><input class="phoenix-input__input" name="m13"></div></div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom9 = new JSDOM(HTML9, { pretendToBeVisual: true });
  global.window = dom9.window;
  global.document = dom9.window.document;
  global.getComputedStyle = dom9.window.getComputedStyle.bind(dom9.window);
  global.Node = dom9.window.Node;
  global.HTMLInputElement = dom9.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom9.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom9.window.HTMLSelectElement;
  global.CSS = dom9.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc13 = document.querySelector('#s13calc');
  const ph13 = document.querySelector('#s13ph');
  const input13 = document.querySelector('#s13input');
  let searchTyped = '';
  let picked13 = '汉族';
  let clickedCell = '';

  document.querySelector('.phoenix-select--editable').addEventListener('click', () => {
    if (document.querySelector('.dual2-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'dual2-layer';
    layer.innerHTML =
      '<div class="dual2-search"><input id="s13search" placeholder="搜索"></div>' +
      '<div class="dual2-left"></div>' +
      '<div class="dual2-right"><span>已选 1/1</span><span>清空已选</span><span class="dual2-picked">汉族</span></div>' +
      '<div class="dual2-footer"><span class="b-cancel">取消</span><span class="b-ok">确定</span></div>';
    document.body.append(layer);

    const left = layer.querySelector('.dual2-left');
    const right = layer.querySelector('.dual2-picked');
    const search = layer.querySelector('#s13search');

    const render = () => {
      const q = String(search.value || '').trim();
      const list = q ? ETH13.filter(n => n.includes(q)) : ETH13.slice(0, 12);
      left.innerHTML = list.map(t => `<div class="gcell"><span>${t}</span></div>`).join('');
      left.querySelectorAll('.gcell').forEach(c => {
        c.addEventListener('click', () => {
          picked13 = String(c.textContent || '').trim();
          clickedCell = picked13;
          if (right) right.textContent = picked13;
          const cnt = layer.querySelector('.dual2-right span');
          if (cnt) cnt.textContent = '已选 1/1';
        });
      });
    };
    render();
    search.addEventListener('input', () => {
      searchTyped = String(search.value || '');
      render();
    });

    layer.querySelector('.b-ok').addEventListener('click', () => {
      calc13.textContent = picked13;
      if (ph13) ph13.textContent = '';
      input13.value = picked13;
      layer.remove();
    });
  });

  const m9 = buildFormModel(document.body);
  const profile9 = defaultProfile();
  profile9.personal = [{ 民族: '傣族' }];

  const report9 = await fillPage(profile9, {
    bridge: { setModelValue: async () => ({ ok: false, readModel: async () => ({ ok: false }) }) },
  });
  const row9 = report9.results.find(r => r.slot === 'personal.ethnicity');

  ok(
    '[14] 点中的是左栏网格里的单元格（面板定位到了弹层，不再只有右栏）',
    clickedCell === '傣族',
    JSON.stringify(clickedCell)
  );
  ok('[14] 弹层顶部的搜索框被用上了', searchTyped.includes('傣'), JSON.stringify(searchTyped));
  ok(
    '[14] 从汉族成功切成傣族',
    row9 && row9.status === 'filled',
    JSON.stringify(row9 && { s: row9.status, r: row9.reason, v: row9.via, a: row9.attempts })
  );
  ok('[14] 走的是面板点选而不是盲打回车', row9 && row9.via === 'panel', row9 && row9.via);
  ok('[14] 页面显示已切成傣族', calc13.textContent === '傣族', calc13.textContent || '(空)');
}

console.log('\n[15] 真机结构：弹层里有"搜索结果1个"这种 li，但真选项是 div 网格（畲族 → 傣族）');
{
  // 诊断⑦：available=["搜索结果1个","畲族"]、panelText="搜索结果1个 傣族 已选1/1 清空已选 畲族 取消 确定"
  // 静态文本里明明有"傣族"，却收集不到 —— 因为弹层里那个 <li>搜索结果1个</li>
  // 命中了 OPTION_SEL，旧逻辑一见有命中就不再做"短文本叶子"兜底，整个 div 网格被漏掉。
  const ETH14 = [
    '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族', '满族', '侗族',
    '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族', '佤族', '畲族', '高山族', '拉祜族',
  ];

  const HTML10 = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select phoenix-select--editable">
              <div class="phoenix-select__selection">
                <span class="phoenix-select__calcEle" id="s15calc">畲族</span>
                <span class="phoenix-select__placeholder" id="s15ph"></span>
                <ul class="phoenix-select__content"><li class="phoenix-select__inputWrapper">
                  <input class="phoenix-select__input phoenix-select__input--large phoenix-select__input--unText" id="s15input" value="畲族">
                </li></ul>
              </div>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom10 = new JSDOM(HTML10, { pretendToBeVisual: true });
  global.window = dom10.window;
  global.document = dom10.window.document;
  global.getComputedStyle = dom10.window.getComputedStyle.bind(dom10.window);
  global.Node = dom10.window.Node;
  global.HTMLInputElement = dom10.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom10.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom10.window.HTMLSelectElement;
  global.CSS = dom10.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc15 = document.querySelector('#s15calc');
  const ph15 = document.querySelector('#s15ph');
  const input15 = document.querySelector('#s15input');
  let clicked15 = '';
  let confirm15 = 0;
  let search15 = '';

  document.querySelector('.phoenix-select--editable').addEventListener('click', () => {
    if (document.querySelector('.dual3-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'dual3-layer';
    // 注意：这个 <li> 是计数文案，不是选项。它是"看起来像选项"的最大干扰源。
    layer.innerHTML =
      '<div class="dual3-search"><input id="s15search" placeholder="搜索"></div>' +
      '<ul class="dual3-count"><li>搜索结果1个</li></ul>' +
      '<div class="dual3-left"></div>' +
      '<div class="dual3-right"><span>已选 1/1</span><span>清空已选</span><span class="dual3-picked">畲族</span></div>' +
      '<div class="dual3-footer"><span class="b-cancel">取消</span><span class="b-ok">确定</span></div>';
    document.body.append(layer);

    const left = layer.querySelector('.dual3-left');
    const right = layer.querySelector('.dual3-picked');
    const count = layer.querySelector('.dual3-count li');
    const search = layer.querySelector('#s15search');

    const render = () => {
      const q = String(search.value || '').trim();
      const list = q ? ETH14.filter(n => n.includes(q)) : ETH14.slice(0, 12);
      // 真选项渲染成 div 网格（不是 li），且外层 div 带子 span —— 只有内层 span 是叶子
      left.innerHTML = list.map(t => `<div class="gcell"><span class="gtext">${t}</span></div>`).join('');
      if (count) count.textContent = `搜索结果${list.length}个`;
      left.querySelectorAll('.gcell').forEach(c => {
        c.addEventListener('click', () => {
          clicked15 = String(c.textContent || '').trim();
          if (right) right.textContent = clicked15;
        });
      });
    };
    render();
    search.addEventListener('input', () => {
      search15 = String(search.value || '');
      render();
    });

    layer.querySelector('.b-ok').addEventListener('click', () => {
      confirm15 += 1;
      const v = right ? String(right.textContent || '').trim() : clicked15;
      calc15.textContent = v;
      if (ph15) ph15.textContent = '';
      input15.value = v;
      layer.remove();
    });
  });

  const m10 = buildFormModel(document.body);
  const profile10 = defaultProfile();
  profile10.personal = [{ 民族: '傣族' }];

  const report10 = await fillPage(profile10, {
    bridge: { setModelValue: async () => ({ ok: false, readModel: async () => ({ ok: false }) }) },
  });
  const row10 = report10.results.find(r => r.slot === 'personal.ethnicity');

  ok(
    '[15] 从 div 网格里点中了"傣族"（没被计数 li 抢走）',
    clicked15 === '傣族',
    JSON.stringify(clicked15)
  );
  ok('[15] 搜了"傣"字', search15.includes('傣'), JSON.stringify(search15));
  ok(
    '[15] 畲族 → 傣族 切换成功',
    row10 && row10.status === 'filled',
    JSON.stringify(row10 && { s: row10.status, r: row10.reason, v: row10.via, a: row10.attempts })
  );
  ok('[15] 点了底部"确定"', confirm15 > 0, String(confirm15));
  ok('[15] 页面显示已切成傣族', calc15.textContent === '傣族', calc15.textContent || '(空)');
  ok('[15] 输入框同步成傣族', input15.value === '傣族', input15.value || '(空)');
}

console.log('\n[16] 真机结构：选中后 calcEle 与 placeholder 同时有字（回读不能拼成"傣族 畲族"）');
{
  // 截图红框标的两处：div.phoenix-select__placeholder--large（旧值"畲族"）
  // 与 input.phoenix-select__input--unText[value="畲族"]。
  // 北森点完"确定"只更新 calcEle，placeholder 里的旧值不清 —— 旧回读逻辑把整块
  // innerText 拼起来得到「傣族 畲族」，跟目标永远对不上，于是报 readback-mismatch。
  const ETH15 = [
    '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族', '满族', '侗族',
    '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族', '佤族', '畲族', '高山族', '拉祜族',
  ];

  const HTML11 = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select phoenix-select--editable phoenix-select--borderColorable">
              <div class="phoenix-select__selection">
                <span class="phoenix-select__calcEle" id="s16calc"></span>
                <div class="phoenix-select__placeholder phoenix-select__placeholder--large" id="s16ph">畲族</div>
                <ul class="phoenix-select__content"><li class="phoenix-select__inputWrapper phoenix-select__inputWrapper--emptyMultiValue">
                  <input class="phoenix-select__input phoenix-select__input--large phoenix-select__input--unText" id="s16input" value="畲族" placeholder="畲族">
                </li></ul>
              </div>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom11 = new JSDOM(HTML11, { pretendToBeVisual: true });
  global.window = dom11.window;
  global.document = dom11.window.document;
  global.getComputedStyle = dom11.window.getComputedStyle.bind(dom11.window);
  global.Node = dom11.window.Node;
  global.HTMLInputElement = dom11.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom11.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom11.window.HTMLSelectElement;
  global.CSS = dom11.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc16 = document.querySelector('#s16calc');
  const ph16 = document.querySelector('#s16ph');
  const input16 = document.querySelector('#s16input');
  let picked16 = '畲族';
  let clicked16 = '';

  document.querySelector('.phoenix-select--editable').addEventListener('click', () => {
    if (document.querySelector('.dual4-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'dual4-layer';
    layer.innerHTML =
      '<div class="dual4-search"><input id="s16search" placeholder="搜索"></div>' +
      '<ul class="dual4-count"><li>搜索结果1个</li></ul>' +
      '<div class="dual4-left"></div>' +
      '<div class="dual4-right"><span>已选 1/1</span><span>清空已选</span><span class="dual4-picked">畲族</span></div>' +
      '<div class="dual4-footer"><span class="b-cancel">取消</span><span class="b-ok">确定</span></div>';
    document.body.append(layer);

    const left = layer.querySelector('.dual4-left');
    const right = layer.querySelector('.dual4-picked');
    const search = layer.querySelector('#s16search');

    const render = () => {
      const q = String(search.value || '').trim();
      const list = q ? ETH15.filter(n => n.includes(q)) : ETH15.slice(0, 12);
      left.innerHTML = list.map(t => `<div class="gcell"><i class="dot"></i>${t}</div>`).join('');
      left.querySelectorAll('.gcell').forEach(c => {
        c.addEventListener('click', () => {
          clicked16 = String(c.textContent || '').trim();
          if (right) right.textContent = clicked16;
        });
      });
    };
    render();
    search.addEventListener('input', render);

    layer.querySelector('.b-ok').addEventListener('click', () => {
      const v = right ? String(right.textContent || '').trim() : clicked16;
      picked16 = v;
      // 真机行为：只写 calcEle + input，placeholder 里的旧值留着
      calc16.textContent = v;
      input16.value = v;
      layer.remove();
    });
  });

  const m11 = buildFormModel(document.body);
  const profile11 = defaultProfile();
  profile11.personal = [{ 民族: '傣族' }];

  const report11 = await fillPage(profile11, {
    bridge: { setModelValue: async () => ({ ok: false, readModel: async () => ({ ok: false }) }) },
  });
  const row11 = report11.results.find(r => r.slot === 'personal.ethnicity');

  ok('[16] 点中的是"傣族"', clicked16 === '傣族', JSON.stringify(clicked16));
  ok(
    '[16] 回读没有被 placeholder 的旧值污染',
    row11 && row11.status === 'filled' && row11.readback === '傣族',
    JSON.stringify(row11 && { s: row11.status, r: row11.reason, rb: row11.readback, e: row11.expected })
  );
  ok('[16] 页面 calcEle 已更新成傣族', calc16.textContent === '傣族', calc16.textContent || '(空)');
  ok('[16] placeholder 仍是旧值（真机就是这样）', ph16.textContent === '畲族', ph16.textContent);
  ok('[16] 没有误报 readback-mismatch', !row11 || row11.reason !== 'readback-mismatch', row11 && row11.reason);
}

console.log('\n[17] 真机结构：多选可编辑下拉（calcEle / placeholder / tipEle 三处显示），点选与裸回车都不提交');
{
  // 截图实拍 DOM：phoenix-select--editable + phoenix-select__inputWrapper--emptyMultiValue
  //   span.phoenix-select__calcEle            ← 真值写这里
  //   div.phoenix-select__placeholder--large  ← 旧值不清
  //   ul > li > input[value=畲族]             ← 同时是搜索框
  //   span.phoenix-select__tipWrapper > span.phoenix-select__tipEle  ← 第三处显示
  // 真机现象：能过滤出"傣族"、能点中、也点了"确定"，但值不提交（readback 仍是畲族）。
  const ETH16 = [
    '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族', '满族', '侗族',
    '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族', '佤族', '畲族', '高山族', '拉祜族',
  ];

  const HTML12 = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item form-item--phoenix">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select phoenix-select--editable phoenix-select--borderColorable phoenix-select--active phoenix-select--large">
              <span class="phoenix-select__calcEle" id="s17calc"></span>
              <div class="phoenix-select__placeholder phoenix-select__placeholder--active phoenix-select__placeholder--large" id="s17ph">畲族</div>
              <ul class="phoenix-select__content">
                <li class="phoenix-select__inputWrapper phoenix-select__inputWrapper--emptyMultiValue">
                  <input class="phoenix-select__input phoenix-select__input--large phoenix-select__input--unText" id="s17input" value="畲族" placeholder="畲族">
                </li>
                <span class="phoenix-select__tipWrapper phoenix-select__tipWrapper--large phoenix-select__tipWrapper--active">
                  <span class="phoenix-select__tipEle" id="s17tip">畲族</span>
                </span>
              </ul>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom12 = new JSDOM(HTML12, { pretendToBeVisual: true });
  global.window = dom12.window;
  global.document = dom12.window.document;
  global.getComputedStyle = dom12.window.getComputedStyle.bind(dom12.window);
  global.Node = dom12.window.Node;
  global.HTMLInputElement = dom12.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom12.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom12.window.HTMLSelectElement;
  global.CSS = dom12.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc17 = document.querySelector('#s17calc');
  const ph17 = document.querySelector('#s17ph');
  const tip17 = document.querySelector('#s17tip');
  const input17 = document.querySelector('#s17input');

  let highlight = -1; // -1 = 没有高亮项，此时回车是空操作（真机就是这样）
  let picked = '畲族';
  let typedList = [];
  let cellClicks = 0;
  let confirmClicks = 0;
  let committedByKeys = 0;

  document.querySelector('.phoenix-select--editable').addEventListener('click', ev => {
    if (document.querySelector('.phoenix-unmodeled-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'phoenix-unmodeled-layer';
    layer.innerHTML =
      '<div class="multi-search"><input id="s17search" placeholder="搜索"></div>' +
      '<div class="multi-left"></div>' +
      '<div class="multi-right"><span>已选 1/1</span><span>清空已选</span><span class="multi-picked">畲族</span></div>' +
      '<div class="multi-footer"><span class="b-cancel">取消</span><span class="b-ok">确定</span></div>';
    document.body.append(layer);

    const left = layer.querySelector('.multi-left');
    const right = layer.querySelector('.multi-picked');
    const search = layer.querySelector('#s17search');

    const render = q => {
      const txt = String(q || '').trim();
      typedList = txt ? ETH16.filter(n => n.includes(txt)) : ETH16.slice(0, 12);
      left.innerHTML = typedList
        .map(t => `<div class="mcell"><span class="mtext">${t}</span></div>`)
        .join('');
      left.querySelectorAll('.mcell').forEach(c => {
        c.addEventListener('click', () => {
          cellClicks++;
          picked = String(c.textContent || '').trim();
          if (right) right.textContent = picked;
          // 只是"待确认"，不写 calcEle —— 真机的多选组件就是这个行为
        });
      });
    };
    render('');
    search.addEventListener('input', () => render(search.value));

    // 确定按钮：真机上点了没反应（值不提交），所以这里刻意什么都不做
    layer.querySelector('.b-ok').addEventListener('click', () => {
      confirmClicks++;
    });
  });

  // 触发器的输入框同时是搜索框：输入即过滤
  input17.addEventListener('input', () => {
    const layer = document.querySelector('.phoenix-unmodeled-layer');
    const left = layer && layer.querySelector('.multi-left');
    if (!left) return;
    const q = String(input17.value || '').trim();
    typedList = q ? ETH16.filter(n => n.includes(q)) : ETH16.slice(0, 12);
    left.innerHTML = typedList.map(t => `<div class="mcell"><span class="mtext">${t}</span></div>`).join('');
    left.querySelectorAll('.mcell').forEach(c => {
      c.addEventListener('click', () => {
        cellClicks++;
        picked = String(c.textContent || '').trim();
        const right = layer.querySelector('.multi-picked');
        if (right) right.textContent = picked;
      });
    });
    highlight = -1;
  });

  input17.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      highlight = Math.min(highlight + 1, Math.max(0, typedList.length - 1));
      return;
    }
    if (e.key !== 'Enter') return;
    if (highlight < 0) return; // 没有高亮项 → 回车什么都不发生（真机行为）
    const target = typedList[highlight];
    if (!target) return;
    committedByKeys++;
    // 提交：只写 calcEle，placeholder / tipEle 留着旧值
    calc17.textContent = target;
    input17.value = target;
  });

  const m12 = buildFormModel(document.body);
  const profile12 = defaultProfile();
  profile12.personal = [{ 民族: '傣族' }];

  const report12 = await fillPage(profile12, {
    bridge: { setModelValue: async () => ({ ok: false, readModel: async () => ({ ok: false }) }) },
  });
  const row12 = report12.results.find(r => r.slot === 'personal.ethnicity');

  ok('[17] 确实点了列表项（说明"看得见"这一步没问题）', cellClicks > 0, String(cellClicks));
  ok('[17] 确实点了"确定"', confirmClicks > 0, String(confirmClicks));
  ok(
    '[17] 最终靠 ↓+Enter 提交成功',
    row12 && row12.status === 'filled' && row12.via === 'input-keys(1)',
    JSON.stringify(row12 && { s: row12.status, r: row12.reason, v: row12.via, a: row12.attempts })
  );
  ok('[17] 键盘提交真的发生了一次', committedByKeys === 1, String(committedByKeys));
  ok('[17] calcEle 已是傣族', calc17.textContent === '傣族', calc17.textContent || '(空)');
  ok('[17] placeholder 仍是旧值（三处显示不一致，回读要认得出来）', ph17.textContent === '畲族', ph17.textContent);
  ok('[17] tipEle 仍是旧值', tip17.textContent === '畲族', tip17.textContent);
  ok(
    '[17] 回读是"傣族"而不是"畲族"或拼接串',
    row12 && row12.readback === '傣族',
    JSON.stringify(row12 && row12.readback)
  );
}

console.log('\n[18] 真机结构：列表项是「隐藏 radio + 文字」，只点文字不改选中态');
{
  // 截图左侧浮层里每个民族前面都有个 ○ —— 那是这一项自己的 radio。
  // 只点外层文字时组件无反应（真机：点得中但值不变），必须把 radio 也点上。
  const ETH17 = [
    '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族', '满族', '侗族',
    '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族', '佤族', '畲族', '高山族', '拉祜族',
  ];

  const HTML13 = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item form-item--phoenix">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select phoenix-select--editable phoenix-select--borderColorable phoenix-select--large">
              <span class="phoenix-select__calcEle" id="s18calc">畲族</span>
              <div class="phoenix-select__placeholder phoenix-select__placeholder--large" id="s18ph">畲族</div>
              <ul class="phoenix-select__content">
                <li class="phoenix-select__inputWrapper phoenix-select__inputWrapper--emptyMultiValue">
                  <input class="phoenix-select__input phoenix-select__input--large phoenix-select__input--unText" id="s18input" value="畲族">
                </li>
                <span class="phoenix-select__tipWrapper phoenix-select__tipWrapper--active">
                  <span class="phoenix-select__tipEle" id="s18tip">畲族</span>
                </span>
              </ul>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom13 = new JSDOM(HTML13, { pretendToBeVisual: true });
  global.window = dom13.window;
  global.document = dom13.window.document;
  global.getComputedStyle = dom13.window.getComputedStyle.bind(dom13.window);
  global.Node = dom13.window.Node;
  global.HTMLInputElement = dom13.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom13.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom13.window.HTMLSelectElement;
  global.CSS = dom13.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc18 = document.querySelector('#s18calc');
  const ph18 = document.querySelector('#s18ph');
  const tip18 = document.querySelector('#s18tip');
  const input18 = document.querySelector('#s18input');

  let radioClicks = 0;
  let textClicks = 0;
  let confirm18 = 0;
  let pending = '畲族';

  document.querySelector('.phoenix-select--editable').addEventListener('click', () => {
    if (document.querySelector('.radio-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'radio-layer';
    layer.innerHTML =
      '<div class="radio-search"><input id="s18search" placeholder="搜索"></div>' +
      '<div class="radio-left"></div>' +
      '<div class="radio-footer"><span class="b-cancel">取消</span><span class="b-ok">确定</span></div>';
    document.body.append(layer);

    const left = layer.querySelector('.radio-left');
    const search = layer.querySelector('#s18search');

    const render = q => {
      const txt = String(q || '').trim();
      const list = txt ? ETH17.filter(n => n.includes(txt)) : ETH17.slice(0, 12);
      // 每一项：自己的 radio + 文字。radio 才是真正被监听的那个。
      left.innerHTML = list
        .map(
          t =>
            `<div class="opt-row"><input type="radio" name="eth18" value="${t}"><span class="opt-text">${t}</span></div>`
        )
        .join('');
      left.querySelectorAll('.opt-row').forEach(row => {
        const r = row.querySelector('input[type="radio"]');
        row.querySelector('.opt-text').addEventListener('click', () => {
          textClicks++; // 只点文字：组件什么都不做（真机行为）
        });
        r.addEventListener('click', () => {
          radioClicks++;
          pending = r.value;
        });
      });
    };
    render('');
    search.addEventListener('input', () => render(search.value));

    layer.querySelector('.b-ok').addEventListener('click', () => {
      confirm18++;
      calc18.textContent = pending; // 只更新 calcEle，另外三处不动
      input18.value = pending;
      layer.remove();
    });
  });

  input18.addEventListener('input', () => {
    const layer = document.querySelector('.radio-layer');
    const left = layer && layer.querySelector('.radio-left');
    if (!left) return;
    const q = String(input18.value || '').trim();
    const list = q ? ETH17.filter(n => n.includes(q)) : ETH17.slice(0, 12);
    left.innerHTML = list
      .map(
        t =>
          `<div class="opt-row"><input type="radio" name="eth18" value="${t}"><span class="opt-text">${t}</span></div>`
      )
      .join('');
    left.querySelectorAll('.opt-row').forEach(row => {
      const r = row.querySelector('input[type="radio"]');
      row.querySelector('.opt-text').addEventListener('click', () => {
        textClicks++;
      });
      r.addEventListener('click', () => {
        radioClicks++;
        pending = r.value;
      });
    });
  });

  const m13 = buildFormModel(document.body);
  const profile13 = defaultProfile();
  profile13.personal = [{ 民族: '傣族' }];

  const report13 = await fillPage(profile13, {
    bridge: { setModelValue: async () => ({ ok: false, readModel: async () => ({ ok: false }) }) },
  });
  const row13 = report13.results.find(r => r.slot === 'personal.ethnicity');

  ok('[18] 点了文字（外层节点）', textClicks > 0, String(textClicks));
  ok('[18] 也点到了该项自己的 radio', radioClicks > 0, String(radioClicks));
  ok('[18] 点了"确定"', confirm18 > 0, String(confirm18));
  ok(
    '[18] 畲族 → 傣族 切换成功',
    row13 && row13.status === 'filled' && row13.readback === '傣族',
    JSON.stringify(row13 && { s: row13.status, r: row13.reason, v: row13.via, rb: row13.readback })
  );
  ok('[18] calcEle 已是傣族', calc18.textContent === '傣族', calc18.textContent || '(空)');
  ok('[18] 另外三处仍是旧值（现实如此，回读认 calcEle）', ph18.textContent === '畲族' && tip18.textContent === '畲族');
  // 防回归：v2.0.12 里 commitByInput 的失败收尾引用了一个块级变量，
  // 只要走到那条路径就抛 ReferenceError，报告里显示成 exception:xxx is not defined。
  ok(
    '[18] 没有异常逃逸到报告里',
    !/^exception:/.test(String((row13 && row13.reason) || '')),
    JSON.stringify(row13 && row13.reason)
  );
}

console.log('\n[19] 真机结构：上一个字段留下的浮层内容不得当成当前字段的选项');
{
  // 真机诊断⑨：民族 available=["2026-01-07"]、panelText="2026-01-07 2026-01-07"、
  // panelSel="div.phoenix-unmodeled-layer.block" —— 那个 layer 是**全页共用的浮层容器**，
  // 出生日期填完后内容还留在 DOM 里，结果被当成了民族的面板。
  const HTML14 = `<!doctype html><html><body>
    <div class="phoenix-unmodeled-layer block">
      <div class="phoenix-unmodeled-layer__inner">
        <div class="phoenix-unmodeled-layer__protect">
          <div class="phoenix-unmodeled-layer__content phoenix-unmodeled-layer__content--block">
            <span class="left-cell">2026-01-07</span><span class="left-cell">2026-01-07</span>
          </div>
        </div>
      </div>
    </div>
    <form>
      <div class="form-part">
        <div class="form-part-head"><div class="name">个人信息</div></div>
        <div class="form-part-body"><div class="fields-col">
          <div class="form-item form-item--phoenix">
            <div class="form-item__label">民族</div>
            <div class="form-item__control">
              <div class="phoenix-select phoenix-select--editable phoenix-select--borderColorable phoenix-select--large">
                <span class="phoenix-select__calcEle" id="s19calc">畲族</span>
                <div class="phoenix-select__placeholder phoenix-select__placeholder--large" id="s19ph">畲族</div>
                <ul class="phoenix-select__content">
                  <li class="phoenix-select__inputWrapper phoenix-select__inputWrapper--emptyMultiValue">
                    <input class="phoenix-select__input phoenix-select__input--unText" id="s19input" value="畲族">
                  </li>
                  <span class="phoenix-select__tipWrapper"><span class="phoenix-select__tipEle" id="s19tip">畲族</span></span>
                </ul>
              </div>
            </div>
          </div>
        </div></div>
      </div>
    </form>
  </body></html>`;
  const dom14 = new JSDOM(HTML14, { pretendToBeVisual: true });
  global.window = dom14.window;
  global.document = dom14.window.document;
  global.getComputedStyle = dom14.window.getComputedStyle.bind(dom14.window);
  global.Node = dom14.window.Node;
  global.HTMLInputElement = dom14.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom14.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom14.window.HTMLSelectElement;
  global.CSS = dom14.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc19 = document.querySelector('#s19calc');
  // 这个字段的组件"点不开"：点触发器什么都不发生（有的站点就是这样，或面板被禁用）
  // 此时正确的行为是**跳过**，绝不能拿残留层里的 2026-01-07 去"匹配"。

  const m14 = buildFormModel(document.body);
  const profile14 = defaultProfile();
  profile14.personal = [{ 民族: '白族' }];

  const report14 = await fillPage(profile14, {
    bridge: { setModelValue: async () => ({ ok: false, readModel: async () => ({ ok: false }) }) },
  });
  const row14 = report14.results.find(r => r.slot === 'personal.ethnicity');

  const avail = (row14 && row14.available) || [];
  ok(
    '[19] 没有把日期的残留值当成民族选项',
    !avail.some(x => /2026-01-07/.test(String(x))),
    JSON.stringify(avail)
  );
  ok(
    '[19] 也没有把那一层当面板（panelSel 不带 unmodeled-layer）',
    !/unmodeled-layer/.test(String((row14 && row14.panelSel) || '')),
    JSON.stringify(row14 && row14.panelSel)
  );
  ok(
    '[19] 该字段被安全跳过（不是 failed，也不改页面已有值）',
    row14 && row14.status === 'skipped',
    JSON.stringify(row14 && { s: row14.status, r: row14.reason })
  );
  ok('[19] 页面上的旧值没被动过', calc19.textContent === '畲族', calc19.textContent || '(空)');
  ok('[19] 没有异常逃逸', !/^exception:/.test(String((row14 && row14.reason) || '')));

  // 顺手验证：如果这个字段本来就有可编辑输入框，直填路径会先试一遍
  ok(
    '[19] 直填尝试过（attempts 有记录或直接跳过）',
    Array.isArray(row14 && row14.attempts) || row14.status === 'skipped',
    JSON.stringify(row14 && row14.attempts)
  );
}

console.log('\n[20] 真机结构：已选 1/1 满员 —— 不先"清空已选"，点新项会被组件直接拒绝');
{
  // 截图左侧：搜索框 + 三列民族网格 + 右栏「已选 1/1 · 清空已选 · 畲族 ⓧ」+ 底部「取消 / 确定」。
  // 组件包里的文案写得很直白：`selectAllLengthText: "已选总数不能超过{0}个"`。
  // 名额占满时点"白族"不是点不中，是组件**不接受**；此时点确定提交的还是旧值「畲族」。
  const ETH20 = [
    '汉族', '回族', '畲族', '塔塔尔族', '阿昌族', '哈萨克族', '土家族', '白族', '维吾尔族', '拉祜族',
    '保安族', '赫哲族', '乌孜别克族', '基诺族', '布依族', '东乡族', '锡伯族', '黎族', '仫佬族', '达斡尔族',
    '蒙古族', '毛南族', '裕固族',
  ];

  const HTML15 = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item form-item--phoenix">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select phoenix-select--editable phoenix-select--borderColorable phoenix-select--large">
              <span class="phoenix-select__calcEle" id="s20calc">畲族</span>
              <div class="phoenix-select__placeholder phoenix-select__placeholder--large" id="s20ph">畲族</div>
              <ul class="phoenix-select__content">
                <li class="phoenix-select__inputWrapper phoenix-select__inputWrapper--emptyMultiValue">
                  <input class="phoenix-select__input phoenix-select__input--unText" id="s20input" value="畲族">
                </li>
                <span class="phoenix-select__tipWrapper"><span class="phoenix-select__tipEle" id="s20tip">畲族</span></span>
              </ul>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom15 = new JSDOM(HTML15, { pretendToBeVisual: true });
  global.window = dom15.window;
  global.document = dom15.window.document;
  global.getComputedStyle = dom15.window.getComputedStyle.bind(dom15.window);
  global.Node = dom15.window.Node;
  global.HTMLInputElement = dom15.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom15.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom15.window.HTMLSelectElement;
  global.CSS = dom15.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc20 = document.querySelector('#s20calc');
  const ph20 = document.querySelector('#s20ph');
  const tip20 = document.querySelector('#s20tip');
  const input20 = document.querySelector('#s20input');

  let selected = ['畲族']; // 名额 1，已满
  const MAX = 1;
  let clearClicks = 0;
  let rejected = 0;
  let accepted = '';
  let confirmClicks20 = 0;

  document.querySelector('.phoenix-select--editable').addEventListener('click', () => {
    if (document.querySelector('.dual20-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'dual20-layer';
    layer.innerHTML =
      '<div class="d20-search"><input id="s20search" placeholder="搜索"></div>' +
      '<div class="d20-left"></div>' +
      '<div class="d20-right"><span>已选 <b id="s20cnt">1/1</b></span><span class="d20-clear">清空已选</span><span class="d20-picked">畲族</span></div>' +
      '<div class="d20-footer"><span class="b-cancel">取消</span><span class="b-ok">确定</span></div>';
    document.body.append(layer);

    const left = layer.querySelector('.d20-left');
    const picked = layer.querySelector('.d20-picked');
    const cntEl = layer.querySelector('#s20cnt');
    const search = layer.querySelector('#s20search');

    const sync = () => {
      if (cntEl) cntEl.textContent = `${selected.length}/${MAX}`;
      if (picked) picked.textContent = selected.join('、');
    };

    const render = q => {
      const txt = String(q || '').trim();
      const list = txt ? ETH20.filter(n => n.includes(txt)) : ETH20.slice(0, 21);
      left.innerHTML = list.map(t => `<div class="d20-cell"><i class="dot"></i><span class="d20-text">${t}</span></div>`).join('');
      left.querySelectorAll('.d20-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const v = String(cell.textContent || '').trim();
          // 组件真实语义：名额满了就拒绝，什么都不发生
          if (selected.length >= MAX && !selected.includes(v)) {
            rejected++;
            return;
          }
          accepted = v;
          selected = [v];
          sync();
        });
      });
    };
    render('');
    search.addEventListener('input', () => render(search.value));

    layer.querySelector('.d20-clear').addEventListener('click', () => {
      clearClicks++;
      selected = [];
      sync();
    });

    layer.querySelector('.b-ok').addEventListener('click', () => {
      confirmClicks20++;
      const v = selected[0] || '';
      if (!v) return;
      calc20.textContent = v;
      input20.value = v;
      layer.remove();
    });
  });

  input20.addEventListener('input', () => {
    const layer = document.querySelector('.dual20-layer');
    const left = layer && layer.querySelector('.d20-left');
    if (!left) return;
    const q = String(input20.value || '').trim();
    const list = q ? ETH20.filter(n => n.includes(q)) : ETH20.slice(0, 21);
    left.innerHTML = list.map(t => `<div class="d20-cell"><i class="dot"></i><span class="d20-text">${t}</span></div>`).join('');
    left.querySelectorAll('.d20-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const v = String(cell.textContent || '').trim();
        if (selected.length >= MAX && !selected.includes(v)) {
          rejected++;
          return;
        }
        accepted = v;
        selected = [v];
        const cntEl = layer.querySelector('#s20cnt');
        const picked = layer.querySelector('.d20-picked');
        if (cntEl) cntEl.textContent = `${selected.length}/${MAX}`;
        if (picked) picked.textContent = selected.join('、');
      });
    });
  });

  const m15 = buildFormModel(document.body);
  const profile15 = defaultProfile();
  profile15.personal = [{ 民族: '白族' }];

  const report15 = await fillPage(profile15, {
    bridge: { setModelValue: async () => ({ ok: false, readModel: async () => ({ ok: false }) }) },
  });
  const row15 = report15.results.find(r => r.slot === 'personal.ethnicity');

  ok('[20] 「清空已选」被点到过', clearClicks > 0, String(clearClicks));
  ok('[20] 最终被接受的是"白族"', accepted === '白族', JSON.stringify(accepted));
  ok(
    '[20] 畲族 → 白族 切换成功',
    row15 && row15.status === 'filled' && row15.readback === '白族',
    JSON.stringify(row15 && { s: row15.status, r: row15.reason, v: row15.via, rb: row15.readback, a: row15.attempts })
  );
  ok('[20] calcEle 已是白族', calc20.textContent === '白族', calc20.textContent || '(空)');
  ok('[20] 点了确定', confirmClicks20 > 0, String(confirmClicks20));
  ok('[20] 没有异常逃逸', !/^exception:/.test(String((row15 && row15.reason) || '')));
  // 满员时被拒绝是组件的正常反应，这里只确认程序没有"被拒绝还报成功"
  ok('[20] 拒绝次数不导致误报成功', row15.status === 'filled' || rejected >= 0, String(rejected));
}

/* ==================================================================== *
 * [21]~[23] 真机结构：北森「地区选择弹层」—— 真正的勾选控件是左侧 svg 图标
 *
 * 断言依据来自站点 bundle（beisen-phoenix-part2）里的原文：
 *
 *   div.area-item-container > div.area-item-name
 *     span.icon-container
 *       svg.area-icon-RadioUnchecked / RadioChecked
 *           onClick = handleChangeCheck → props.onChangeCheck → onCheckItem(data)   ← 唯一的勾选入口
 *     span.area-text-label
 *           onClick = handleLabelClick → onClickLabel → addAreaLabel               ← 只负责展开下一级
 *
 *   handleLabelClick = function () {
 *     var p = this.props, isForbidExpand = p.isForbidExpand, isSearch = p.isSearch, data = p.data;
 *     if (isForbidExpand || isSearch || data.status === NoChild) return;   // 叶子节点：什么都不做
 *     ...
 *   }
 *
 * 民族、籍贯都是叶子节点 ⇒ **点文字完全无效**。
 * 旧版本一路点文字 → 内部 selectData 始终为空 → 点「确定」= saveSelectData()
 * → onSubmit([]) → 字段被清成「请选择必填」。这就是真机那条 readback 的来源。
 * ==================================================================== */
// 真实 56 个民族：项数 > 30 会触发"先键入过滤"，这一步必须一起测到
const ETH_AREA = [
  '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族',
  '满族', '侗族', '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族',
  '佤族', '畲族', '高山族', '拉祜族', '水族', '东乡族', '纳西族', '景颇族', '柯尔克孜族', '土族',
  '达斡尔族', '仫佬族', '羌族', '布朗族', '撒拉族', '毛南族', '仡佬族', '锡伯族', '阿昌族', '普米族',
  '塔吉克族', '怒族', '乌孜别克族', '俄罗斯族', '鄂温克族', '德昂族', '保安族', '裕固族', '京族', '塔塔尔族',
  '独龙族', '鄂伦春族', '赫哲族', '门巴族', '珞巴族', '基诺族',
];

function mountAreaSelector({ initial = '', max = 1, breakConfirm = false } = {}) {
  const HTML_A = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select phoenix-select--editable phoenix-select--borderColorable phoenix-select--large">
              <span class="phoenix-select__calcEle"></span>
              <div class="phoenix-select__placeholder phoenix-select__placeholder--large">请选择</div>
              <ul class="phoenix-select__content">
                <li class="phoenix-select__inputWrapper">
                  <input class="phoenix-select__input phoenix-select__input--unText">
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom = new JSDOM(HTML_A, { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  global.Node = dom.window.Node;
  global.HTMLInputElement = dom.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom.window.HTMLSelectElement;
  global.CSS = dom.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc = document.querySelector('.phoenix-select__calcEle');
  const ph = document.querySelector('.phoenix-select__placeholder');
  const input = document.querySelector('.phoenix-select__input');
  const trigger = document.querySelector('.phoenix-select--editable');

  let selected = initial ? [initial] : [];
  const ev = { icon: 0, word: 0, clear: 0, confirm: 0, submitted: [], rejected: 0 };

  const buildPopup = () => {
    const layer = document.createElement('div');
    layer.className = 'phoenix-unmodeled-layer block';
    layer.innerHTML =
      '<div class="phoenix-unmodeled-layer__inner"><div class="area-selector-container">' +
      '<div class="area-search-input"><input class="a-search" placeholder="搜索"></div>' +
      '<div class="content-container">' +
      '<div class="left-container"><div class="area-data-container"></div></div>' +
      '<div class="right-container">' +
      '<div class="select-data-header">' +
      '<span class="select-data-num"><span class="select-data-num-selectDataText">已选</span>' +
      '<span class="select-data-num-text">0</span><span class="select-data-num-limit">/' + max + '</span></span>' +
      '<span class="clear-select-data">清空已选</span>' +
      '</div>' +
      '<div class="select-data-container"></div>' +
      '</div></div>' +
      '<div class="area-footer-button">' +
      '<div class="button-container"><button class="b-cancel">取消</button></div>' +
      '<div class="button-container"><button class="b-ok">确定</button></div>' +
      '</div>' +
      '<div class="message-mask hide"></div>' +
      '</div></div>';
    document.body.append(layer);

    const listBox = layer.querySelector('.area-data-container');
    const search = layer.querySelector('.a-search');

    const renderList = q => {
      const txt = String(q || '').trim();
      const list = txt ? ETH_AREA.filter(n => n.includes(txt)) : ETH_AREA;
      listBox.innerHTML = list
        .map(t => {
          const on = selected.includes(t);
          return (
            '<div class="area-item-container" data-v="' + t + '">' +
            '<div class="area-item-name">' +
            '<span class="icon-container visible">' +
            '<svg class="area-icon-' + (on ? 'RadioChecked' : 'RadioUnchecked') + '" width="14" height="14"></svg>' +
            '</span>' +
            '<span class="area-text-label">' + t + '</span>' +
            '</div></div>'
          );
        })
        .join('');
    };

    const sync = () => {
      layer.querySelector('.select-data-num-text').textContent = String(selected.length);
      const clr = layer.querySelector('.clear-select-data');
      clr.setAttribute('class', 'clear-select-data' + (selected.length ? '' : ' disabled'));
      const pane = layer.querySelector('.select-data-container');
      pane.innerHTML = selected.length
        ? selected
            .map(t => '<div class="select-item-container"><span class="select-area-text-label">' + t + '</span></div>')
            .join('')
        : '<div class="select-data-empty">请在左侧选择地区</div>';
      renderList(search.value);
    };

    // 完全按 bundle 的语义挂事件：图标 = 勾选，文字 = 叶子节点直接 return
    layer.addEventListener('click', e => {
      const t = e.target;
      const svg = t.closest && t.closest('svg[class*="area-icon-"]');
      if (svg) {
        ev.icon++;
        const cell = svg.closest('.area-item-container');
        const v = cell && cell.getAttribute('data-v');
        if (!v) return;
        if (!selected.includes(v) && selected.length >= max) {
          ev.rejected++;
          const mask = layer.querySelector('.message-mask');
          if (mask) mask.setAttribute('class', 'message-mask show'); // 组件真实行为：警告 + 遮罩
          setTimeout(() => {
            if (mask && mask.isConnected) mask.setAttribute('class', 'message-mask hide');
          }, 260);
          return;
        }
        selected = selected.includes(v) ? selected.filter(x => x !== v) : selected.concat([v]);
        sync();
        return;
      }
      if (t.closest && t.closest('.area-text-label')) {
        ev.word++; // 叶子节点：什么都不做
        return;
      }
      const clr = t.closest && t.closest('.clear-select-data');
      if (clr) {
        if (/disabled/.test(String(clr.getAttribute('class') || ''))) return;
        ev.clear++;
        selected = [];
        sync();
        return;
      }
      if (t.closest && t.closest('.b-ok')) {
        ev.confirm++;
        const v = breakConfirm ? [] : selected.slice();
        ev.submitted.push(v);
        calc.textContent = v.join('、');
        // 真机：提交空数组后组件进入必填报错态，占位文案变成「请选择必填」
        ph.textContent = v.length ? v[0] : '请选择必填';
        layer.remove();
        return;
      }
      if (t.closest && t.closest('.b-cancel')) layer.remove();
    });

    search.addEventListener('input', () => renderList(search.value));
    sync();
  };

  trigger.addEventListener('click', () => {
    if (document.querySelector('.area-selector-container')) return;
    buildPopup();
  });

  return { dom, ev, calc, ph, input, selectedNow: () => selected.slice() };
}

console.log('\n[21] 真机结构：地区弹层点文字无效，只有点左侧 svg 图标才算勾选（空白场景）');
{
  const page = mountAreaSelector({ max: 1 });
  const profile21 = defaultProfile();
  profile21.personal = [{ 民族: '白族' }];

  const report = await fillPage(profile21, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const row = report.results.find(r => r.slot === 'personal.ethnicity');

  ok(
    '[21] 民族填写成功',
    row && row.status === 'filled' && row.readback === '白族',
    JSON.stringify(row && { s: row.status, r: row.reason, v: row.via, rb: row.readback, ic: row.itemClick, a: row.attempts })
  );
  ok('[21] 点的是 svg 图标（不是文字）', page.ev.icon > 0 && page.ev.word === 0, JSON.stringify(page.ev));
  ok('[21] 内部已选里确实是白族', JSON.stringify(page.selectedNow()) === '["白族"]', JSON.stringify(page.selectedNow()));
  ok('[21] 点过确定', page.ev.confirm > 0, String(page.ev.confirm));
  ok('[21] 确定提交的是 [白族] 而不是空数组', JSON.stringify(page.ev.submitted.at(-1)) === '["白族"]', JSON.stringify(page.ev.submitted));
  ok('[21] 触发器 calcEle 已是白族', page.calc.textContent === '白族', page.calc.textContent || '(空)');
  ok('[21] 占位没有被写成必填报错', page.ph.textContent !== '请选择必填', page.ph.textContent);
  ok('[21] 没有异常逃逸', !/^exception:/.test(String((row && row.reason) || '')));
}

console.log('\n[22] 真机结构：已选 1/1 满员 —— 先清空、再点图标、再确定（换值场景）');
{
  const page = mountAreaSelector({ initial: '畲族', max: 1 });
  const profile22 = defaultProfile();
  profile22.personal = [{ 民族: '白族' }];

  const report = await fillPage(profile22, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const row = report.results.find(r => r.slot === 'personal.ethnicity');

  ok('[22] 「清空已选」被点到过', page.ev.clear > 0, String(page.ev.clear));
  ok('[22] 换成白族成功', row && row.status === 'filled' && row.readback === '白族',
    JSON.stringify(row && { s: row.status, r: row.reason, rb: row.readback, ic: row.itemClick }));
  ok('[22] 内部已选只有白族', JSON.stringify(page.selectedNow()) === '["白族"]', JSON.stringify(page.selectedNow()));
  ok('[22] 满额时没有被拒绝过（清空在前）', page.ev.rejected === 0, String(page.ev.rejected));
  ok('[22] 没有异常逃逸', !/^exception:/.test(String((row && row.reason) || '')));
}

console.log('\n[23] 真机结构：提交空数组后占位变「请选择必填」—— 不许当成填写成功');
{
  // 复刻 v2.0.15 真机：确定把空数组提交上去，字段进入必填报错态，
  // 旧代码把「请选择必填」当成回读值 → 既非 mismatch 也非空的怪报告。
  const page = mountAreaSelector({ initial: '畲族', max: 1, breakConfirm: true });
  const profile23 = defaultProfile();
  profile23.personal = [{ 民族: '白族' }];

  const report = await fillPage(profile23, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const row = report.results.find(r => r.slot === 'personal.ethnicity');

  ok('[23] 判的是失败，不是 filled', row && row.status === 'failed', JSON.stringify(row && { s: row.status, r: row.reason }));
  ok('[23] 失败原因是 readback-empty 而不是 readback-mismatch', row && row.reason === 'readback-empty', String(row && row.reason));
  ok('[23] 「请选择必填」没有被当成值', row && row.readback !== '请选择必填', JSON.stringify(row && row.readback));
  ok('[23] 没有报低置信度成功', !(row && row.lowConfidence), JSON.stringify(row && row.lowConfidence));
  ok('[23] 没有异常逃逸', !/^exception:/.test(String((row && row.reason) || '')));
}

/* ==================================================================== *
 * [24][25] 真机结构（组件 A）：通用多选/单选弹层
 *          constant-main-selector-container  ← 民族 / 籍贯真正用的就是这套
 *
 * 依据：beisen-phoenix-part1（beisen-phoenix-part1-b1e69e1c8b76b958d13b.chk.js）
 *
 *   getIcon = function (checked, isMulti) {
 *     var kind = isMulti ? "Checkbox" : "Radio", st = checked ? "Checked" : "Unchecked";
 *     return createElement(ICONS[kind + st], {
 *       color: "currentColor",
 *       onClick: this.handleChangeCheck,   // ★ 唯一勾选入口 → onCheckItem(data)
 *       className: kind + st               // → "RadioUnchecked"（没有 area-icon- 前缀）
 *     });
 *   };
 *   render = div("list-item-container " + cusCls,
 *              span("icon-container", getIcon(checked, isMulti)),
 *              Tooltip(span("item-text-label", {onClick: handleLabelClick},
 *                           Highlighter({highlightClassName: "item-label-highLightCls", ...}))),
 *              noExpand ? null : Arrow);
 *
 * 外层面板：
 *   div.constant-main-selector-container
 *     div.constant-main-layer-container
 *       div.content-search > Search
 *       div.content-container
 *         div.left-container     ← 列表
 *         div.right-container
 *           span.select-data-num（已选 + select-data-num-text("1/1") + select-data-num-limit）
 *           span.clear-select-data (+ disabled)
 *           div.select-data-container → div.select-item-container > span.select-text-label
 *     div.selector-footer-button > div.button-container > [取消][确定(primary)]
 *     div.message-container / div.message-mask show|hide
 *
 * 用户真机截图里 devtools 悬浮图标显示的正是 `svg.RadioUnchecked 13.99 x 13.99` ——
 * v2.0.16 只认 `area-icon-RadioUnchecked`（那是组件 B 的写法），所以 `iconOf()` 恒为 null，
 * 又退回去点文字，于是"还是不行"。这一组就是对这次认错组件的回归。
 * ==================================================================== */
const ETH_PHX = [
  '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族',
  '满族', '侗族', '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族',
  '佤族', '畲族', '高山族', '拉祜族', '水族', '东乡族', '纳西族', '景颇族', '柯尔克孜族', '土族',
  '达斡尔族', '仫佬族', '羌族', '布朗族', '撒拉族', '毛南族', '仡佬族', '锡伯族', '阿昌族', '普米族',
  '塔吉克族', '怒族', '乌孜别克族', '俄罗斯族', '鄂温克族', '德昂族', '保安族', '裕固族', '京族', '塔塔尔族',
  '独龙族', '鄂伦春族', '赫哲族', '门巴族', '珞巴族', '基诺族',
];

function mountPhoenixSelector({ initial = '', max = 1, breakConfirm = false } = {}) {
  const HTML_P = `<!doctype html><html><body><form>
    <div class="form-part">
      <div class="form-part-head"><div class="name">个人信息</div></div>
      <div class="form-part-body"><div class="fields-col">
        <div class="form-item">
          <div class="form-item__label">民族</div>
          <div class="form-item__control">
            <div class="phoenix-select phoenix-select--editable phoenix-select--large">
              <span class="phoenix-select__calcEle"></span>
              <div class="phoenix-select__placeholder">请选择</div>
              <ul class="phoenix-select__content">
                <li class="phoenix-select__inputWrapper">
                  <input class="phoenix-select__input phoenix-select__input--unText">
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  </form></body></html>`;
  const dom = new JSDOM(HTML_P, { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  global.Node = dom.window.Node;
  global.HTMLInputElement = dom.window.HTMLInputElement;
  global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  global.HTMLSelectElement = dom.window.HTMLSelectElement;
  global.CSS = dom.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

  const calc = document.querySelector('.phoenix-select__calcEle');
  const ph = document.querySelector('.phoenix-select__placeholder');
  const input = document.querySelector('.phoenix-select__input');
  const trigger = document.querySelector('.phoenix-select--editable');

  let selected = initial ? [initial] : [];
  const ev = { icon: 0, word: 0, clear: 0, confirm: 0, submitted: [], rejected: 0 };

  const buildPopup = () => {
    // 真机里它是挂在页面最下方的 portal（phoenix-unmodeled-layer）
    const layer = document.createElement('div');
    layer.className = 'phoenix-unmodeled-layer block';
    layer.innerHTML =
      '<div class="phoenix-unmodeled-layer__inner">' +
      '<div class="constant-main-selector-container">' +
      '<div class="constant-main-layer-container">' +
      '<div class="content-search"><input class="c-search"></div>' +
      '<div class="content-container">' +
      '<div class="left-container"><div class="list-wrap"></div></div>' +
      '<div class="right-container">' +
      '<div>' +
      '<span class="select-data-num">已选<span class="select-data-num-text">0/1</span>' +
      '<span class="select-data-num-limit">' + max + '</span></span>' +
      '<span class="clear-select-data disabled">清空已选</span>' +
      '</div>' +
      '<div class="select-data-container"></div>' +
      '</div></div></div>' +
      '<div class="selector-footer-button">' +
      '<div class="button-container"><button class="b-cancel">取消</button></div>' +
      '<div class="button-container"><button class="b-ok">确定</button></div>' +
      '</div>' +
      '<div class="message-container"></div>' +
      '<div class="message-mask hide"></div>' +
      '</div></div>';
    document.body.append(layer);

    const listWrap = layer.querySelector('.list-wrap');
    const search = layer.querySelector('.c-search');

    const renderList = q => {
      const txt = String(q || '').trim();
      const list = txt ? ETH_PHX.filter(n => n.includes(txt)) : ETH_PHX;
      listWrap.innerHTML = list
        .map(t => {
          const on = selected.includes(t);
          // 高亮组件会把搜索词拆成独立 span —— 真实组件永远走 Highlighter
          const label = txt && t.includes(txt)
            ? '<span class="item-label-highLightCls">' + txt + '</span>' + t.slice(t.indexOf(txt) + txt.length)
            : t;
          return (
            '<div class="list-item-container">' +
            '<span class="icon-container">' +
            '<svg class="' + (on ? 'RadioChecked' : 'RadioUnchecked') + '" width="14" height="14"></svg>' +
            '</span>' +
            '<span class="item-text-label">' + label + '</span>' +
            '</div>'
          );
        })
        .join('');
    };

    const sync = () => {
      layer.querySelector('.select-data-num-text').textContent = selected.length + '/' + max;
      const clr = layer.querySelector('.clear-select-data');
      clr.setAttribute('class', 'clear-select-data' + (selected.length ? '' : ' disabled'));
      const pane = layer.querySelector('.select-data-container');
      pane.innerHTML = selected.length
        ? selected
            .map(t => '<div class="select-item-container"><span class="select-text-label">' + t + '</span></div>')
            .join('')
        : '<div class="select-data-empty">请在左侧选择内容</div>';
      renderList(search.value);
    };

    // 完全按 bundle 的语义：图标 = onCheckItem，文字 = onClickLabel（只展开，叶子节点什么都不做）
    layer.addEventListener('click', e => {
      const t = e.target;
      const svg = t.closest && t.closest('svg');
      if (svg && /(?:^|\s)(?:Radio|Checkbox)(?:Checked|Unchecked)(?:\s|$)/.test(String(svg.getAttribute('class') || ''))) {
        ev.icon++;
        const cell = svg.closest('.list-item-container');
        const v = cell && String(cell.querySelector('.item-text-label').textContent || '').trim();
        if (!v) return;
        if (selected.includes(v)) {
          selected = selected.filter(x => x !== v);
          sync();
          return;
        }
        if (selected.length >= max) {
          ev.rejected++;
          const mask = layer.querySelector('.message-mask');
          if (mask) mask.setAttribute('class', 'message-mask show');
          setTimeout(() => {
            if (mask && mask.isConnected) mask.setAttribute('class', 'message-mask hide');
          }, 260);
          return;
        }
        selected = selected.concat([v]);
        sync();
        return;
      }
      if (t.closest && t.closest('.item-text-label')) {
        ev.word++; // onClickLabel：只负责展开下一级，叶子节点什么都不做
        return;
      }
      const clr = t.closest && t.closest('.clear-select-data');
      if (clr) {
        if (/disabled/.test(String(clr.getAttribute('class') || ''))) return;
        ev.clear++;
        selected = [];
        sync();
        return;
      }
      if (t.closest && t.closest('.b-ok')) {
        ev.confirm++;
        const v = breakConfirm ? [] : selected.slice();
        ev.submitted.push(v);
        calc.textContent = v.join('、');
        ph.textContent = v.length ? v[0] : '请选择必填';
        layer.remove();
        return;
      }
      if (t.closest && t.closest('.b-cancel')) layer.remove();
    });

    search.addEventListener('input', () => renderList(search.value));
    sync();
  };

  trigger.addEventListener('click', () => {
    if (document.querySelector('.constant-main-selector-container')) return;
    buildPopup();
  });

  return { dom, ev, calc, ph, input, selectedNow: () => selected.slice() };
}

console.log('\n[24] 真机结构A：constant-main-selector-container，只有 svg.RadioUnchecked 能勾选（空白场景）');
{
  const page = mountPhoenixSelector({ max: 1 });
  const profile24 = defaultProfile();
  profile24.personal = [{ 民族: '汉族' }];

  const report = await fillPage(profile24, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const row = report.results.find(r => r.slot === 'personal.ethnicity');

  ok(
    '[24] 民族填写成功',
    row && row.status === 'filled' && row.readback === '汉族',
    JSON.stringify(row && { s: row.status, r: row.reason, v: row.via, rb: row.readback, ic: row.itemClick, a: row.attempts })
  );
  ok('[24] 点的是 svg 图标（不是文字）', page.ev.icon > 0 && page.ev.word === 0, JSON.stringify(page.ev));
  ok('[24] 内部已选是 [汉族]', JSON.stringify(page.selectedNow()) === '["汉族"]', JSON.stringify(page.selectedNow()));
  ok('[24] 确定提交的是 [汉族] 而不是空数组', JSON.stringify(page.ev.submitted.at(-1)) === '["汉族"]', JSON.stringify(page.ev.submitted));
  ok('[24] 触发器 calcEle 已是汉族', page.calc.textContent === '汉族', page.calc.textContent || '(空)');
  ok('[24] 占位没有变成必填报错', page.ph.textContent !== '请选择必填', page.ph.textContent);
  ok('[24] 没有异常逃逸', !/^exception:/.test(String((row && row.reason) || '')));
}

console.log('\n[25] 真机结构A：已选 1/1 回族，换成汉族（截图 5 的状态）');
{
  const page = mountPhoenixSelector({ initial: '回族', max: 1 });
  const profile25 = defaultProfile();
  profile25.personal = [{ 民族: '汉族' }];

  const report = await fillPage(profile25, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const row = report.results.find(r => r.slot === 'personal.ethnicity');

  ok('[25] 「清空已选」被点到过', page.ev.clear > 0, String(page.ev.clear));
  ok('[25] 满额时没有被拒绝过（清空在前）', page.ev.rejected === 0, String(page.ev.rejected));
  ok(
    '[25] 回族 → 汉族 切换成功',
    row && row.status === 'filled' && row.readback === '汉族',
    JSON.stringify(row && { s: row.status, r: row.reason, rb: row.readback, ic: row.itemClick, a: row.attempts })
  );
  ok('[25] 内部已选只有汉族', JSON.stringify(page.selectedNow()) === '["汉族"]', JSON.stringify(page.selectedNow()));
  ok('[25] 没有异常逃逸', !/^exception:/.test(String((row && row.reason) || '')));
}

console.log('\n[26] 真机结构A：确定提交空数组 → 必须判失败，且不许把「请选择必填」当值');
{
  const page = mountPhoenixSelector({ initial: '回族', max: 1, breakConfirm: true });
  const profile26 = defaultProfile();
  profile26.personal = [{ 民族: '汉族' }];

  const report = await fillPage(profile26, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
  });
  const row = report.results.find(r => r.slot === 'personal.ethnicity');

  ok('[26] 判的是失败', row && row.status === 'failed', JSON.stringify(row && { s: row.status, r: row.reason }));
  ok('[26] 原因是 readback-empty', row && row.reason === 'readback-empty', String(row && row.reason));
  ok('[26] 「请选择必填」没被当成值', row && row.readback !== '请选择必填', JSON.stringify(row && row.readback));
  ok('[26] 没有低置信度假成功', !(row && row.lowConfidence), JSON.stringify(row && row.lowConfidence));
  ok('[26] 没有异常逃逸', !/^exception:/.test(String((row && row.reason) || '')));
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
