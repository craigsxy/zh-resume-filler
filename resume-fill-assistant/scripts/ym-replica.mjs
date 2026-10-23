// 复刻诊断里的"年月选择器"日历（phoenix-date-picker 年月模式），
// 打印插件看到的面板文本 + attempts，看它到底卡在哪。
// 运行：node scripts/ym-replica.mjs
//
// 依据诊断 panelText 提炼的两种视图：
//   月份视图：标题「2026年 10月」+ 年份入口「2026 x」+ 月份列表「1月…12月 本月」（缺当前月）
//   年份视图：标题不变 + 年代「2020-2029 x」+ 年份列表「2019…2030」
import { JSDOM } from 'jsdom';
import { fillPage } from '../src/fill.js';
import { defaultProfile } from '../src/schema.js';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12];
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

function pickerHtml(cls) {
  return `
    <div class="phoenix-date-picker">
      <input class="${cls}" type="text" readonly placeholder="请选择">
      <div class="phoenix-calendar-panel" style="display:none">
        <span class="phoenix-calendar-ym-select">
          <span class="ym-year-text">2026年</span>
          <span class="ym-month-text">10月</span>
        </span>
        <div class="year-view" style="display:none">
          <span class="decade">2020-2029</span><span class="clear">x</span>
          ${YEARS.map(y => `<span class="year-item">${y}</span>`).join('')}
        </div>
        <div class="month-view">
          <span class="cur-year">2026</span><span class="clear">x</span>
          ${MONTHS.map(m => `<span class="month-item">${m}月</span>`).join('')}
          <span class="month-item month-this">本月</span>
        </div>
      </div>
    </div>`;
}

function mount(doc, cls) {
  const inp = doc.querySelector(`.${cls}`);
  const panel = doc.querySelector('.phoenix-calendar-panel');
  const head = doc.querySelector('.phoenix-calendar-ym-select');
  const yearText = doc.querySelector('.ym-year-text');
  const monthText = doc.querySelector('.ym-month-text');
  const yearView = doc.querySelector('.year-view');
  const monthView = doc.querySelector('.month-view');
  const curYear = doc.querySelector('.cur-year');
  let selYear = 2026;
  let selMonth = 10;

  inp.addEventListener('click', () => { panel.style.display = ''; });
  // 点「完整年月标题」不切视图（真实日历：点头部无效）；点「年份标签」才切年份视图
  head.addEventListener('click', () => { /* 什么都不做：复刻 driveYmPanel 点头部无效 */ });
  yearText.addEventListener('click', () => {
    yearView.style.display = '';
    monthView.style.display = 'none';
  });
  // 点年份 → 更新标题年份，切回月份视图
  yearView.addEventListener('click', e => {
    const it = e.target && e.target.closest ? e.target.closest('.year-item') : null;
    if (!it) return;
    selYear = Number(it.textContent);
    yearText.textContent = selYear + '年';
    curYear.textContent = selYear;
    yearView.style.display = 'none';
    monthView.style.display = '';
  });
  // 点月份 → 提交并关面板
  monthView.addEventListener('click', e => {
    const it = e.target && e.target.closest ? e.target.closest('.month-item') : null;
    if (!it) return;
    if (!it.classList.contains('month-this')) {
      selMonth = Number(it.textContent.replace('月', ''));
      monthText.textContent = selMonth + '月';
    }
    inp.value = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    panel.style.display = 'none';
  });
  return { inp, panel };
}

const HTML = `<!doctype html><html><body><form>
  <div class="card">
    <div class="section-title">教育经历</div>
    <div class="form-item"><label class="form-label">结束时间</label>${pickerHtml('d-end')}</div>
    <div class="form-item"><label class="form-label">学校名称</label><input class="s-school" type="text"></div>
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
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.MouseEvent = dom.window.MouseEvent;
global.CSS = dom.window.CSS || { escape: s => String(s).replace(/["\\]/g, '\\$&') };

const doc = dom.window.document;
const { inp } = mount(doc, 'd-end');

async function run(label, endVal) {
  const p = defaultProfile();
  p.education = [{ 结束时间: endVal, 学校名称: '香港城市大学' }];
  const report = await fillPage(p, {
    bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) },
    expand: false,
  });
  console.log(`\n===== ${label}（目标 ${endVal}）=====`);
  for (const r of report.results) {
    console.log(`${r.slot.padEnd(12)} ${r.status.padEnd(8)} reason=${r.reason || ''} rb=${JSON.stringify(r.readback || '')}`);
    if (r.attempts) console.log('   attempts:', r.attempts.join(' | '));
    if (r.panelText) console.log('   panelText:', r.panelText);
  }
  console.log('input.value =', JSON.stringify(inp.value));
}

// 重置 input 值（复刻里挂的是同一个 dom）
await run('场景 B：目标月=当前月', '2026-10-02');
inp.value = '';
await run('场景 A：目标年≠当前年', '2025-09-01');
